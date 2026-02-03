/**
 * Confidence Score API
 * 
 * GET /api/confidence - Calculate confidence scores for yield opportunities
 * 
 * Query params:
 * - protocol: Filter by protocol name
 * - asset: Filter by asset
 * - format: 'json' | 'ui' (default: ui)
 * - includeMatrix: Include risk x confidence recommendation matrix
 */

import { 
  calculateConfidenceScore, 
  combineRiskAndConfidence,
  ConfidenceScore,
  ConfidenceInput,
  RiskConfidenceMatrix,
} from './lib/confidence';

export const config = {
  runtime: 'edge',
};

// Sample yield data (in production, fetch from real sources)
interface YieldData {
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  risk: string;
  riskScore: number;
  dataTimestamp: number;
  hasApyBreakdown: boolean;
  hasAuditInfo: boolean;
  protocolLaunchDate: string;
  alternativeSources?: { source: string; apy: number; tvl: number }[];
}

async function fetchYieldData(): Promise<YieldData[]> {
  // In production, this would fetch from DeFiLlama, protocol APIs, etc.
  const now = Date.now();
  
  return [
    {
      protocol: 'kamino',
      asset: 'USDC',
      apy: 8.5,
      tvl: 245_000_000,
      risk: 'low',
      riskScore: 25,
      dataTimestamp: now - 5 * 60 * 1000, // 5 min ago
      hasApyBreakdown: true,
      hasAuditInfo: true,
      protocolLaunchDate: '2022-06-01',
      alternativeSources: [
        { source: 'defillama', apy: 8.4, tvl: 244_000_000 },
        { source: 'kamino-api', apy: 8.5, tvl: 245_100_000 },
      ],
    },
    {
      protocol: 'drift',
      asset: 'SOL',
      apy: 12.3,
      tvl: 156_000_000,
      risk: 'medium',
      riskScore: 35,
      dataTimestamp: now - 15 * 60 * 1000, // 15 min ago
      hasApyBreakdown: true,
      hasAuditInfo: true,
      protocolLaunchDate: '2021-11-01',
      alternativeSources: [
        { source: 'defillama', apy: 12.1, tvl: 155_000_000 },
      ],
    },
    {
      protocol: 'jito',
      asset: 'JitoSOL',
      apy: 7.8,
      tvl: 1_200_000_000,
      risk: 'low',
      riskScore: 20,
      dataTimestamp: now - 3 * 60 * 1000, // 3 min ago
      hasApyBreakdown: true,
      hasAuditInfo: true,
      protocolLaunchDate: '2022-11-01',
      alternativeSources: [
        { source: 'defillama', apy: 7.8, tvl: 1_198_000_000 },
        { source: 'jito-api', apy: 7.8, tvl: 1_202_000_000 },
      ],
    },
    {
      protocol: 'marinade',
      asset: 'mSOL',
      apy: 7.2,
      tvl: 890_000_000,
      risk: 'low',
      riskScore: 15,
      dataTimestamp: now - 8 * 60 * 1000, // 8 min ago
      hasApyBreakdown: false,
      hasAuditInfo: true,
      protocolLaunchDate: '2021-07-01',
    },
    {
      protocol: 'mango',
      asset: 'USDC',
      apy: 15.2,
      tvl: 45_000_000,
      risk: 'medium',
      riskScore: 45,
      dataTimestamp: now - 25 * 60 * 1000, // 25 min ago
      hasApyBreakdown: true,
      hasAuditInfo: true,
      protocolLaunchDate: '2021-08-01',
    },
    {
      protocol: 'unknown-defi',
      asset: 'SOL',
      apy: 42.0,
      tvl: 2_500_000,
      risk: 'high',
      riskScore: 70,
      dataTimestamp: now - 3 * 60 * 60 * 1000, // 3 hours ago
      hasApyBreakdown: false,
      hasAuditInfo: false,
      protocolLaunchDate: '2025-12-01',
    },
  ];
}

function convertToConfidenceInput(data: YieldData): ConfidenceInput {
  return {
    protocol: data.protocol,
    asset: data.asset,
    apy: data.apy,
    tvl: data.tvl,
    dataTimestamp: data.dataTimestamp,
    dataSource: 'defillama',
    alternativeSources: data.alternativeSources,
    hasApyBreakdown: data.hasApyBreakdown,
    hasHistoricalData: true, // Simplified
    hasAuditInfo: data.hasAuditInfo,
    hasTvlHistory: true, // Simplified
    isKnownProtocol: !data.protocol.includes('unknown'),
    protocolLaunchDate: data.protocolLaunchDate,
    hasBeenAnalyzedBefore: !data.protocol.includes('unknown'),
    marketVolatility: 'medium',
  };
}

interface ConfidenceResult {
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  confidence: ConfidenceScore;
  riskConfidenceMatrix?: RiskConfidenceMatrix;
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'ui';
  const protocolFilter = url.searchParams.get('protocol');
  const assetFilter = url.searchParams.get('asset');
  const includeMatrix = url.searchParams.get('includeMatrix') !== 'false';
  
