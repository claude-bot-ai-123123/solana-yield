/**
 * Rug Pull Detection Engine
 * 
 * Real-time monitoring for DeFi protocol risks:
 * - Suspicious contract changes (upgrades, ownership transfers)
 * - Whale concentration (top holder dominance)
 * - Liquidity drains (TVL drops)
 * - Token unlock schedules
 * - Oracle manipulation signals
 * 
 * "Trust, but verify" — and verify automatically.
 */

// ============================================================================
// TYPES
// ============================================================================

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface RugPullAlert {
  id: string;
  protocol: string;
  type: AlertType;
  severity: AlertSeverity;
  timestamp: number;
  title: string;
  description: string;
  evidence: Evidence[];
  recommendation: 'exit_immediately' | 'reduce_exposure' | 'monitor_closely' | 'no_action';
  riskDelta: number;  // How much this changes the risk score (+/-)
  onChainData?: OnChainEvidence;
}

export type AlertType = 
  | 'authority_change'
  | 'contract_upgrade'
  | 'whale_accumulation'
  | 'whale_dump'
  | 'liquidity_drain'
  | 'tvl_collapse'
  | 'token_unlock'
  | 'oracle_deviation'
  | 'mint_authority_active'
  | 'freeze_authority_active'
  | 'suspicious_transaction'
  | 'team_wallet_movement';

export interface Evidence {
  type: 'transaction' | 'account_change' | 'market_data' | 'chain_data';
  description: string;
  value?: string | number;
  link?: string;
  timestamp?: number;
}

export interface OnChainEvidence {
  programId?: string;
  signature?: string;
  slot?: number;
  accounts?: string[];
  instructionData?: string;
}

export interface ProtocolHealth {
  protocol: string;
  overallRisk: number;  // 0-100
  alerts: RugPullAlert[];
  metrics: HealthMetrics;
  lastChecked: number;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
}

export interface HealthMetrics {
  tvl: number;
  tvlChange24h: number;
  tvlChange7d: number;
  whaleConcentration: number;  // % held by top 10 wallets
  liquidityDepth: number;
  upgradeAuthorityStatus: 'locked' | 'multisig' | 'single' | 'unknown';
  mintAuthorityActive: boolean;
  freezeAuthorityActive: boolean;
  lastContractUpgrade?: number;
  tokenUnlockSchedule?: TokenUnlock[];
}

export interface TokenUnlock {
  date: number;
  amount: number;
  percentOfSupply: number;
  recipient: string;
}

