import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

const SOLANA_RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

interface SimulationRequest {
  transaction?: string; // base64 encoded transaction
  instructions?: Array<{
    programId: string;
    keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
    data: string; // base64
  }>;
  signers?: string[];
  recentBlockhash?: string;
}

interface SimulationResult {
  success: boolean;
  logs?: string[];
  unitsConsumed?: number;
  err?: any;
  accounts?: Array<{
    pubkey: string;
    lamports?: number;
    data?: string;
    owner?: string;
    executable?: boolean;
    rentEpoch?: number;
  }>;
  returnData?: {
    programId: string;
    data: string;
  };
  estimatedCost?: {
    lamports: number;
    sol: number;
    usd?: number;
  };
}

/**
 * Transaction Simulation & Preview API
 * 
 * Simulates Solana transactions before execution to:
 * - Preview state changes
 * - Estimate gas costs
 * - Validate transaction safety
 * - Show expected outcomes
 * 
 * POST /api/simulate
 * 
 * Body (base64 transaction):
 * {
 *   "transaction": "base64_encoded_transaction"
 * }
 * 
 * OR (instruction-level):
 * {
 *   "instructions": [...],
 *   "signers": ["base58_pubkey"],
 *   "recentBlockhash": "blockhash"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "logs": [...],
 *   "unitsConsumed": 5000,
 *   "accounts": [...],
 *   "estimatedCost": {
 *     "lamports": 5000,
 *     "sol": 0.000005,
 *     "usd": 0.0006
 *   }
 * }
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as SimulationRequest;

    if (!body.transaction && !body.instructions) {
      return res.status(400).json({
        error: 'Missing transaction data',
        usage: {
          base64Transaction: 'POST with { "transaction": "base64_string" }',
          instructionLevel: 'POST with { "instructions": [...], "signers": [...] }'
        }
      });
    }

    const connection = new Connection(SOLANA_RPC, 'confirmed');

    let transaction: Transaction | VersionedTransaction;
    let simulationResult;

    if (body.transaction) {
      // Decode base64 transaction
      const txBuffer = Buffer.from(body.transaction, 'base64');
      
      // Try parsing as versioned transaction first
      try {
        transaction = VersionedTransaction.deserialize(txBuffer);
        simulationResult = await connection.simulateTransaction(transaction);
      } catch (e) {
        // Fallback to legacy transaction
        transaction = Transaction.from(txBuffer);
        simulationResult = await connection.simulateTransaction(transaction);
      }
    } else {
      // Build transaction from instructions
      return res.status(501).json({
        error: 'Instruction-level simulation not yet implemented',
        note: 'Please provide a base64-encoded transaction'
      });
    }

    // Calculate estimated cost
    const lamportsPerSignature = 5000; // Standard signature cost
    const computeUnitPrice = simulationResult.value.unitsConsumed || 200000;
    const computeCost = Math.ceil(computeUnitPrice * 0.000001); // Rough estimate
    const totalLamports = lamportsPerSignature + computeCost;
    const totalSol = totalLamports / 1e9;

    // Fetch SOL price (simplified - could cache this)
    let usdCost: number | undefined;
    try {
      const priceRes = await fetch('https://price.jup.ag/v4/price?ids=SOL');
      const priceData = await priceRes.json();
      if (priceData.data?.SOL?.price) {
        usdCost = totalSol * priceData.data.SOL.price;
      }
    } catch (e) {
      // Price fetch failed, continue without USD estimate
    }

    const result: SimulationResult = {
      success: !simulationResult.value.err,
      logs: simulationResult.value.logs || undefined,
      unitsConsumed: simulationResult.value.unitsConsumed || undefined,
      err: simulationResult.value.err || undefined,
      returnData: simulationResult.value.returnData ? {
        programId: typeof simulationResult.value.returnData.programId === 'string' 
          ? simulationResult.value.returnData.programId 
          : (simulationResult.value.returnData.programId as any).toBase58(),
        data: typeof simulationResult.value.returnData.data === 'string'
          ? simulationResult.value.returnData.data
          : Buffer.from((simulationResult.value.returnData.data as any)[0] || '').toString('base64')
      } : undefined,
      estimatedCost: {
        lamports: totalLamports,
        sol: totalSol,
        usd: usdCost
      }
    };

    // Add account changes if available
    if (simulationResult.value.accounts) {
      result.accounts = simulationResult.value.accounts.map((acc: any, idx) => ({
        pubkey: `Account_${idx}`, // Would need full transaction context for actual pubkeys
        lamports: acc?.lamports,
        data: acc?.data ? (typeof acc.data === 'string' ? acc.data : Buffer.from(acc.data).toString('base64')) : undefined,
        owner: acc?.owner ? (typeof acc.owner === 'string' ? acc.owner : acc.owner.toBase58()) : undefined,
        executable: acc?.executable,
        rentEpoch: acc?.rentEpoch
      }));
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Simulation error:', error);
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    });
  }
}
