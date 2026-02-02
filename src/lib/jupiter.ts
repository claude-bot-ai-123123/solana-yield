/**
 * Jupiter integration for swap execution
 */

import { Connection, PublicKey, VersionedTransaction, Keypair } from '@solana/web3.js';

const JUPITER_API = 'https://quote-api.jup.ag/v6';

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  slippageBps: number;
  routePlan: {
    swapInfo: {
      ammKey: string;
      label: string;
    };
    percent: number;
  }[];
}

export interface SwapResult {
  txId: string;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
}

// Common token mints
export const TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  mSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  JitoSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  JLP: '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4',
} as const;

export class JupiterSwap {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get a quote for a swap
   */
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number, // in base units (lamports, etc.)
    slippageBps: number = 50 // 0.5%
  ): Promise<SwapQuote> {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
    });

    const response = await fetch(`${JUPITER_API}/quote?${params}`);
    if (!response.ok) {
      throw new Error(`Jupiter quote failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Execute a swap
   */
  async swap(
    keypair: Keypair,
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50
  ): Promise<SwapResult> {
    // Get quote
    const quote = await this.getQuote(inputMint, outputMint, amount, slippageBps);

    // Get serialized transaction
    const swapResponse = await fetch(`${JUPITER_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: keypair.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
      }),
    });

    if (!swapResponse.ok) {
      throw new Error(`Jupiter swap request failed: ${swapResponse.statusText}`);
    }

    const { swapTransaction } = await swapResponse.json();

    // Deserialize and sign
    const txBuf = Buffer.from(swapTransaction, 'base64');
    const tx = VersionedTransaction.deserialize(txBuf);
    tx.sign([keypair]);

    // Send
    const txId = await this.connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3,
    });

    // Confirm
    const latestBlockhash = await this.connection.getLatestBlockhash();
    await this.connection.confirmTransaction({
      signature: txId,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });

    return {
      txId,
      inputAmount: parseInt(quote.inAmount),
      outputAmount: parseInt(quote.outAmount),
      priceImpact: quote.priceImpactPct,
    };
  }

  /**
   * Get the best route for a token pair
   */
  async getBestRoute(
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<{ route: string; expectedOutput: number; priceImpact: number }> {
    const quote = await this.getQuote(inputMint, outputMint, amount);
    
    const routeLabels = quote.routePlan
      .map(r => `${r.swapInfo.label} (${r.percent}%)`)
      .join(' → ');

    return {
      route: routeLabels,
      expectedOutput: parseInt(quote.outAmount),
      priceImpact: quote.priceImpactPct,
    };
  }
}
