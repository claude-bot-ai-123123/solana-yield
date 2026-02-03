import { Action } from "solana-agent-kit";
import { z } from "zod";
import { unstakeFromMarinade } from "../tools/stake_with_marinade";

const unstakeFromMarinadeAction: Action = {
  name: "UNSTAKE_FROM_MARINADE",
  similes: [
    "unstake marinade",
    "unstake msol",
    "withdraw marinade",
    "delayed unstake marinade",
    "convert msol to sol",
  ],
  description:
    "Unstake mSOL from Marinade Finance (delayed unstake, ~3 days)",
  examples: [
    [
      {
        input: {
          amount: 1.0,
        },
        output: {
          status: "success",
          signature: "2Hf7...",
          message: "Successfully unstaked 1.0 mSOL (delayed ~3 days)",
        },
        explanation: "Unstake 1.0 mSOL to receive SOL after waiting period",
      },
    ],
  ],
  schema: z.object({
    amount: z.number().positive().describe("Amount of mSOL to unstake"),
  }),
  handler: async (agent, input: Record<string, any>) => {
    try {
      const amount = input.amount as number;

      const res = await unstakeFromMarinade(agent, amount);
      return {
        status: "success",
        transaction: res,
        message: `Successfully unstaked ${amount} mSOL (delayed ~3 days)`,
      };
    } catch (error: any) {
      return {
        status: "error",
        message: `Marinade unstaking failed: ${error.message}`,
      };
    }
  },
};

export default unstakeFromMarinadeAction;