  // Fetch yield data
  let yields = await fetchYieldData();
  
  // Apply filters
  if (protocolFilter) {
    yields = yields.filter(y => y.protocol.toLowerCase() === protocolFilter.toLowerCase());
  }
  if (assetFilter) {
    yields = yields.filter(y => y.asset.toLowerCase() === assetFilter.toLowerCase());
  }
  
  // Calculate confidence for each
  const results: ConfidenceResult[] = yields.map(y => {
    const input = convertToConfidenceInput(y);
    const confidence = calculateConfidenceScore(input);
    
    const result: ConfidenceResult = {
      protocol: y.protocol,
      asset: y.asset,
      apy: y.apy,
      tvl: y.tvl,
      confidence,
    };
    
    if (includeMatrix) {
      result.riskConfidenceMatrix = combineRiskAndConfidence(y.riskScore, confidence);
    }
    
    return result;
  });
  
  // Sort by confidence score (highest first)
  results.sort((a, b) => b.confidence.overall - a.confidence.overall);
  
  if (format === 'json') {
    return new Response(JSON.stringify({
      timestamp: Date.now(),
      count: results.length,
      results,
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // UI format
  const html = generateConfidenceUI(results);
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

function generateConfidenceUI(results: ConfidenceResult[]): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confidence Scores | SolanaYield</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
      color: #fff;
      min-height: 100vh;
      padding: 2rem;
    }
    
    .container { max-width: 1400px; margin: 0 auto; }
    
    header {
      text-align: center;
      margin-bottom: 3rem;
    }
    
    h1 {
      font-size: 2.5rem;
      background: linear-gradient(90deg, #00d4ff, #00ff88);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    
    .subtitle {
      color: #888;
      font-size: 1.1rem;
    }
    
    .explanation {
      background: rgba(0, 212, 255, 0.1);
      border: 1px solid rgba(0, 212, 255, 0.3);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    
    .explanation h3 { color: #00d4ff; margin-bottom: 0.5rem; }
    .explanation p { color: #aaa; line-height: 1.6; }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 1.5rem;
    }
    
    .card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 1.5rem;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(0, 212, 255, 0.1);
    }
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }
    
    .card-title {
      font-size: 1.25rem;
      font-weight: 600;
    }
    
    .card-subtitle {
      color: #888;
      font-size: 0.9rem;
    }
    
    .grade {
      font-size: 1.75rem;
      font-weight: 700;
      padding: 0.25rem 0.75rem;
      border-radius: 8px;
      text-align: center;
    }
    
    .grade-a-plus { background: linear-gradient(135deg, #00ff88, #00d4ff); color: #000; }
    .grade-a { background: #00ff88; color: #000; }
    .grade-b { background: #88ff00; color: #000; }
    .grade-c { background: #ffdd00; color: #000; }
    .grade-d { background: #ff8800; color: #000; }
    .grade-f { background: #ff4444; color: #fff; }
    
    .score-bar {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
      margin: 1rem 0;
    }
    
    .score-fill {
      height: 100%;
      background: linear-gradient(90deg, #ff4444, #ffdd00, #00ff88);
      transition: width 0.3s;
    }
    
    .interpretation {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
      font-size: 0.95rem;
      line-height: 1.5;
    }
    
    .factors {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    
    .factor {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 0.75rem;
    }
    
    .factor-name {
      font-size: 0.75rem;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.25rem;
    }
    
    .factor-score {
      font-size: 1.25rem;
      font-weight: 600;
    }
    
    .factor-score.high { color: #00ff88; }
    .factor-score.medium { color: #ffdd00; }
    .factor-score.low { color: #ff8844; }
    .factor-score.very-low { color: #ff4444; }
    
    .flags {
      margin-top: 1rem;
    }
    
    .flag {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      font-size: 0.85rem;
      margin-bottom: 0.5rem;
    }
    
    .flag-boost { color: #00ff88; }
    .flag-penalty { color: #ff8844; }
    
    .matrix {
      margin-top: 1rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      border-left: 3px solid;
    }
    
    .matrix.proceed { border-color: #00ff88; }
    .matrix.caution { border-color: #ffdd00; }
    .matrix.verify { border-color: #ff8844; }
    .matrix.avoid { border-color: #ff4444; }
    
    .matrix-title {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.5rem;
    }
    
    .matrix-rec {
      font-weight: 600;
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
    }
    
    .matrix.proceed .matrix-rec { color: #00ff88; }
    .matrix.caution .matrix-rec { color: #ffdd00; }
    .matrix.verify .matrix-rec { color: #ff8844; }
    .matrix.avoid .matrix-rec { color: #ff4444; }
    
    .recommendations {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .recommendations h4 {
      font-size: 0.85rem;
      color: #888;
      margin-bottom: 0.5rem;
    }
    
    .recommendations ul {
      list-style: none;
      font-size: 0.85rem;
    }
    
    .recommendations li {
      padding: 0.25rem 0;
      padding-left: 1rem;
      position: relative;
    }
    
    .recommendations li:before {
      content: '→';
      position: absolute;
      left: 0;
      color: #00d4ff;
    }
    
    .legend {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      color: #888;
    }
    
    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    
    footer {
      text-align: center;
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      color: #666;
    }
    
    @media (max-width: 500px) {
      .grid { grid-template-columns: 1fr; }
      .factors { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🎯 Confidence Scoring System</h1>
      <p class="subtitle">How confident are we in our analysis? (0-100)</p>
    </header>
    
    <div class="explanation">
      <h3>📊 Risk ≠ Confidence</h3>
      <p>
        <strong>Risk Score</strong> tells you how risky an investment is.<br>
        <strong>Confidence Score</strong> tells you how sure we are about our analysis.<br><br>
        A low-risk investment can still have low confidence if our data is incomplete or stale.
        A high-risk investment can have high confidence if we have excellent data.
        The combination of both helps you make informed decisions.
      </p>
    </div>
    
    <div class="legend">
      <div class="legend-item">
        <div class="legend-dot" style="background: #00ff88;"></div>
        <span>High (80+)</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background: #88ff00;"></div>
        <span>Good (65-79)</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background: #ffdd00;"></div>
        <span>Moderate (50-64)</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background: #ff8844;"></div>
        <span>Low (35-49)</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background: #ff4444;"></div>
        <span>Very Low (&lt;35)</span>
      </div>
    </div>
    
    <div class="grid">
      ${results.map(r => generateResultCard(r)).join('')}
    </div>
    
    <footer>
      <p>SolanaYield Confidence Scoring System | Built for transparency</p>
      <p style="margin-top: 0.5rem;">Add <code>?format=json</code> for raw data</p>
    </footer>
  </div>
</body>
</html>`;
}

function generateResultCard(result: ConfidenceResult): string {
  const { confidence, riskConfidenceMatrix } = result;
  const gradeClass = getGradeClass(confidence.grade);
  
  const matrixClass = riskConfidenceMatrix ? {
    'proceed': 'proceed',
    'proceed_with_caution': 'caution',
    'verify_first': 'verify',
    'avoid': 'avoid',
  }[riskConfidenceMatrix.recommendation] : '';
  
  const formatRec = (rec: string) => rec.replace(/_/g, ' ').toUpperCase();
  
  return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${result.asset} on ${result.protocol}</div>
          <div class="card-subtitle">${result.apy.toFixed(2)}% APY • $${formatNumber(result.tvl)} TVL</div>
        </div>
        <div class="grade ${gradeClass}">${confidence.grade}</div>
      </div>
      
      <div class="score-bar">
        <div class="score-fill" style="width: ${confidence.overall}%;"></div>
      </div>
      <div style="text-align: center; margin-bottom: 1rem;">
        <span style="font-size: 1.5rem; font-weight: 700;">${confidence.overall}</span>
        <span style="color: #888;">/100</span>
      </div>
      
      <div class="interpretation">${confidence.interpretation}</div>
      
      <div class="factors">
        ${Object.entries(confidence.factors).map(([key, factor]) => `
          <div class="factor">
            <div class="factor-name">${formatFactorName(key)}</div>
            <div class="factor-score ${getScoreClass(factor.score)}">${factor.score}</div>
            <div style="font-size: 0.75rem; color: #666; margin-top: 0.25rem;">${factor.reason}</div>
          </div>
        `).join('')}
      </div>
      
      ${confidence.flags.length > 0 ? `
        <div class="flags">
          ${confidence.flags.map(flag => `
            <div class="flag ${flag.type === 'boost' ? 'flag-boost' : 'flag-penalty'}">
              <span>${flag.type === 'boost' ? '✅' : '⚠️'}</span>
              <span>${flag.reason} (${flag.type === 'boost' ? '+' : '-'}${flag.impact})</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      ${riskConfidenceMatrix ? `
        <div class="matrix ${matrixClass}">
          <div class="matrix-title">Risk × Confidence Matrix</div>
          <div class="matrix-rec">${formatRec(riskConfidenceMatrix.recommendation)}</div>
          <div style="font-size: 0.85rem; color: #aaa;">
            Risk: ${riskConfidenceMatrix.risk.grade} (${riskConfidenceMatrix.risk.score}) | 
            Confidence: ${riskConfidenceMatrix.confidence.grade} (${riskConfidenceMatrix.confidence.score})
          </div>
          <div style="font-size: 0.9rem; margin-top: 0.5rem;">${riskConfidenceMatrix.explanation}</div>
        </div>
      ` : ''}
      
      ${confidence.recommendations.length > 0 ? `
        <div class="recommendations">
          <h4>💡 To Improve Confidence:</h4>
          <ul>
            ${confidence.recommendations.slice(0, 3).map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `;
}

function getGradeClass(grade: string): string {
  return {
    'A+': 'grade-a-plus',
    'A': 'grade-a',
    'B': 'grade-b',
    'C': 'grade-c',
    'D': 'grade-d',
    'F': 'grade-f',
  }[grade] || 'grade-c';
}

function getScoreClass(score: number): string {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'low';
  return 'very-low';
}

function formatFactorName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}
