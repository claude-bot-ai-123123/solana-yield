import { VersionedTransaction } from "@solana/web3.js";
import { type SolanaAgentKit, signOrSendTX } from "solana-agent-kit";

/**
 * Stake SOL with Jito
 * @param agent SolanaAgentKit instance
 * @param amount Amount of SOL to stake
 * @returns Transaction signature
 */
export async function stakeWithJito(agent: SolanaAgentKit, amount: number) {
  try {
    const response = await fetch(
      `https://kobe.jito.network/api/v1/bundles`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getStakeAccount",
          params: [agent.wallet.publicKey.toBase58()],
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Jito stake account");
    }

    const data = await response.json();

    // Build stake transaction using Jito's stake pool
    // Jito StakePool: Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb
    const stakePoolAddress = "Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb";

    // Use Jito's actions API for simplified staking
    const actionResponse = await fetch(
      `https://stake.jito.network/api/stake?amount=${amount}`,
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

    if (!actionResponse.ok) {
      throw new Error("Jito stake action failed");
    }

    const actionData = await actionResponse.json();

    // Deserialize transaction
    const txn = VersionedTransaction.deserialize(
      Buffer.from(actionData.transaction, "base64"),
    );

    // Update blockhash
    const { blockhash } = await agent.connection.getLatestBlockhash();
    txn.message.recentBlockhash = blockhash;

    return await signOrSendTX(agent, txn);
  } catch (error: any) {
    console.error(error);
    throw new Error(`Jito SOL staking failed: ${error.message}`);
  }
}
