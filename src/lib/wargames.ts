/**
 * WARGAMES Macro Risk Integration
 * 
 * Fetches global macro risk score (0-100) to adjust DeFi allocation ceilings.
 * Higher risk = lower max allocation to volatile strategies.
 */

export interface WargamesRisk {
  score: number;           // 0-100, higher = more risk
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
  updated: string;
}

export interface AllocationCeiling {
  maxDeFiAllocation: number;  // 0-100%
  maxSingleProtocol: number;  // 0-100%
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  reasoning: string;
}

const WARGAMES_API = 'https://wargames-api.vercel.app/live/risk';

/**
 * Fetch current macro risk from WARGAMES
 */
export async function fetchMacroRisk(): Promise<WargamesRisk | null> {
  try {
    const response = await fetch(WARGAMES_API, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      console.error(`WARGAMES API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    return {
      score: data.score,
      bias: data.bias,
      components: data.components,
      drivers: data.drivers || [],
      fearGreed: {
        value: data.fear_greed?.value || 50,
        classification: data.fear_greed?.value_classification || 'Neutral',
      },
      updated: data.updated,
    };
  } catch (error) {
    console.error('Failed to fetch WARGAMES risk:', error);
    return null;
  }
}

/**
 * Calculate allocation ceiling based on macro risk
 * 
 * Risk Score → Max DeFi Allocation:
 * 0-25:   90% (risk-on, full deployment)
 * 26-50:  70% (neutral, moderate caution)
 * 51-75:  50% (risk-off, defensive)
 * 76-100: 30% (extreme risk, capital preservation)
 */
export function calculateAllocationCeiling(risk: WargamesRisk): AllocationCeiling {
  const score = risk.score;
  
  if (score <= 25) {
    return {
      maxDeFiAllocation: 90,
      maxSingleProtocol: 40,
      riskLevel: 'low',
      reasoning: `Macro risk low (${score}/100). Full deployment to yield strategies.`,
    };
  }
  
  if (score <= 50) {
    return {
      maxDeFiAllocation: 70,
      maxSingleProtocol: 35,
      riskLevel: 'medium',
      reasoning: `Macro risk moderate (${score}/100). Reduced exposure, maintain diversification.`,
    };
  }
  
  if (score <= 75) {
    return {
      maxDeFiAllocation: 50,
      maxSingleProtocol: 25,
      riskLevel: 'high',
      reasoning: `Macro risk elevated (${score}/100). Defensive positioning, ${risk.drivers[0] || 'multiple risk factors'}.`,
    };
  }
  
  return {
    maxDeFiAllocation: 30,
    maxSingleProtocol: 15,
    riskLevel: 'extreme',
    reasoning: `Macro risk extreme (${score}/100). Capital preservation mode. ${risk.drivers.slice(0, 2).join(', ')}.`,
  };
}

/**
 * Get allocation ceiling with fallback
 */
export async function getAllocationCeiling(): Promise<AllocationCeiling> {
  const risk = await fetchMacroRisk();
  
  if (!risk) {
    // Fallback to conservative defaults if API unavailable
    return {
      maxDeFiAllocation: 60,
      maxSingleProtocol: 30,
      riskLevel: 'medium',
      reasoning: 'WARGAMES API unavailable. Using conservative defaults.',
    };
  }
  
  return calculateAllocationCeiling(risk);
}

/**
 * Format risk data for display
 */
export function formatRiskSummary(risk: WargamesRisk, ceiling: AllocationCeiling): string {
  return `
📊 MACRO RISK: ${risk.score}/100 (${risk.bias})
├─ Sentiment: ${risk.components.sentiment}
├─ Geopolitical: ${risk.components.geopolitical}
├─ Economic: ${risk.components.economic}
└─ Crypto: ${risk.components.crypto}

😱 Fear/Greed: ${risk.fearGreed.value} (${risk.fearGreed.classification})

⚠️ Drivers: ${risk.drivers.join(', ') || 'None'}

🎯 ALLOCATION CEILING: ${ceiling.maxDeFiAllocation}% max DeFi
└─ ${ceiling.reasoning}
  `.trim();
}
