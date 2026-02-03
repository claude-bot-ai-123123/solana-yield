import { Action } from "solana-agent-kit";
import { z } from "zod";
import { withdrawFromKamino } from "../tools/kamino_deposit";

const withdrawFromKaminoAction: Action = {
  name: "WITHDRAW_FROM_KAMINO",
  similes: [
    "withdraw kamino",
    "withdraw from kamino",
    "kamino withdraw usdc",
    "redeem kamino",
    "unstake kamino",
    "pull from kamino",
  ],
  description: "Withdraw tokens from Kamino Finance lending vaults",
  examples: [
    [
      {
        input: {
          amount: 100,
          token: "USDC",
        },
        output: {
          status: "success",
          signature: "3Jk9...",
          message: "Successfully withdrew 100 USDC from Kamino",
        },
        explanation: "Withdraw 100 USDC from Kamino lending vault",
      },
    ],
  ],
  schema: z.object({
    amount: z.number().positive().describe("Amount to withdraw"),
    token: z
      .string()
      .optional()
      .default("USDC")
      .describe("Token symbol (USDC, SOL, etc.)"),
  }),
  handler: async (agent, input: Record<string, any>) => {
    try {
      const amount = input.amount as number;
      const token = (input.token as string) || "USDC";

      const res = await withdrawFromKamino(agent, amount, token);
      return {
        status: "success",
        transaction: res,
        message: `Successfully withdrew ${amount} ${token} from Kamino`,
      };
    } catch (error: any) {
      return {
        status: "error",
        message: `Kamino withdraw failed: ${error.message}`,
      };
    }
  },
};

export default withdrawFromKaminoAction;
