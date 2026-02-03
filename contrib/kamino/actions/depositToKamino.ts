import { Action } from "solana-agent-kit";
import { z } from "zod";
import { depositToKamino } from "../tools/kamino_deposit";

const depositToKaminoAction: Action = {
  name: "DEPOSIT_TO_KAMINO",
  similes: [
    "deposit kamino",
    "lend on kamino",
    "kamino lending",
    "kamino deposit usdc",
    "earn yield kamino",
    "kamino lend",
    "supply kamino",
  ],
  description:
    "Deposit tokens into Kamino Finance lending vaults to earn yield",
  examples: [
    [
      {
        input: {
          amount: 100,
          token: "USDC",
        },
        output: {
          status: "success",
          signature: "5Nv8...",
          message: "Successfully deposited 100 USDC to Kamino",
        },
        explanation: "Deposit 100 USDC into Kamino lending vault",
      },
    ],
  ],
  schema: z.object({
    amount: z.number().positive().describe("Amount to deposit"),
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

      const res = await depositToKamino(agent, amount, token);
      return {
        status: "success",
        transaction: res,
        message: `Successfully deposited ${amount} ${token} to Kamino`,
      };
    } catch (error: any) {
      return {
        status: "error",
        message: `Kamino deposit failed: ${error.message}`,
      };
    }
  },
};

export default depositToKaminoAction;
