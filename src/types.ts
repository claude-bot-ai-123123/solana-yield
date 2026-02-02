import { PublicKey, Keypair } from '@solana/web3.js';

export interface YieldOpportunity {
  protocol: 'kamino' | 'drift' | 'jito' | 'marinade';
  asset: string;
  apy: number;
  tvl: number;
  risk: 'low' | 'medium' | 'high';
  minDeposit?: number;
  metadata?: Record<string, unknown>;
}

export interface Portfolio {
  positions: Position[];
  totalValue: number;
  weightedApy: number;
}

export interface Position {
  protocol: string;
  asset: string;
  amount: number;
  valueUsd: number;
  currentApy: number;
  entryTime: Date;
}

export interface Strategy {
  name: string;
  riskTolerance: 'low' | 'medium' | 'high';
  rebalanceThreshold: number; // % difference to trigger rebalance
  maxProtocolConcentration: number; // max % in single protocol
  preferredProtocols?: string[];
}

export interface RebalanceAction {
  type: 'deposit' | 'withdraw' | 'swap';
  from?: { protocol: string; asset: string; amount: number };
  to?: { protocol: string; asset: string; amount: number };
  expectedApyGain: number;
}

export interface SolanaYieldConfig {
  keypair: Keypair;
  rpcUrl?: string;
  strategy?: Strategy;
}
