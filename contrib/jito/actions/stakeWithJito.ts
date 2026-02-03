import { Action } from "solana-agent-kit";
import { z } from "zod";
import { stakeWithJito } from "../tools/stake_with_jito";

const stakeWithJitoAction: Action = {
  name: "STAKE_WITH_JITO",
  similes: [
    "stake sol jito",
    "jito staking",
    "jito sol",
    "stake with jito",
    "liquid staking jito",
    "get jitosol",
    "stake for jitosol",
    "mev staking",
  ],
  description:
    "Stake native SOL with Jito's MEV-enhanced liquid staking protocol to receive JitoSOL",
  examples: [
    [
      {
        input: {
          amount: 1.0,
        },
        output: {
          status: "success",
          signature: "5KtE...",
          message: "Successfully staked 1.0 SOL for JitoSOL",
        },
        explanation: "Stake 1.0 SOL to receive JitoSOL with MEV rewards",
      },
    ],
  ],
  schema: z.object({
    amount: z.number().positive().describe("Amount of SOL to stake"),
  }),
  handler: async (agent, input: Record<string, any>) => {
    try {
      const amount = input.amount as number;

      const res = await stakeWithJito(agent, amount);
      return {
        status: "success",
        transaction: res,
        message: `Successfully staked ${amount} SOL for JitoSOL`,
      };
    } catch (error: any) {
      return {
        status: "error",
        message: `Jito staking failed: ${error.message}`,
      };
    }
  },
};

export default stakeWithJitoAction;
