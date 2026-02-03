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

// Decision History & Audit Trail
export {
  DecisionHistoryStore,
  getHistoryStore,
  type DecisionRecord,
  type DecisionContext,
  type DecisionMeta,
  type DecisionQuery,
  type DecisionStats,
  type AuditExport,
} from './lib/history';

// What-If Scenario Simulation
export {
  WhatIfEngine,
  getWhatIfEngine,
  PREDEFINED_SCENARIOS,
  type WhatIfScenario,
  type WhatIfResult,
  type WhatIfComparison,
} from './lib/whatif';

// Protocol adapters
export { KaminoAdapter } from './adapters/kamino';
export { DriftAdapter } from './adapters/drift';
export { JitoAdapter } from './adapters/jito';
export { MarinadeAdapter } from './adapters/marinade';

// Yield Analysis System
export {
  analyzeYields,
  runMultiAgentAnalysis,
  runConsensusAnalysis,
  AGENT_PERSONAS,
  type AgentPersona,
  type AgentVote,
  type ConsensusResult,
  type ThoughtStreamEntry,
  type MultiAgentAnalysis,
  type YieldAnalysis,
  type PortfolioAnalysis,
  type AnalysisFactor,
} from './lib/consensus';

// Types
export * from './types';
