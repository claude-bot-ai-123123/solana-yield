export const config = {
  runtime: 'edge',
};

// ============================================================================
// TRUST SCORE SYSTEM - "Moody's for DeFi"
// 0-100 rating with transparent factor breakdown
// ============================================================================

interface TrustFactor {
  name: string;
  weight: number;
  value: number;       // 0-100 raw score
  weighted: number;    // value * weight
  explanation: string;
}

interface ProtocolTrustScore {
  protocol: string;
  score: number;
  grade: string;
  factors: TrustFactor[];
  lastUpdated: string;
  methodology: string;
}

// Protocol metadata - curated data for hackathon MVP
// In production, this would pull from multiple data sources
const PROTOCOL_DATA: Record<string, {
  name: string;
  launchDate: string;      // Protocol launch date
  audits: string[];        // Known audit firms
  exploits: { date: string; amount: string; description: string }[];
  teamDoxxed: boolean;
  teamMembers?: string[];  // Public team members if doxxed
  category: string;
}> = {
  kamino: {
    name: 'Kamino Finance',
    launchDate: '2022-09-01',
    audits: ['OtterSec', 'Sec3', 'Neodyme'],
    exploits: [],
    teamDoxxed: true,
    teamMembers: ['Gianmarco Guazzo', 'Gonzalo Sobral'],
    category: 'Lending/Liquidity',
  },
  drift: {
    name: 'Drift Protocol',
    launchDate: '2021-11-01',
    audits: ['Kudelski Security', 'OtterSec', 'Trail of Bits'],
    exploits: [
      { date: '2022-05-11', amount: '$0', description: 'Oracle manipulation attempt (prevented)' }
    ],
    teamDoxxed: true,
    teamMembers: ['Cindy Leow', 'David Lu'],
    category: 'Perpetuals',
  },
  marginfi: {
    name: 'marginfi',
    launchDate: '2022-12-01',
    audits: ['OtterSec', 'Zellic'],
    exploits: [],
    teamDoxxed: true,
    teamMembers: ['Mac Naggar', 'Edgar Pavlovsky'],
    category: 'Lending',
  },
  jupiter: {
    name: 'Jupiter',
    launchDate: '2021-10-01',
    audits: ['OtterSec', 'Offside Labs'],
    exploits: [],
    teamDoxxed: true,
    teamMembers: ['Meow', 'Ben Chow', 'SiongOng'],
    category: 'DEX Aggregator',
  },
  raydium: {
    name: 'Raydium',
    launchDate: '2021-02-01',
    audits: ['Kudelski Security', 'SlowMist'],
    exploits: [
      { date: '2022-12-16', amount: '$4.4M', description: 'Private key compromise (hot wallet)' }
    ],
    teamDoxxed: false,
    category: 'AMM/DEX',
  },
};

// Fetch TVL data from DeFiLlama
async function fetchTVLData(): Promise<Record<string, { tvl: number; tvl7dChange: number; tvl30dChange: number }>> {
  try {
    const response = await fetch('https://api.llama.fi/protocols');
    const protocols = await response.json();
    
    const tvlData: Record<string, any> = {};
    
    for (const proto of protocols) {
      const key = proto.slug?.toLowerCase() || proto.name?.toLowerCase();
      if (Object.keys(PROTOCOL_DATA).some(p => key?.includes(p))) {
        const matchedKey = Object.keys(PROTOCOL_DATA).find(p => key?.includes(p));
        if (matchedKey && proto.tvl) {
          tvlData[matchedKey] = {
            tvl: proto.tvl,
            tvl7dChange: proto.change_7d || 0,
            tvl30dChange: proto.change_1m || 0,
          };
        }
      }
    }
    
    return tvlData;
  } catch (err) {
    console.error('Failed to fetch TVL data:', err);
    return {};
  }
}

