import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { RebalanceAction } from '../types';
import { JupiterSwap, TOKENS } from './jupiter';

export class Executor {
  private connection: Connection;
  private keypair: Keypair;
  private jupiter: JupiterSwap;

  constructor(connection: Connection, keypair: Keypair) {
    this.connection = connection;
    this.keypair = keypair;
    this.jupiter = new JupiterSwap(connection);
  }

  async executeActions(
    actions: RebalanceAction[],
    options: { maxSlippage: number }
  ): Promise<string[]> {
    const txIds: string[] = [];
    const slippageBps = Math.floor(options.maxSlippage * 10000);

    for (const action of actions) {
      console.log(`Executing ${action.type}: ${action.from?.protocol} -> ${action.to?.protocol}`);
      
      try {
        if (action.type === 'withdraw' && action.from && action.to) {
          // For now, handle as a swap between assets
          // In full implementation, would withdraw from protocol first
          const inputMint = this.getTokenMint(action.from.asset);
          const outputMint = this.getTokenMint(action.to.asset);
          
          if (inputMint && outputMint) {
            const result = await this.jupiter.swap(
              this.keypair,
              inputMint,
              outputMint,
              Math.floor(action.from.amount * 1e9), // Convert to lamports
              slippageBps
            );
            txIds.push(result.txId);
            console.log(`  ✅ Swapped via Jupiter: ${result.txId}`);
          }
        }
      } catch (err) {
        console.error(`  ❌ Failed: ${err}`);
        // Continue with other actions
      }
    }

    return txIds;
  }

  private getTokenMint(asset: string): string | null {
    const normalized = asset.toUpperCase().replace('-', '');
    return (TOKENS as Record<string, string>)[normalized] || null;
  }

  /**
   * Execute a simple swap
   */
  async swap(
    inputToken: string,
    outputToken: string,
    amount: number,
    slippageBps: number = 50
  ): Promise<{ txId: string; outputAmount: number }> {
    const inputMint = this.getTokenMint(inputToken);
    const outputMint = this.getTokenMint(outputToken);
    
    if (!inputMint || !outputMint) {
      throw new Error(`Unknown token: ${!inputMint ? inputToken : outputToken}`);
    }

    const result = await this.jupiter.swap(
      this.keypair,
      inputMint,
      outputMint,
      amount,
      slippageBps
    );

    return {
      txId: result.txId,
      outputAmount: result.outputAmount,
    };
  }
}
