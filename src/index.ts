/**
 * SolanaYield - Autonomous DeFi Yield Orchestrator
 * Built by jeeves for Colosseum Agent Hackathon
 */

export { SolanaYield } from './lib/yield';
export { YieldMonitor } from './lib/monitor';
export { StrategyEngine, type StrategyDecision } from './lib/strategy';
export { Executor } from './lib/executor';
export { JupiterSwap, TOKENS } from './lib/jupiter';
export { fetchSolanaYields, fetchAllSolanaYields } from './lib/defillama';
export { Autopilot, type AutopilotState, type AutopilotDecision } from './lib/autopilot';

// Risk-adjusted yield analysis
export { 
  calculateRiskScore,
  calculateRiskAdjustedApy,
  calculateSharpeRatio,
  analyzeOpportunities,
  sortByRiskAdjustedReturn,
  getTopRecommendations,
  PROTOCOL_PROFILES,
  type RiskScore,
  type RiskAdjustedOpportunity,
} from './lib/risk';

// Protocol adapters
export { KaminoAdapter } from './adapters/kamino';
export { DriftAdapter } from './adapters/drift';
export { JitoAdapter } from './adapters/jito';
export { MarinadeAdapter } from './adapters/marinade';

// Types
export * from './types';
