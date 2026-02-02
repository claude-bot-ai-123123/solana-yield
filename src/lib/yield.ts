import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { YieldMonitor } from './monitor';
import { StrategyEngine } from './strategy';
import { Executor } from './executor';
import { 
  SolanaYieldConfig, 
  YieldOpportunity, 
  Portfolio, 
  RebalanceAction,
  Strategy 
} from '../types';

const DEFAULT_STRATEGY: Strategy = {
  name: 'balanced',
  riskTolerance: 'medium',
  rebalanceThreshold: 0.5,
  maxProtocolConcentration: 0.4,
  maxSlippage: 0.01,
};

export class SolanaYield {
  private connection: Connection;
  private keypair: Keypair;
  private monitor: YieldMonitor;
  private strategy: StrategyEngine;
  private executor: Executor;
  private config: Strategy;

  constructor(config: SolanaYieldConfig) {
    this.keypair = config.keypair;
    this.connection = new Connection(
      config.rpcUrl || 'https://api.mainnet-beta.solana.com'
    );
    this.config = config.strategy || DEFAULT_STRATEGY;
    
    this.monitor = new YieldMonitor(this.connection);
    this.strategy = new StrategyEngine(this.config);
    this.executor = new Executor(this.connection, this.keypair);
  }

  /**
   * Get all current yield opportunities across protocols
   */
  async getOpportunities(): Promise<YieldOpportunity[]> {
    return this.monitor.fetchAllYields();
  }

  /**
   * Get current portfolio positions
   */
  async getPortfolio(): Promise<Portfolio> {
    return this.monitor.getPortfolio(this.keypair.publicKey);
  }

  /**
   * Calculate optimal rebalancing actions
   */
  async calculateRebalance(): Promise<RebalanceAction[]> {
    const opportunities = await this.getOpportunities();
    const portfolio = await this.getPortfolio();
    return this.strategy.calculateOptimalMoves(portfolio, opportunities);
  }

  /**
   * Execute a full portfolio optimization
   */
  async optimize(options?: { 
    dryRun?: boolean;
    maxSlippage?: number;
  }): Promise<{ actions: RebalanceAction[]; txIds?: string[] }> {
    const actions = await this.calculateRebalance();
    
    if (options?.dryRun) {
      return { actions };
    }

    const txIds = await this.executor.executeActions(actions, {
      maxSlippage: options?.maxSlippage || 0.01,
    });

    return { actions, txIds };
  }

  /**
   * Start continuous monitoring and auto-rebalancing
   */
  async startAutoPilot(intervalMs: number = 60000): Promise<void> {
    console.log('🚀 SolanaYield AutoPilot started');
    console.log(`   Strategy: ${this.config.name}`);
    console.log(`   Risk: ${this.config.riskTolerance}`);
    console.log(`   Rebalance threshold: ${this.config.rebalanceThreshold}%`);
    
    const tick = async () => {
      try {
        const { actions } = await this.optimize({ dryRun: true });
        if (actions.length > 0) {
          console.log(`📊 Found ${actions.length} optimization opportunities`);
          // In production, would execute here
        }
      } catch (err) {
        console.error('AutoPilot tick error:', err);
      }
    };

    await tick();
    setInterval(tick, intervalMs);
  }
}
