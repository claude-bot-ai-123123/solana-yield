import { VersionedTransaction } from "@solana/web3.js";
import { type SolanaAgentKit, signOrSendTX } from "solana-agent-kit";

/**
 * Stake SOL with Marinade Finance
 * @param agent SolanaAgentKit instance
 * @param amount Amount of SOL to stake
 * @returns Transaction signature
 */
export async function stakeWithMarinade(agent: SolanaAgentKit, amount: number) {
  try {
    // Marinade uses Solana Actions for staking
    const response = await fetch(
      `https://stake.marinade.finance/api/stake?amount=${amount}`,
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
      throw new Error(errorData.message || "Marinade staking request failed");
    }

    const data = await response.json();

    // Deserialize and prepare transaction
    const txn = VersionedTransaction.deserialize(
      Buffer.from(data.transaction, "base64"),
    );

    // Update blockhash
    const { blockhash } = await agent.connection.getLatestBlockhash();
    txn.message.recentBlockhash = blockhash;

    return await signOrSendTX(agent, txn);
  } catch (error: any) {
    console.error(error);
    throw new Error(`Marinade mSOL staking failed: ${error.message}`);
  }
}

/**
 * Unstake mSOL from Marinade (delayed unstake)
 * @param agent SolanaAgentKit instance
 * @param amount Amount of mSOL to unstake
 * @returns Transaction signature
 */
export async function unstakeFromMarinade(
  agent: SolanaAgentKit,
  amount: number,
) {
  try {
    const response = await fetch(
      `https://stake.marinade.finance/api/delayed-unstake?amount=${amount}`,
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
      throw new Error(errorData.message || "Marinade unstake request failed");
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
    throw new Error(`Marinade mSOL unstaking failed: ${error.message}`);
  }
}
