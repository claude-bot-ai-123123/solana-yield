import { VersionedTransaction, PublicKey } from "@solana/web3.js";
import { type SolanaAgentKit, signOrSendTX } from "solana-agent-kit";

/**
 * Deposit into a Kamino lending vault
 * @param agent SolanaAgentKit instance
 * @param amount Amount to deposit
 * @param token Token symbol (USDC, SOL, etc.)
 * @returns Transaction signature
 */
export async function depositToKamino(
  agent: SolanaAgentKit,
  amount: number,
  token: string = "USDC",
) {
  try {
    // Kamino uses Solana Actions for simplified deposits
    const response = await fetch(
      `https://app.kamino.finance/api/lend/deposit?token=${token}&amount=${amount}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account: agent.wallet.publicKey.toBase58(),
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Kamino deposit request failed");
    }

    const data = await response.json();

    // Deserialize transaction
    const txn = VersionedTransaction.deserialize(
      Buffer.from(data.transaction, "base64"),
    );

    // Update blockhash
    const { blockhash } = await agent.connection.getLatestBlockhash();
    txn.message.recentBlockhash = blockhash;

    return await signOrSendTX(agent, txn);
  } catch (error: any) {
    console.error(error);
    throw new Error(`Kamino deposit failed: ${error.message}`);
  }
}

/**
 * Withdraw from a Kamino lending vault
 * @param agent SolanaAgentKit instance
 * @param amount Amount to withdraw
 * @param token Token symbol (USDC, SOL, etc.)
 * @returns Transaction signature
 */
export async function withdrawFromKamino(
  agent: SolanaAgentKit,
  amount: number,
  token: string = "USDC",
) {
  try {
    const response = await fetch(
      `https://app.kamino.finance/api/lend/withdraw?token=${token}&amount=${amount}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account: agent.wallet.publicKey.toBase58(),
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Kamino withdraw request failed");
    }

    const data = await response.json();

    const txn = VersionedTransaction.deserialize(
      Buffer.from(data.transaction, "base64"),
    );

    const { blockhash } = await agent.connection.getLatestBlockhash();
    txn.message.recentBlockhash = blockhash;

    return await signOrSendTX(agent, txn);
  } catch (error: any) {
    console.error(error);
    throw new Error(`Kamino withdraw failed: ${error.message}`);
  }
}

/**
 * Get current APY rates for Kamino lending vaults
 * @param agent SolanaAgentKit instance
 * @param token Optional token filter
 * @returns Array of vault APY data
 */
export async function getKaminoRates(
  agent: SolanaAgentKit,
  token?: string,
): Promise<Array<{ token: string; apy: number; tvl: number }>> {
  try {
    const response = await fetch("https://api.kamino.finance/strategies/metrics");

    if (!response.ok) {
      throw new Error("Failed to fetch Kamino rates");
    }

    const data = await response.json();

    let rates = data.map((vault: any) => ({
      token: vault.symbol || "UNKNOWN",
      apy: (vault.apy || 0) * 100,
      tvl: vault.tvl || 0,
    }));

    if (token) {
      rates = rates.filter(
        (r: any) => r.token.toUpperCase() === token.toUpperCase(),
      );
    }

    return rates;
  } catch (error: any) {
    console.error(error);
    throw new Error(`Failed to get Kamino rates: ${error.message}`);
  }
}
