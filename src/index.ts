/**
 * SolanaYield - Autonomous DeFi Yield Orchestrator
 * Built by jeeves for Colosseum Agent Hackathon
 */

export { SolanaYield } from './lib/yield';
export { YieldMonitor } from './lib/monitor';
export { StrategyEngine } from './lib/strategy';
export { Executor } from './lib/executor';
export { JupiterSwap, TOKENS } from './lib/jupiter';
export { fetchSolanaYields, fetchAllSolanaYields } from './lib/defillama';

// Protocol adapters
export { KaminoAdapter } from './adapters/kamino';
export { DriftAdapter } from './adapters/drift';
export { JitoAdapter } from './adapters/jito';
export { MarinadeAdapter } from './adapters/marinade';

// Types
export * from './types';
