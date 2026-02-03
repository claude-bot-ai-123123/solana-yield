import { Action } from "solana-agent-kit";
import { z } from "zod";
import { getKaminoRates } from "../tools/kamino_deposit";

const getKaminoRatesAction: Action = {
  name: "GET_KAMINO_RATES",
  similes: [
    "kamino rates",
    "kamino apy",
    "kamino yields",
    "check kamino rates",
    "kamino interest rates",
    "what are kamino rates",
  ],
  description: "Get current APY rates for Kamino Finance lending vaults",
  examples: [
    [
      {
        input: {
          token: "USDC",
        },
        output: {
          status: "success",
          rates: [
            {
              token: "USDC",
              apy: 8.5,
              tvl: 50000000,
            },
          ],
        },
        explanation: "Get APY rate for USDC lending on Kamino",
      },
    ],
  ],
  schema: z.object({
    token: z
      .string()
      .optional()
      .describe("Optional token filter (USDC, SOL, etc.)"),
  }),
  handler: async (agent, input: Record<string, any>) => {
    try {
      const token = input.token as string | undefined;

      const rates = await getKaminoRates(agent, token);
      return {
        status: "success",
        rates,
        message: `Found ${rates.length} Kamino lending vaults`,
      };
    } catch (error: any) {
      return {
        status: "error",
        message: `Failed to get Kamino rates: ${error.message}`,
      };
    }
  },
};

export default getKaminoRatesAction;
