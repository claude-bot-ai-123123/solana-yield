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

// MCP (Model Context Protocol) Integration
export { MCPServer } from './lib/mcp';

// 🚀 Live Autonomous Trading Mode
export {
  TradingModeManager,
  DEFAULT_TRADING_CONFIG,
  type TradingMode,
  type TradingModeConfig,
  type TradingState,
  type TradingEvent,
  type PendingTrade,
} from './lib/trading-mode';

// WebSocket/SSE Real-time Streaming
export {
  TradingWebSocketServer,
  createTradingRoutes,
} from './lib/websocket';

// 📈 Strategy Backtesting Engine
export {
  BacktestEngine,
  runQuickBacktest,
  compareStrategies,
  generateComparisonReport,
  buildHistoricalDataset,
  generateSyntheticHistory,
  type BacktestConfig,
  type BacktestResult,
  type BacktestMetrics,
  type BacktestTrade,
  type DailySnapshot,
  type ProtocolSummary,
  type RiskAnalysis,
  type BenchmarkComparison,
  type HistoricalDataPoint,
} from './lib/backtest';

// ⛽ Gas Optimization AI
export {
  GasOptimizer,
  PRIORITY_TIERS,
  type PriorityTier,
  type NetworkCongestion,
  type GasRecommendation,
  type BatchOptimization,
  type TransactionBatch,
  type TimingRecommendation,
  type GasAnalysis,
} from './lib/gas-optimizer';

// Types
export * from './types';