// Calculate age score (older = more trusted)
function calculateAgeScore(launchDate: string): { score: number; explanation: string } {
  const launch = new Date(launchDate);
  const now = new Date();
  const monthsOld = Math.floor((now.getTime() - launch.getTime()) / (1000 * 60 * 60 * 24 * 30));
  
  let score: number;
  let tier: string;
  
  if (monthsOld >= 36) {
    score = 100;
    tier = 'veteran (3+ years)';
  } else if (monthsOld >= 24) {
    score = 90;
    tier = 'established (2-3 years)';
  } else if (monthsOld >= 12) {
    score = 75;
    tier = 'maturing (1-2 years)';
  } else if (monthsOld >= 6) {
    score = 50;
    tier = 'growing (6-12 months)';
  } else {
    score = 25;
    tier = 'new (<6 months)';
  }
  
  return {
    score,
    explanation: `Protocol is ${monthsOld} months old (${tier}). Longer track record increases trust.`,
  };
}

// Calculate audit score
function calculateAuditScore(audits: string[]): { score: number; explanation: string } {
  const tierOneAuditors = ['Trail of Bits', 'OtterSec', 'Zellic', 'Kudelski Security', 'Neodyme'];
  const tierTwoAuditors = ['Sec3', 'SlowMist', 'Offside Labs', 'Certik'];
  
  if (audits.length === 0) {
    return { score: 0, explanation: 'No known audits. High risk.' };
  }
  
  const tierOneCount = audits.filter(a => tierOneAuditors.some(t => a.includes(t))).length;
  const tierTwoCount = audits.filter(a => tierTwoAuditors.some(t => a.includes(t))).length;
  const totalAudits = audits.length;
  
  let score = Math.min(100, tierOneCount * 30 + tierTwoCount * 15 + totalAudits * 5);
  
  const auditorNames = audits.slice(0, 3).join(', ');
  const explanation = `${totalAudits} audit(s) completed by ${auditorNames}${totalAudits > 3 ? ' +more' : ''}. ${tierOneCount > 0 ? `Includes ${tierOneCount} top-tier auditor(s).` : ''}`;
  
  return { score, explanation };
}