export interface WhaleData {
  address: string;
  balance: number;
  percentOfSupply: number;
  lastActivity?: number;
  recentChange?: number;
  label?: string;  // Known wallet labels
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Known protocol program IDs on Solana
const PROTOCOL_PROGRAMS: Record<string, { programId: string; name: string; upgradeAuthority?: string }> = {
  kamino: {
    programId: 'KLend2g3cP87ber8sNhsN4K6m7TT7SqA9XARL2ygP1s',
    name: 'Kamino Finance',
    upgradeAuthority: 'multisig', // Squads multisig
  },
  drift: {
    programId: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',
    name: 'Drift Protocol',
    upgradeAuthority: 'multisig',
  },
  marginfi: {
    programId: 'MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA',
    name: 'marginfi',
    upgradeAuthority: 'multisig',
  },
  jupiter: {
    programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    name: 'Jupiter',
    upgradeAuthority: 'locked',
  },
  jito: {
    programId: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
    name: 'Jito',
    upgradeAuthority: 'multisig',
  },
  marinade: {
    programId: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',
    name: 'Marinade Finance',
    upgradeAuthority: 'locked',
  },
};

// Alert thresholds
const THRESHOLDS = {
  TVL_DROP_CRITICAL: -30,     // % in 24h
  TVL_DROP_HIGH: -15,
  TVL_DROP_MEDIUM: -8,
  WHALE_CONCENTRATION_CRITICAL: 50,  // % held by top 10
  WHALE_CONCENTRATION_HIGH: 35,
  WHALE_DUMP_CRITICAL: 5,     // % of supply moved by whale in 24h
  WHALE_DUMP_HIGH: 2,
  TOKEN_UNLOCK_WARNING_DAYS: 14,
  ORACLE_DEVIATION_CRITICAL: 5,  // % from expected price
  ORACLE_DEVIATION_HIGH: 2,
};

// ============================================================================
// MOCK DATA (In production: replace with real API/RPC calls)
// ============================================================================

// Simulated real-time health data
const MOCK_HEALTH_DATA: Record<string, HealthMetrics> = {
  kamino: {
    tvl: 487_000_000,
    tvlChange24h: -2.3,
    tvlChange7d: 5.1,
    whaleConcentration: 18,
    liquidityDepth: 0.95,
    upgradeAuthorityStatus: 'multisig',
    mintAuthorityActive: false,
    freezeAuthorityActive: false,
    lastContractUpgrade: Date.now() - 90 * 24 * 60 * 60 * 1000, // 90 days ago
  },
  drift: {
    tvl: 523_000_000,
    tvlChange24h: 1.2,
    tvlChange7d: 8.4,
    whaleConcentration: 22,
    liquidityDepth: 0.92,
    upgradeAuthorityStatus: 'multisig',
    mintAuthorityActive: false,
    freezeAuthorityActive: false,
    lastContractUpgrade: Date.now() - 45 * 24 * 60 * 60 * 1000,
  },
  marginfi: {
    tvl: 312_000_000,
    tvlChange24h: -0.8,
    tvlChange7d: 3.2,
    whaleConcentration: 25,
    liquidityDepth: 0.88,
    upgradeAuthorityStatus: 'multisig',
    mintAuthorityActive: false,
    freezeAuthorityActive: false,
    lastContractUpgrade: Date.now() - 60 * 24 * 60 * 60 * 1000,
  },
  jupiter: {
    tvl: 892_000_000,
    tvlChange24h: 3.5,
    tvlChange7d: 12.1,
    whaleConcentration: 15,
    liquidityDepth: 0.98,
    upgradeAuthorityStatus: 'locked',
    mintAuthorityActive: false,
    freezeAuthorityActive: false,
  },
  jito: {
    tvl: 2_100_000_000,
    tvlChange24h: 0.5,
    tvlChange7d: 2.3,
    whaleConcentration: 28,
    liquidityDepth: 0.94,
    upgradeAuthorityStatus: 'multisig',
    mintAuthorityActive: false,
    freezeAuthorityActive: false,
  },
  // Simulated risky protocol for demo
  'suspicious-degen-yield': {
    tvl: 2_500_000,
    tvlChange24h: -22,
    tvlChange7d: -45,
    whaleConcentration: 68,
    liquidityDepth: 0.35,
    upgradeAuthorityStatus: 'single',
    mintAuthorityActive: true,
    freezeAuthorityActive: true,
    lastContractUpgrade: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
    tokenUnlockSchedule: [
      {
        date: Date.now() + 5 * 24 * 60 * 60 * 1000, // 5 days from now
        amount: 10_000_000,
        percentOfSupply: 15,
        recipient: 'team',
      }
    ],
  },
};

// Simulated whale data
const MOCK_WHALE_DATA: Record<string, WhaleData[]> = {
  kamino: [
    { address: 'Kamino...vault1', balance: 12_500_000, percentOfSupply: 5.2, label: 'Protocol Treasury' },
    { address: '7xKXt...a1b2c', balance: 8_200_000, percentOfSupply: 3.4, recentChange: 0.1 },
    { address: '9mNop...d3e4f', balance: 6_100_000, percentOfSupply: 2.5, recentChange: -0.2 },
  ],
  drift: [
    { address: 'Drift...treasury', balance: 25_000_000, percentOfSupply: 8.1, label: 'Protocol Treasury' },
    { address: '3pQrs...g5h6i', balance: 15_200_000, percentOfSupply: 4.9, recentChange: 0.3 },
  ],
  'suspicious-degen-yield': [
    { address: 'DEvW4...deployer', balance: 35_000_000, percentOfSupply: 42, label: 'Deployer', recentChange: -5 },
    { address: '8xYzA...whale1', balance: 12_000_000, percentOfSupply: 14.4, recentChange: -8 },
    { address: '2bCdE...whale2', balance: 10_000_000, percentOfSupply: 12, recentChange: 0 },
  ],
};

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Analyze TVL changes for liquidity drain signals
 */
function analyzeTVLRisk(protocol: string, metrics: HealthMetrics): RugPullAlert[] {
  const alerts: RugPullAlert[] = [];

  // Critical TVL drop
  if (metrics.tvlChange24h <= THRESHOLDS.TVL_DROP_CRITICAL) {
    alerts.push({
      id: generateAlertId(),
      protocol,
      type: 'tvl_collapse',
      severity: 'critical',
      timestamp: Date.now(),
      title: `🚨 CRITICAL: ${Math.abs(metrics.tvlChange24h).toFixed(1)}% TVL collapse`,
      description: `TVL dropped ${Math.abs(metrics.tvlChange24h).toFixed(1)}% in the last 24 hours. This could indicate a bank run, exploit, or coordinated exit.`,
      evidence: [
        { type: 'market_data', description: `24h TVL change: ${metrics.tvlChange24h.toFixed(1)}%`, value: metrics.tvlChange24h },
        { type: 'market_data', description: `7d TVL change: ${metrics.tvlChange7d.toFixed(1)}%`, value: metrics.tvlChange7d },
        { type: 'market_data', description: `Current TVL: $${formatNumber(metrics.tvl)}`, value: metrics.tvl },
      ],
      recommendation: 'exit_immediately',
      riskDelta: 40,
    });
  } else if (metrics.tvlChange24h <= THRESHOLDS.TVL_DROP_HIGH) {
    alerts.push({
      id: generateAlertId(),
      protocol,
      type: 'liquidity_drain',
      severity: 'high',
      timestamp: Date.now(),
      title: `⚠️ HIGH: Significant liquidity outflow detected`,
      description: `TVL down ${Math.abs(metrics.tvlChange24h).toFixed(1)}% in 24h. Monitor for continued withdrawals.`,
      evidence: [
        { type: 'market_data', description: `24h TVL change: ${metrics.tvlChange24h.toFixed(1)}%`, value: metrics.tvlChange24h },
      ],
      recommendation: 'reduce_exposure',
      riskDelta: 20,
    });
  }

  // 7-day trend analysis
  if (metrics.tvlChange7d <= -30) {
    alerts.push({
      id: generateAlertId(),
      protocol,
      type: 'liquidity_drain',
      severity: 'high',
      timestamp: Date.now(),
      title: `📉 Sustained TVL decline over 7 days`,
      description: `Protocol has lost ${Math.abs(metrics.tvlChange7d).toFixed(1)}% of TVL over the past week.`,
      evidence: [
        { type: 'market_data', description: `7d TVL change: ${metrics.tvlChange7d.toFixed(1)}%`, value: metrics.tvlChange7d },
      ],
      recommendation: 'reduce_exposure',
      riskDelta: 15,
    });
  }

  return alerts;
}

/**
 * Analyze whale concentration and movements
 */
function analyzeWhaleRisk(protocol: string, metrics: HealthMetrics, whales?: WhaleData[]): RugPullAlert[] {
  const alerts: RugPullAlert[] = [];

  // High whale concentration
  if (metrics.whaleConcentration >= THRESHOLDS.WHALE_CONCENTRATION_CRITICAL) {
    alerts.push({
      id: generateAlertId(),
      protocol,
      type: 'whale_accumulation',
      severity: 'critical',
      timestamp: Date.now(),
      title: `🐋 CRITICAL: Extreme whale concentration (${metrics.whaleConcentration}%)`,
      description: `Top 10 wallets control ${metrics.whaleConcentration}% of supply. A coordinated dump could devastate the price.`,
      evidence: [
        { type: 'chain_data', description: `Top 10 wallets hold ${metrics.whaleConcentration}% of supply` },
        ...(whales?.slice(0, 3).map(w => ({
          type: 'chain_data' as const,
          description: `${w.label || w.address.slice(0, 8) + '...'}: ${w.percentOfSupply.toFixed(1)}%`,
          value: w.percentOfSupply,
        })) || []),
      ],
      recommendation: 'exit_immediately',
      riskDelta: 35,
    });
  } else if (metrics.whaleConcentration >= THRESHOLDS.WHALE_CONCENTRATION_HIGH) {
    alerts.push({
      id: generateAlertId(),
      protocol,
      type: 'whale_accumulation',
      severity: 'medium',
      timestamp: Date.now(),
      title: `🐋 Elevated whale concentration (${metrics.whaleConcentration}%)`,
      description: `Top wallets hold significant supply. Monitor for large movements.`,
      evidence: [
        { type: 'chain_data', description: `Top 10 wallets: ${metrics.whaleConcentration}%` },
      ],
      recommendation: 'monitor_closely',
      riskDelta: 10,
    });
  }

  // Detect whale dumps
  if (whales) {
    for (const whale of whales) {
      if (whale.recentChange && whale.recentChange <= -THRESHOLDS.WHALE_DUMP_CRITICAL) {
        alerts.push({
          id: generateAlertId(),
          protocol,
          type: 'whale_dump',
          severity: 'high',
          timestamp: Date.now(),
          title: `🚨 Major whale selling detected`,
          description: `Whale ${whale.label || whale.address.slice(0, 8)} reduced position by ${Math.abs(whale.recentChange).toFixed(1)}% of supply in recent period.`,
          evidence: [
            { type: 'chain_data', description: `Wallet: ${whale.address}` },
            { type: 'chain_data', description: `Position change: ${whale.recentChange.toFixed(1)}%`, value: whale.recentChange },
            { type: 'chain_data', description: `Current holding: ${whale.percentOfSupply.toFixed(1)}%` },
          ],
          recommendation: 'reduce_exposure',
          riskDelta: 25,
        });
      }
    }
  }

  return alerts;
}

/**
 * Analyze smart contract security posture
 */
function analyzeContractRisk(protocol: string, metrics: HealthMetrics): RugPullAlert[] {
  const alerts: RugPullAlert[] = [];

  // Single-sig upgrade authority
  if (metrics.upgradeAuthorityStatus === 'single') {
    alerts.push({
      id: generateAlertId(),
      protocol,
      type: 'authority_change',
      severity: 'high',
      timestamp: Date.now(),
      title: `⚠️ Single-signature upgrade authority`,
      description: `Contract can be upgraded by a single wallet. This is a centralization risk — the protocol could be rugged with one transaction.`,
      evidence: [
        { type: 'chain_data', description: 'Upgrade authority: single signature' },
      ],
      recommendation: 'reduce_exposure',
      riskDelta: 25,
    });
  }

  // Recent contract upgrade
  if (metrics.lastContractUpgrade) {
    const daysSinceUpgrade = (Date.now() - metrics.lastContractUpgrade) / (24 * 60 * 60 * 1000);
    if (daysSinceUpgrade <= 7) {
      alerts.push({
        id: generateAlertId(),
        protocol,
        type: 'contract_upgrade',
        severity: 'medium',
        timestamp: Date.now(),
        title: `🔄 Recent contract upgrade (${Math.floor(daysSinceUpgrade)} days ago)`,
        description: `Contract was upgraded recently. Review changes before depositing. New code may contain bugs or malicious changes.`,
        evidence: [
          { type: 'chain_data', description: `Last upgrade: ${new Date(metrics.lastContractUpgrade).toISOString()}` },
        ],
        recommendation: 'monitor_closely',
        riskDelta: 10,
      });
    }
  }

  // Active mint authority (can inflate supply)
  if (metrics.mintAuthorityActive) {
    alerts.push({
      id: generateAlertId(),
      protocol,
      type: 'mint_authority_active',
      severity: 'high',
      timestamp: Date.now(),
      title: `🖨️ Active mint authority — inflation risk`,
      description: `Protocol can mint new tokens at will. Your holdings could be diluted without warning.`,
      evidence: [
        { type: 'chain_data', description: 'Mint authority: ACTIVE' },
      ],
      recommendation: 'reduce_exposure',
      riskDelta: 20,
    });
  }

  // Active freeze authority (can freeze your tokens)
  if (metrics.freezeAuthorityActive) {
    alerts.push({
      id: generateAlertId(),
      protocol,
      type: 'freeze_authority_active',
      severity: 'critical',
      timestamp: Date.now(),
      title: `🧊 CRITICAL: Active freeze authority`,
      description: `Protocol can freeze token transfers. Your funds could be locked with a single transaction.`,
      evidence: [
        { type: 'chain_data', description: 'Freeze authority: ACTIVE' },
      ],
      recommendation: 'exit_immediately',
      riskDelta: 35,
    });
  }

  return alerts;
}

/**
 * Analyze upcoming token unlocks
 */
function analyzeUnlockRisk(protocol: string, metrics: HealthMetrics): RugPullAlert[] {
  const alerts: RugPullAlert[] = [];

  if (metrics.tokenUnlockSchedule) {
    for (const unlock of metrics.tokenUnlockSchedule) {
      const daysUntilUnlock = (unlock.date - Date.now()) / (24 * 60 * 60 * 1000);
      
      if (daysUntilUnlock > 0 && daysUntilUnlock <= THRESHOLDS.TOKEN_UNLOCK_WARNING_DAYS) {
        const severity = unlock.percentOfSupply >= 10 ? 'high' : 'medium';
        
        alerts.push({
          id: generateAlertId(),
          protocol,
          type: 'token_unlock',
          severity,
          timestamp: Date.now(),
          title: `🔓 Token unlock in ${Math.ceil(daysUntilUnlock)} days (${unlock.percentOfSupply}% of supply)`,
          description: `${formatNumber(unlock.amount)} tokens (${unlock.percentOfSupply}% of supply) unlocking for ${unlock.recipient}. Expect increased sell pressure.`,
          evidence: [
            { type: 'market_data', description: `Unlock date: ${new Date(unlock.date).toLocaleDateString()}` },
            { type: 'market_data', description: `Amount: ${formatNumber(unlock.amount)} tokens` },
            { type: 'market_data', description: `Recipient: ${unlock.recipient}` },
          ],
          recommendation: severity === 'high' ? 'reduce_exposure' : 'monitor_closely',
          riskDelta: severity === 'high' ? 15 : 8,
        });
      }
    }
  }

  return alerts;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Perform comprehensive rug pull risk analysis for a protocol
 */
export async function analyzeProtocolRisk(protocol: string): Promise<ProtocolHealth> {
  const normalizedProtocol = protocol.toLowerCase();
  
  // Get health metrics (mock data for hackathon; real implementation would use RPC/APIs)
  const metrics = MOCK_HEALTH_DATA[normalizedProtocol];
  
  if (!metrics) {
    return {
      protocol,
      overallRisk: 50,
      alerts: [{
        id: generateAlertId(),
        protocol,
        type: 'suspicious_transaction',
        severity: 'info',
        timestamp: Date.now(),
        title: 'Unknown protocol',
        description: 'This protocol is not in our monitoring database. Exercise caution.',
        evidence: [],
        recommendation: 'monitor_closely',
        riskDelta: 0,
      }],
      metrics: {
        tvl: 0,
        tvlChange24h: 0,
        tvlChange7d: 0,
        whaleConcentration: 0,
        liquidityDepth: 0,
        upgradeAuthorityStatus: 'unknown',
        mintAuthorityActive: false,
        freezeAuthorityActive: false,
      },
      lastChecked: Date.now(),
      status: 'unknown',
    };
  }

  // Get whale data
  const whales = MOCK_WHALE_DATA[normalizedProtocol];

  // Run all detection modules
  const alerts: RugPullAlert[] = [
    ...analyzeTVLRisk(normalizedProtocol, metrics),
    ...analyzeWhaleRisk(normalizedProtocol, metrics, whales),
    ...analyzeContractRisk(normalizedProtocol, metrics),
    ...analyzeUnlockRisk(normalizedProtocol, metrics),
  ];

  // Sort alerts by severity
  const severityOrder: Record<AlertSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Calculate overall risk score
  let baseRisk = 20;  // Base risk for any DeFi protocol
  for (const alert of alerts) {
    baseRisk += alert.riskDelta;
  }
  const overallRisk = Math.min(100, Math.max(0, baseRisk));

  // Determine status
  let status: 'healthy' | 'warning' | 'critical' | 'unknown' = 'healthy';
  if (alerts.some(a => a.severity === 'critical')) {
    status = 'critical';
  } else if (alerts.some(a => a.severity === 'high')) {
    status = 'warning';
  }

  return {
    protocol,
    overallRisk,
    alerts,
    metrics,
    lastChecked: Date.now(),
    status,
  };
}

/**
 * Analyze multiple protocols at once
 */
export async function analyzeAllProtocols(): Promise<ProtocolHealth[]> {
  const protocols = Object.keys(MOCK_HEALTH_DATA);
  const results = await Promise.all(protocols.map(p => analyzeProtocolRisk(p)));
  
  // Sort by risk (highest first)
  return results.sort((a, b) => b.overallRisk - a.overallRisk);
}

/**
 * Get active alerts across all monitored protocols
 */
export async function getActiveAlerts(
  minSeverity: AlertSeverity = 'medium'
): Promise<{ protocol: string; alerts: RugPullAlert[] }[]> {
  const severityThreshold: Record<AlertSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  
  const allHealth = await analyzeAllProtocols();
  
  return allHealth
    .map(h => ({
      protocol: h.protocol,
      alerts: h.alerts.filter(a => severityThreshold[a.severity] <= severityThreshold[minSeverity]),
    }))
    .filter(h => h.alerts.length > 0);
}

/**
 * Generate a human-readable risk summary
 */
export function generateRiskSummary(health: ProtocolHealth): string {
  const lines: string[] = [];
  
  lines.push(`## ${health.protocol.toUpperCase()} Risk Analysis`);
  lines.push('');
  lines.push(`**Status:** ${health.status.toUpperCase()}`);
  lines.push(`**Overall Risk Score:** ${health.overallRisk}/100`);
  lines.push(`**Last Checked:** ${new Date(health.lastChecked).toISOString()}`);
  lines.push('');
  
  // Metrics summary
  lines.push('### Key Metrics');
  lines.push(`- TVL: $${formatNumber(health.metrics.tvl)}`);
  lines.push(`- 24h Change: ${health.metrics.tvlChange24h >= 0 ? '+' : ''}${health.metrics.tvlChange24h.toFixed(1)}%`);
  lines.push(`- Whale Concentration: ${health.metrics.whaleConcentration}%`);
  lines.push(`- Upgrade Authority: ${health.metrics.upgradeAuthorityStatus}`);
  lines.push('');
  
  // Alerts
  if (health.alerts.length > 0) {
    lines.push('### Active Alerts');
    for (const alert of health.alerts) {
      const emoji = alert.severity === 'critical' ? '🚨' : 
                    alert.severity === 'high' ? '⚠️' : 
                    alert.severity === 'medium' ? '📊' : 'ℹ️';
      lines.push(`${emoji} **${alert.severity.toUpperCase()}:** ${alert.title}`);
      lines.push(`   ${alert.description}`);
      lines.push(`   Recommendation: ${alert.recommendation.replace(/_/g, ' ')}`);
      lines.push('');
    }
  } else {
    lines.push('### No Active Alerts ✅');
    lines.push('Protocol appears healthy. Continue monitoring.');
  }
  
  return lines.join('\n');
}

// ============================================================================
// UTILITY
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(0) + 'K';
  return num.toFixed(0);
}

// Export for use in other modules
export { MOCK_HEALTH_DATA, MOCK_WHALE_DATA, PROTOCOL_PROGRAMS, THRESHOLDS };
