/**
 * Audit Trail API - Index (Edge Runtime)
 * 
 * GET /api/audit
 * Returns documentation of available audit endpoints
 */

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  return new Response(JSON.stringify({
    name: 'SolanaYield Audit Trail API',
    version: '1.0.0',
    description: 'Complete transparency into every decision the autonomous agent makes',
    status: 'active',
    purpose: [
      'Regulatory compliance — full audit trail of all decisions',
      'User trust — see exactly why each decision was made',
      'Debugging — replay any decision with full context',
      'Learning — analyze decision patterns over time',
    ],
    endpoints: {
      '/api/audit/decisions': {
        method: 'GET',
        description: 'Query decision history with filters',
        params: {
          type: 'Filter by decision type (hold,rebalance,enter,exit)',
          protocol: 'Filter by protocol (comma-separated)',
          startDate: 'Start date filter (YYYY-MM-DD)',
          endDate: 'End date filter (YYYY-MM-DD)',
          limit: 'Results per page (default: 20)',
        },
      },
      '/api/audit/stats': {
        method: 'GET',
        description: 'Get comprehensive decision statistics',
      },
      '/api/audit/timeline': {
        method: 'GET',
        description: 'Get decision timeline grouped by time period',
        params: {
          groupBy: 'Group by hour or day (default: day)',
        },
      },
      '/api/audit/export': {
        method: 'GET',
        description: 'Export decisions for compliance/audit',
        params: {
          format: 'Export format: json or csv (default: json)',
        },
      },
      '/api/audit/:id': {
        method: 'GET',
        description: 'Get single decision details with full reasoning',
      },
      '/api/audit/replay/:id': {
        method: 'GET',
        description: 'Get full decision replay context including what the agent saw',
      },
    },
    transparency: {
      whatWeTrack: [
        'Every decision timestamp',
        'Decision type (hold/rebalance/enter/exit)',
        'Confidence level (0-100%)',
        'Full reasoning chain',
        'Risk analysis at decision time',
        'Portfolio state snapshot',
        'Available yields considered',
        'Strategy configuration used',
        'Execution status and transaction IDs',
        'Errors (if any)',
      ],
      whyItMatters: [
        'Institutional users require audit trails',
        'Regulators want to see AI decision-making processes',
        'Users deserve to understand what happens with their funds',
        'Transparent AI builds trust in autonomous finance',
      ],
    },
    example: {
      description: 'Sample decision record structure',
      decision: {
        id: '1706918400000-abc123',
        type: 'rebalance',
        timestamp: 1706918400000,
        confidence: 0.82,
        reasoning: 'Moving from Marinade mSOL (7.2% APY, risk: 28) to Kamino USDC (11.5% APY, risk: 25) - better risk-adjusted return',
        riskAnalysis: {
          currentRiskScore: 28,
          proposedRiskScore: 25,
          riskChange: 'decreased',
        },
        executed: true,
        txIds: ['5cGz...'],
      },
    },
  }, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