// Calculate exploit/incident score (inverse - no exploits = high score)
function calculateExploitScore(exploits: { date: string; amount: string }[]): { score: number; explanation: string } {
  if (exploits.length === 0) {
    return { score: 100, explanation: 'No known exploits or security incidents. Clean track record.' };
  }
  
  // Penalize based on recency and severity
  const now = new Date();
  let penalty = 0;
  
  for (const exploit of exploits) {
    const exploitDate = new Date(exploit.date);
    const monthsAgo = Math.floor((now.getTime() - exploitDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    // Parse amount (rough estimate)
    const amountMatch = exploit.amount.match(/\$?([\d.]+)(M|K)?/i);
    let amountUsd = 0;
    if (amountMatch) {
      amountUsd = parseFloat(amountMatch[1]);
      if (amountMatch[2]?.toUpperCase() === 'M') amountUsd *= 1_000_000;
      if (amountMatch[2]?.toUpperCase() === 'K') amountUsd *= 1_000;
    }
    
    // Recent exploits penalized more
    const recencyFactor = monthsAgo < 6 ? 1.5 : monthsAgo < 12 ? 1.2 : monthsAgo < 24 ? 1.0 : 0.7;
    
    // Amount factor
    const amountFactor = amountUsd > 10_000_000 ? 50 : amountUsd > 1_000_000 ? 35 : amountUsd > 100_000 ? 20 : 10;
    
    penalty += amountFactor * recencyFactor;
  }
  
  const score = Math.max(0, 100 - penalty);
  const explanation = `${exploits.length} historical incident(s). Most recent: ${exploits[0].date}. Recovered protocols can rebuild trust over time.`;
  
  return { score: Math.round(score), explanation };
}

// Calculate team reputation score
function calculateTeamScore(teamDoxxed: boolean, teamMembers?: string[]): { score: number; explanation: string } {
  if (!teamDoxxed) {
    return { 
      score: 40, 
      explanation: 'Anonymous team. Higher counterparty risk but common in DeFi.' 
    };
  }
  
  const memberCount = teamMembers?.length || 0;
  let score = 70; // Base for doxxed team
  
  if (memberCount >= 3) score += 15;
  else if (memberCount >= 2) score += 10;
  else if (memberCount >= 1) score += 5;
  
  // Additional points for established reputation (hardcoded for MVP)
  score += 15; // Assume doxxed teams in our list have good reputation
  
  const members = teamMembers?.slice(0, 3).join(', ') || 'undisclosed';
  const explanation = `Doxxed team with public identities (${members}${memberCount > 3 ? ' +more' : ''}). Increases accountability.`;
  
  return { score: Math.min(100, score), explanation };
}

// Calculate TVL stability score
function calculateTVLScore(
  tvl: number, 
  change7d: number, 
  change30d: number
): { score: number; explanation: string } {
  // Base score from TVL size
  let score = 0;
  let tvlTier: string;
  
  if (tvl >= 1_000_000_000) {
    score = 90;
    tvlTier = 'Tier 1 ($1B+)';
  } else if (tvl >= 500_000_000) {
    score = 80;
    tvlTier = 'Tier 2 ($500M+)';
  } else if (tvl >= 100_000_000) {
    score = 70;
    tvlTier = 'Tier 3 ($100M+)';
  } else if (tvl >= 50_000_000) {
    score = 60;
    tvlTier = 'Mid-tier ($50M+)';
  } else if (tvl >= 10_000_000) {
    score = 45;
    tvlTier = 'Emerging ($10M+)';
  } else {
    score = 25;
    tvlTier = 'Small (<$10M)';
  }
  
  // Adjust for stability
  // Penalize large drops, reward stability
  if (change30d < -30) score -= 20;
  else if (change30d < -15) score -= 10;
  else if (change30d > -5 && change30d < 20) score += 10; // Stable
  
  score = Math.max(0, Math.min(100, score));
  
  const changeDirection = change30d >= 0 ? '+' : '';
  const explanation = `TVL: $${formatNumber(tvl)} (${tvlTier}). 30d change: ${changeDirection}${change30d?.toFixed(1) || '0'}%. ${change30d < -15 ? 'Recent TVL decline is concerning.' : 'TVL remains stable.'}`;
  
  return { score, explanation };
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(0) + 'K';
  return num.toString();
}

function getGrade(score: number): string {
  if (score >= 90) return 'AAA';
  if (score >= 85) return 'AA+';
  if (score >= 80) return 'AA';
  if (score >= 75) return 'A+';
  if (score >= 70) return 'A';
  if (score >= 65) return 'BBB+';
  if (score >= 60) return 'BBB';
  if (score >= 55) return 'BB+';
  if (score >= 50) return 'BB';
  if (score >= 45) return 'B+';
  if (score >= 40) return 'B';
  if (score >= 30) return 'CCC';
  return 'D';
}

async function calculateTrustScore(protocolKey: string): Promise<ProtocolTrustScore | null> {
  const data = PROTOCOL_DATA[protocolKey.toLowerCase()];
  if (!data) return null;
  
  // Fetch TVL data
  const tvlData = await fetchTVLData();
  const protocolTvl = tvlData[protocolKey] || { tvl: 50_000_000, tvl7dChange: 0, tvl30dChange: 0 };
  
  // Calculate all factors
  const ageResult = calculateAgeScore(data.launchDate);
  const auditResult = calculateAuditScore(data.audits);
  const exploitResult = calculateExploitScore(data.exploits);
  const teamResult = calculateTeamScore(data.teamDoxxed, data.teamMembers);
  const tvlResult = calculateTVLScore(protocolTvl.tvl, protocolTvl.tvl7dChange, protocolTvl.tvl30dChange);
  
  // Factor weights (must sum to 1.0)
  const factors: TrustFactor[] = [
    {
      name: 'Audit Status',
      weight: 0.25,
      value: auditResult.score,
      weighted: Math.round(auditResult.score * 0.25 * 100) / 100,
      explanation: auditResult.explanation,
    },
    {
      name: 'Exploit History',
      weight: 0.20,
      value: exploitResult.score,
      weighted: Math.round(exploitResult.score * 0.20 * 100) / 100,
      explanation: exploitResult.explanation,
    },
    {
      name: 'TVL Stability',
      weight: 0.20,
      value: tvlResult.score,
      weighted: Math.round(tvlResult.score * 0.20 * 100) / 100,
      explanation: tvlResult.explanation,
    },
    {
      name: 'Protocol Age',
      weight: 0.15,
      value: ageResult.score,
      weighted: Math.round(ageResult.score * 0.15 * 100) / 100,
      explanation: ageResult.explanation,
    },
    {
      name: 'Team Reputation',
      weight: 0.20,
      value: teamResult.score,
      weighted: Math.round(teamResult.score * 0.20 * 100) / 100,
      explanation: teamResult.explanation,
    },
  ];
  
  // Calculate final score
  const totalScore = Math.round(factors.reduce((sum, f) => sum + f.weighted, 0));
  
  return {
    protocol: data.name,
    score: totalScore,
    grade: getGrade(totalScore),
    factors,
    lastUpdated: new Date().toISOString(),
    methodology: 'SolanaYield Trust Score v1.0 - Weighted average of audit status, exploit history, TVL stability, protocol age, and team reputation. Scores update dynamically based on on-chain and market data.',
  };
}

export default async function handler(request: Request) {
  const headers = { 
    'Content-Type': 'application/json', 
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=300', // Cache for 5 mins
  };

  const url = new URL(request.url);
  const protocol = url.searchParams.get('protocol');
  const all = url.searchParams.get('all') === 'true';

  try {
    // Single protocol lookup
    if (protocol) {
      const trustScore = await calculateTrustScore(protocol);
      
      if (!trustScore) {
        return new Response(JSON.stringify({ 
          error: 'Protocol not found',
          available: Object.keys(PROTOCOL_DATA),
        }), { status: 404, headers });
      }
      
      return new Response(JSON.stringify(trustScore), { headers });
    }
    
    // Return all protocols
    if (all) {
      const scores: ProtocolTrustScore[] = [];
      
      for (const key of Object.keys(PROTOCOL_DATA)) {
        const score = await calculateTrustScore(key);
        if (score) scores.push(score);
      }
      
      // Sort by score descending
      scores.sort((a, b) => b.score - a.score);
      
      return new Response(JSON.stringify({
        count: scores.length,
        protocols: scores,
        methodology: 'SolanaYield Trust Score v1.0',
        factorWeights: {
          auditStatus: '25%',
          exploitHistory: '20%',
          tvlStability: '20%',
          protocolAge: '15%',
          teamReputation: '20%',
        },
      }), { headers });
    }
    
    // Default: return overview + available protocols
    return new Response(JSON.stringify({
      name: 'SolanaYield Trust Score API',
      version: '1.0.0',
      description: 'Moody\'s-style trust ratings for Solana DeFi protocols',
      usage: {
        single: '/api/trust-score?protocol=kamino',
        all: '/api/trust-score?all=true',
      },
      available_protocols: Object.keys(PROTOCOL_DATA),
      gradeScale: {
        'AAA': '90-100 - Highest trust, institutional grade',
        'AA+/AA': '80-89 - Very high trust, well established',
        'A+/A': '70-79 - High trust, proven track record',
        'BBB+/BBB': '60-69 - Moderate trust, some concerns',
        'BB+/BB': '50-59 - Speculative, higher risk',
        'B+/B': '40-49 - High risk, limited trust',
        'CCC/D': '<40 - Very high risk, avoid',
      },
      factors: [
        { name: 'Audit Status', weight: '25%', description: 'Number and quality of security audits' },
        { name: 'Exploit History', weight: '20%', description: 'Historical security incidents and recoveries' },
        { name: 'TVL Stability', weight: '20%', description: 'Total Value Locked size and recent trends' },
        { name: 'Protocol Age', weight: '15%', description: 'Time since launch (Lindy effect)' },
        { name: 'Team Reputation', weight: '20%', description: 'Team transparency and track record' },
      ],
    }), { headers });
    
  } catch (err) {
    console.error('Trust score error:', err);
    return new Response(JSON.stringify({ 
      error: 'Failed to calculate trust score',
      details: err instanceof Error ? err.message : 'Unknown error',
    }), { status: 500, headers });
  }
}
