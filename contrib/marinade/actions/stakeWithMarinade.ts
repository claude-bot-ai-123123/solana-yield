import { Action } from "solana-agent-kit";
import { z } from "zod";
import { stakeWithMarinade } from "../tools/stake_with_marinade";

const stakeWithMarinadeAction: Action = {
  name: "STAKE_WITH_MARINADE",
  similes: [
    "stake sol marinade",
    "marinade staking",
    "marinade sol",
    "stake with marinade",
    "liquid staking marinade",
    "get msol",
    "stake for msol",
    "marinade finance",
  ],
  description:
    "Stake native SOL with Marinade Finance to receive mSOL (Marinade Staked SOL)",
  examples: [
    [
      {
        input: {
          amount: 1.0,
        },
        output: {
          status: "success",
          signature: "4Wq9...",
          message: "Successfully staked 1.0 SOL for mSOL",
        },
        explanation: "Stake 1.0 SOL to receive mSOL",
      },
    ],
  ],
  schema: z.object({
    amount: z.number().positive().describe("Amount of SOL to stake"),
  }),
  handler: async (agent, input: Record<string, any>) => {
    try {
      const amount = input.amount as number;

      const res = await stakeWithMarinade(agent, amount);
      return {
        status: "success",
        transaction: res,
        message: `Successfully staked ${amount} SOL for mSOL`,
      };
    } catch (error: any) {
      return {
        status: "error",
        message: `Marinade staking failed: ${error.message}`,
      };
    }
  },
};

export default stakeWithMarinadeAction;
