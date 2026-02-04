/**
 * API: GET /api/macro-risk
 * 
 * Exposes WARGAMES macro risk data + allocation ceilings.
 * Public endpoint for UI + partner agents.
 */

export const config = {
  runtime: 'edge',
};

const WARGAMES_API = 'https://wargames-api.vercel.app/live/risk';

interface WargamesRisk {
  score: number;
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

interface AllocationCeiling {
  maxDeFiAllocation: number;
  maxSingleProtocol: number;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  reasoning: string;
}

async function fetchMacroRisk(): Promise<WargamesRisk | null> {
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

function calculateAllocationCeiling(risk: WargamesRisk): AllocationCeiling {
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

function formatRiskSummary(risk: WargamesRisk, ceiling: AllocationCeiling): string {
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

export default async function handler(request: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
  };

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  try {
    // Fetch live macro risk
    const risk = await fetchMacroRisk();
    
    if (!risk) {
      return new Response(JSON.stringify({ 
        error: 'WARGAMES API unavailable',
        fallback: {
          maxDeFiAllocation: 60,
          maxSingleProtocol: 30,
          riskLevel: 'medium',
          reasoning: 'Using conservative defaults'
        }
      }), {
        status: 503,
        headers,
      });
    }

    // Calculate allocation ceiling
    const ceiling = calculateAllocationCeiling(risk);
    const summary = formatRiskSummary(risk, ceiling);

    const response = {
      risk,
      ceiling,
      summary,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Macro risk API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers,
    });
  }
}
