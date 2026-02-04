/**
 * WARGAMES Macro Risk Integration
 * 
 * Uses WARGAMES API to factor global macro conditions into allocation decisions.
 * High macro risk → reduce DeFi exposure, increase stablecoin allocation.
 */

export interface MacroRiskData {
  score: number;           // 0-100 overall risk
  bias: 'risk-on' | 'neutral' | 'risk-off';
  components: {
    sentiment: number;
    geopolitical: number;
    economic: number;
    crypto: number;
  };
  drivers: string[];
  fearGreed: {
    value: number;
    classification: string;
  };
  updatedAt: string;
}

export interface AllocationCeiling {
  maxRiskyAllocation: number;  // 0-100%
  reason: string;
  macroScore: number;
}

const WARGAMES_API = 'https://wargames-api.vercel.app/live/risk';

// Cache to avoid hammering the API
let cachedRisk: MacroRiskData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch current macro risk from WARGAMES
 */
export async function getMacroRisk(): Promise<MacroRiskData> {
  const now = Date.now();
  
  // Return cached if fresh
  if (cachedRisk && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedRisk;
  }
  
  try {
    const response = await fetch(WARGAMES_API);
    if (!response.ok) {
      throw new Error(`WARGAMES API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    cachedRisk = {
      score: data.score,
      bias: data.bias,
      components: data.components,
      drivers: data.drivers || [],
      fearGreed: {
        value: data.fear_greed?.value ?? 50,
        classification: data.fear_greed?.value_classification ?? 'Neutral',
      },
      updatedAt: data.updated,
    };
    cacheTimestamp = now;
    
    return cachedRisk;
  } catch (error) {
    // Return safe defaults on error
    console.error('WARGAMES API error:', error);
    return {
      score: 50,
      bias: 'neutral',
      components: { sentiment: 50, geopolitical: 50, economic: 50, crypto: 50 },
      drivers: ['WARGAMES API unavailable'],
      fearGreed: { value: 50, classification: 'Neutral' },
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Calculate allocation ceiling based on macro risk
 * 
 * Risk Score → Max Risky Allocation
 * 0-20  (low risk)    → 95% max in DeFi
 * 21-40 (moderate)    → 80% max
 * 41-60 (neutral)     → 65% max
 * 61-80 (elevated)    → 40% max
 * 81-100 (high risk)  → 20% max, mostly stables
 */
export function calculateAllocationCeiling(macroRisk: MacroRiskData): AllocationCeiling {
  const score = macroRisk.score;
  
  let maxRiskyAllocation: number;
  let reason: string;
  
  if (score <= 20) {
    maxRiskyAllocation = 95;
    reason = 'Low macro risk — full DeFi exposure allowed';
  } else if (score <= 40) {
    maxRiskyAllocation = 80;
    reason = 'Moderate macro risk — slight caution advised';
  } else if (score <= 60) {
    maxRiskyAllocation = 65;
    reason = `Neutral conditions (${macroRisk.bias}) — balanced allocation`;
  } else if (score <= 80) {
    maxRiskyAllocation = 40;
    reason = `Elevated risk (${score}/100) — reduce exposure. Drivers: ${macroRisk.drivers.slice(0, 2).join(', ')}`;
  } else {
    maxRiskyAllocation = 20;
    reason = `High macro risk (${score}/100) — defensive mode. ${macroRisk.fearGreed.classification}`;
  }
  
  return {
    maxRiskyAllocation,
    reason,
    macroScore: score,
  };
}

/**
 * Adjust allocations based on macro risk ceiling
 */
export function applyMacroCeiling(
  allocations: Array<{ protocol: string; percentage: number; risk: string }>,
  ceiling: AllocationCeiling
): Array<{ protocol: string; percentage: number; risk: string; adjusted: boolean }> {
  const maxRisky = ceiling.maxRiskyAllocation;
  
  // Calculate current risky allocation (non-stablecoin)
  let totalRisky = 0;
  const adjusted = allocations.map(a => {
    const isRisky = a.risk !== 'low'; // Assume 'low' = stablecoins
    if (isRisky) totalRisky += a.percentage;
    return { ...a, isRisky, adjusted: false };
  });
  
  // If within ceiling, no adjustment needed
  if (totalRisky <= maxRisky) {
    return adjusted.map(a => ({ ...a, adjusted: false }));
  }
  
  // Scale down risky allocations proportionally
  const scaleFactor = maxRisky / totalRisky;
  let freedUp = 0;
  
  const scaled = adjusted.map(a => {
    if (a.isRisky) {
      const newPct = Math.round(a.percentage * scaleFactor);
      freedUp += a.percentage - newPct;
      return { ...a, percentage: newPct, adjusted: true };
    }
    return a;
  });
  
  // Add freed allocation to stables (or create a stable position)
  const stableIdx = scaled.findIndex(a => !a.isRisky);
  if (stableIdx >= 0) {
    scaled[stableIdx].percentage += Math.round(freedUp);
    scaled[stableIdx].adjusted = true;
  } else {
    scaled.push({
      protocol: 'USDC (safe haven)',
      percentage: Math.round(freedUp),
      risk: 'low',
      isRisky: false,
      adjusted: true,
    });
  }
  
  return scaled.map(({ isRisky, ...rest }) => rest);
}

export default {
  getMacroRisk,
  calculateAllocationCeiling,
  applyMacroCeiling,
};
