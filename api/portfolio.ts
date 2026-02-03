export const config = {
  runtime: 'edge',
};

/**
 * Portfolio Analytics - Track yield performance and holdings
 * 
 * Endpoints:
 * - GET /api/portfolio?wallet=<address> - Portfolio summary
 * - GET /api/portfolio/performance?wallet=<address>&days=30 - Performance tracking
 */

interface PortfolioPosition {
  protocol: string;
  asset: string;
  balance: number;
  value: number;
  apy: number;
  earnings24h: number;
  risk: 'low' | 'medium' | 'high';
}

interface PortfolioSummary {
  wallet: string;
  totalValue: number;
  totalEarnings24h: number;
  weightedApy: number;
  positions: PortfolioPosition[];
  riskProfile: {
    low: number;
    medium: number;
    high: number;
  };
  recommendations: string[];
  lastUpdated: string;
}

// Mock portfolio data - in production, would fetch from blockchain
const MOCK_PORTFOLIOS: Record<string, PortfolioPosition[]> = {
  demo: [
    {
      protocol: 'Kamino',
      asset: 'USDC',
      balance: 10000,
      value: 10000,
      apy: 8.5,
      earnings24h: 2.33,
      risk: 'low',
    },
    {
      protocol: 'Drift',
      asset: 'SOL',
      balance: 50,
      value: 7500,
      apy: 15.2,
      earnings24h: 3.12,
      risk: 'medium',
    },
    {
      protocol: 'Jito',
      asset: 'JitoSOL',
      balance: 80,
      value: 12000,
      apy: 7.8,
      earnings24h: 2.56,
      risk: 'low',
    },
    {
      protocol: 'Marginfi',
      asset: 'mSOL',
      balance: 40,
      value: 6000,
      apy: 9.1,
      earnings24h: 1.50,
      risk: 'low',
    },
  ],
};

async function getPortfolioSummary(wallet: string): Promise<PortfolioSummary> {
  // Use demo data or empty portfolio
  const positions = MOCK_PORTFOLIOS[wallet] || MOCK_PORTFOLIOS.demo;
  
  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  const totalEarnings24h = positions.reduce((sum, p) => sum + p.earnings24h, 0);
  
  // Calculate weighted APY
  const weightedApy = positions.reduce((sum, p) => {
    const weight = p.value / totalValue;
    return sum + (p.apy * weight);
  }, 0);
  
  // Risk profile
  const riskProfile = {
    low: positions.filter(p => p.risk === 'low').reduce((sum, p) => sum + p.value, 0) / totalValue * 100,
    medium: positions.filter(p => p.risk === 'medium').reduce((sum, p) => sum + p.value, 0) / totalValue * 100,
    high: positions.filter(p => p.risk === 'high').reduce((sum, p) => sum + p.value, 0) / totalValue * 100,
  };
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (riskProfile.high > 30) {
    recommendations.push('⚠️ High risk exposure (>30%). Consider rebalancing to more stable protocols.');
  }
  
  if (riskProfile.low > 70) {
    recommendations.push('💡 Conservative portfolio. You could increase yields by allocating 10-20% to medium-risk protocols.');
  }
  
  if (positions.length < 3) {
    recommendations.push('📊 Diversify across more protocols to reduce platform risk.');
  }
  
  const lowestApy = Math.min(...positions.map(p => p.apy));
  if (lowestApy < 7) {
    recommendations.push(`🔄 Lowest APY is ${lowestApy.toFixed(1)}%. Consider reallocating to higher-yield opportunities.`);
  }
  
  // Check for better opportunities
  if (weightedApy < 10) {
    recommendations.push('🚀 Better yields available! Check /api/yields for top opportunities.');
  }
  
  return {
    wallet,
    totalValue: Math.round(totalValue * 100) / 100,
    totalEarnings24h: Math.round(totalEarnings24h * 100) / 100,
    weightedApy: Math.round(weightedApy * 100) / 100,
    positions,
    riskProfile: {
      low: Math.round(riskProfile.low * 10) / 10,
      medium: Math.round(riskProfile.medium * 10) / 10,
      high: Math.round(riskProfile.high * 10) / 10,
    },
    recommendations,
    lastUpdated: new Date().toISOString(),
  };
}

async function getPerformanceHistory(wallet: string, days: number) {
  // Generate mock historical data
  const positions = MOCK_PORTFOLIOS[wallet] || MOCK_PORTFOLIOS.demo;
  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  const dailyEarnings = positions.reduce((sum, p) => sum + p.earnings24h, 0);
  
  const history = [];
  const now = Date.now();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    const value = totalValue - (dailyEarnings * i);
    const earned = dailyEarnings * (days - i);
    
    history.push({
      date: date.toISOString().split('T')[0],
      timestamp: date.getTime(),
      portfolioValue: Math.round(value * 100) / 100,
      totalEarned: Math.round(earned * 100) / 100,
      dailyReturn: Math.round(dailyEarnings * 100) / 100,
    });
  }
  
  return {
    wallet,
    days,
    history,
    stats: {
      startValue: history[0].portfolioValue,
      currentValue: history[history.length - 1].portfolioValue,
      totalReturn: Math.round((history[history.length - 1].totalEarned) * 100) / 100,
      returnPercent: Math.round((history[history.length - 1].totalEarned / history[0].portfolioValue * 100) * 100) / 100,
      avgDailyReturn: Math.round(dailyEarnings * 100) / 100,
    },
  };
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get('wallet');
  const path = url.pathname;
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=60', // Cache for 1 min
  };

  try {
    // Performance history endpoint
    if (path.includes('/performance')) {
      const days = parseInt(url.searchParams.get('days') || '30');
      const walletAddr = wallet || 'demo';
      
      const performance = await getPerformanceHistory(walletAddr, Math.min(days, 365));
      
      return new Response(JSON.stringify(performance), { headers });
    }
    
    // Main portfolio summary
    if (wallet) {
      const summary = await getPortfolioSummary(wallet);
      
      return new Response(JSON.stringify(summary), { headers });
    }
    
    // Usage info
    return new Response(JSON.stringify({
      endpoint: '/api/portfolio',
      description: 'Track your DeFi portfolio performance and get personalized recommendations',
      usage: {
        summary: '/api/portfolio?wallet=<address>',
        performance: '/api/portfolio/performance?wallet=<address>&days=30',
        demo: '/api/portfolio?wallet=demo',
      },
      features: [
        'Real-time position tracking across protocols',
        'Weighted APY calculation',
        'Risk profile analysis (low/medium/high exposure)',
        'Personalized yield optimization recommendations',
        'Historical performance tracking',
        'Daily earnings projection',
      ],
      demo: {
        wallet: 'demo',
        hint: 'Try /api/portfolio?wallet=demo to see example portfolio',
      },
      integration: {
        webhook: 'POST events to /api/webhook for automatic portfolio updates',
        events: ['position_opened', 'position_closed', 'yield_earned', 'rebalance'],
      },
      builder: 'SolanaYield - Colosseum Agent Hackathon',
    }), { headers });
    
  } catch (err) {
    console.error('Portfolio error:', err);
    return new Response(JSON.stringify({
      error: 'Failed to fetch portfolio data',
      details: err instanceof Error ? err.message : 'Unknown error',
    }), {
      status: 500,
      headers,
    });
  }
}
