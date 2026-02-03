/**
 * Audit Trail API - Decision History Query (Edge Runtime)
 * 
 * GET /api/audit/decisions
 * Query parameters:
 *   - type: Decision type filter (hold,rebalance,enter,exit)
 *   - protocol: Protocol filter
 *   - startDate/endDate: Date range
 *   - limit/offset: Pagination
 */

export const config = {
  runtime: 'edge',
};

// Demo decision history showing the audit trail format
const DEMO_DECISIONS = [
  {
    id: '1706918400000-rf2k8m',
    timestamp: 1706918400000,
    time: '2026-02-03T00:00:00.000Z',
    type: 'rebalance',
    confidence: 82,
    executed: true,
    hasError: false,
    protocols: ['marinade', 'kamino'],
    assets: ['mSOL', 'USDC'],
    riskChange: 'decreased',
    apyImpact: 4.3,
    reasoningPreview: '📊 **Risk-Adjusted Analysis**: Moving from Marinade mSOL (7.2% APY, risk: 28) to Kamino USDC vault (11.5% APY, risk: 25)',
    fullReasoning: `📊 **Risk-Adjusted Analysis**
Found 12 opportunities within risk tolerance

🏆 **Top Recommendation:** USDC on kamino
   • Raw APY: 11.50%
   • Risk-adjusted APY: 9.43%
   • Risk Score: 25/100
   • Sharpe Ratio: 2.31
   • TVL: $89.2M

✅ Audited by OtterSec, Halborn
✅ Insurance fund available
✅ Battle-tested (2+ years)

📈 **Portfolio Comparison**
   • Current APY: 7.20%
   • Projected APY: 11.50%
   • Risk-adjusted improvement: 2.23%

🔄 **Decision: REBALANCE**
Moving to better risk-adjusted opportunities
Risk change: decreased`,
    txIds: ['5cGz9XnBhPvHmTzYkQrNpqJmvwRsK3kLxMbYdEfA7hJc'],
  },
  {
    id: '1706914800000-k4m9q2',
    timestamp: 1706914800000,
    time: '2026-02-02T23:00:00.000Z',
    type: 'hold',
    confidence: 91,
    executed: false,
    hasError: false,
    protocols: ['marinade'],
    assets: ['mSOL'],
    riskChange: 'unchanged',
    apyImpact: 0,
    reasoningPreview: '⏸️ **Decision: HOLD** — Risk-adjusted improvement (0.3%) below threshold (1%)',
    fullReasoning: `📊 **Risk-Adjusted Analysis**
Found 8 opportunities within risk tolerance

Current position: mSOL on Marinade
   • Current APY: 7.20%
   • Risk Score: 28/100

Best alternative: JitoSOL staking
   • Raw APY: 7.8%
   • Risk-adjusted APY: 6.9%
   • Potential improvement: 0.3%

⏸️ **Decision: HOLD**
Improvement of 0.3% is below rebalance threshold of 1%
Transaction costs would exceed benefit
Holding current position`,
  },
  {
    id: '1706911200000-p8n3x7',
    timestamp: 1706911200000,
    time: '2026-02-02T22:00:00.000Z',
    type: 'enter',
    confidence: 78,
    executed: true,
    hasError: false,
    protocols: ['marinade'],
    assets: ['SOL', 'mSOL'],
    riskChange: 'increased',
    apyImpact: 7.2,
    reasoningPreview: '💡 Portfolio is empty — entering Marinade mSOL staking (7.2% APY, risk: 28/100)',
    fullReasoning: `📊 **Risk-Adjusted Analysis**
Portfolio value: $0.00 (empty)

Top recommendations for medium risk tolerance:

🥇 **mSOL** on marinade (STRONG)
   APY: 7.20% raw → 5.88% risk-adjusted
   Risk: 28/100 | Sharpe: 1.84 | TVL: $412.5M
   ✅ Battle-tested (2+ years), No incidents in 2+ years

🥈 **USDC** on kamino (STRONG)
   APY: 11.50% raw → 9.43% risk-adjusted
   Risk: 25/100 | Sharpe: 2.31 | TVL: $89.2M
   ✅ Audited by OtterSec, Halborn

💡 Portfolio is empty — recommending initial entry
Selected: Marinade mSOL for best risk-adjusted stability`,
    txIds: ['3dKm7xWbPqHnTyYkQrNpqJmvwRsK3kLxMbYdEfA7hJa'],
  },
  {
    id: '1706907600000-w2m5k9',
    timestamp: 1706907600000,
    time: '2026-02-02T21:00:00.000Z',
    type: 'hold',
    confidence: 95,
    executed: false,
    hasError: false,
    protocols: [],
    assets: [],
    riskChange: 'unchanged',
    apyImpact: 0,
    reasoningPreview: '⏸️ **Decision: HOLD** — No opportunities within risk tolerance meet threshold',
  },
];

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
  // Parse query params
  const typeFilter = url.searchParams.get('type')?.split(',') || [];
  const protocolFilter = url.searchParams.get('protocol')?.split(',') || [];
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  // Filter decisions
  let filtered = [...DEMO_DECISIONS];
  
  if (typeFilter.length > 0) {
    filtered = filtered.filter(d => typeFilter.includes(d.type));
  }
  
  if (protocolFilter.length > 0) {
    filtered = filtered.filter(d => 
      d.protocols.some(p => protocolFilter.includes(p))
    );
  }

  // Apply pagination
  const paginated = filtered.slice(offset, offset + limit);

  return new Response(JSON.stringify({
    success: true,
    description: 'Decision audit trail - every decision with full reasoning',
    query: {
      type: typeFilter.length > 0 ? typeFilter : 'all',
      protocol: protocolFilter.length > 0 ? protocolFilter : 'all',
      limit,
      offset,
    },
    count: paginated.length,
    total: filtered.length,
    decisions: paginated,
    pagination: {
      limit,
      offset,
      hasMore: offset + limit < filtered.length,
    },
    note: 'This is demo data showing the audit trail format. In production, decisions are persisted and queryable.',
  }, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
