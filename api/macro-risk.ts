export const config = {
  runtime: 'edge',
};

interface MacroRiskResponse {
  score: number;
  bias: string;
  components: Record<string, number>;
  drivers: string[];
  fear_greed?: {
    value: number;
    value_classification: string;
  };
  updated: string;
}

const WARGAMES_API = 'https://wargames-api.vercel.app/live/risk';

export default async function handler(request: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    // Fetch from WARGAMES
    const response = await fetch(WARGAMES_API);
    if (!response.ok) {
      throw new Error(`WARGAMES API returned ${response.status}`);
    }
    
    const data: MacroRiskResponse = await response.json();
    
    // Calculate allocation ceiling
    const score = data.score;
    let maxRiskyAllocation: number;
    let recommendation: string;
    
    if (score <= 20) {
      maxRiskyAllocation = 95;
      recommendation = 'Risk-on environment. Full DeFi exposure acceptable.';
    } else if (score <= 40) {
      maxRiskyAllocation = 80;
      recommendation = 'Moderate conditions. Slight caution advised.';
    } else if (score <= 60) {
      maxRiskyAllocation = 65;
      recommendation = 'Neutral macro. Balanced allocation recommended.';
    } else if (score <= 80) {
      maxRiskyAllocation = 40;
      recommendation = 'Elevated risk. Reduce DeFi exposure, increase stables.';
    } else {
      maxRiskyAllocation = 20;
      recommendation = 'High risk environment. Defensive positioning recommended.';
    }
    
    return new Response(JSON.stringify({
      macroRisk: {
        score: data.score,
        bias: data.bias,
        components: data.components,
        drivers: data.drivers,
        fearGreed: data.fear_greed ? {
          value: data.fear_greed.value,
          classification: data.fear_greed.value_classification,
        } : null,
        updatedAt: data.updated,
      },
      allocation: {
        maxRiskyAllocation,
        maxStableAllocation: 100 - maxRiskyAllocation,
        recommendation,
      },
      integration: {
        provider: 'WARGAMES',
        description: 'Macro risk scoring from 8 global data sources',
        docs: 'https://wargames-api.vercel.app',
      },
    }), { headers });
    
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to fetch macro risk data',
      fallback: {
        score: 50,
        maxRiskyAllocation: 65,
        recommendation: 'WARGAMES API unavailable. Using neutral defaults.',
      },
    }), { status: 500, headers });
  }
}
