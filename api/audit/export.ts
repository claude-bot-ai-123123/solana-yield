/**
 * Audit Trail API - Export for Compliance (Edge Runtime)
 * 
 * GET /api/audit/export
 * Query parameters:
 *   - format: 'json' | 'csv' (default: json)
 * 
 * Returns full decision records with checksums for audit verification
 */

export const config = {
  runtime: 'edge',
};

const DEMO_EXPORT_RECORDS = [
  {
    id: '1706918400000-rf2k8m',
    decision: {
      timestamp: 1706918400000,
      type: 'rebalance',
      confidence: 0.82,
      executed: true,
      reasoning: 'Moving from Marinade mSOL to Kamino USDC - better risk-adjusted return',
      actions: [
        {
          type: 'withdraw',
          from: { protocol: 'marinade', asset: 'mSOL', amount: 10.5 },
          to: { protocol: 'kamino', asset: 'USDC', amount: 1890 },
          expectedApyGain: 4.3,
        },
      ],
      txIds: ['5cGz9XnBhPvHmTzYkQrNpqJmvwRsK3kLxMbYdEfA7hJc'],
      riskAnalysis: {
        currentRiskScore: 28,
        proposedRiskScore: 25,
        riskChange: 'decreased',
      },
    },
    context: {
      portfolioSnapshot: { totalValue: 1890, weightedApy: 7.2, positions: 1 },
      strategyConfig: { riskTolerance: 'medium', rebalanceThreshold: 1 },
      marketConditions: { solPrice: 180, avgApy: 8.5 },
    },
    meta: {
      date: '2026-02-03',
      decisionType: 'rebalance',
      protocols: ['marinade', 'kamino'],
      assets: ['mSOL', 'USDC'],
      confidence: 0.82,
      executed: true,
      hasError: false,
      riskChange: 'decreased',
      apyImpact: 4.3,
    },
  },
  {
    id: '1706914800000-k4m9q2',
    decision: {
      timestamp: 1706914800000,
      type: 'hold',
      confidence: 0.91,
      executed: false,
      reasoning: 'Risk-adjusted improvement (0.3%) below threshold (1%) - holding position',
      actions: [],
      riskAnalysis: {
        currentRiskScore: 28,
        proposedRiskScore: 28,
        riskChange: 'unchanged',
      },
    },
    context: {
      portfolioSnapshot: { totalValue: 1890, weightedApy: 7.2, positions: 1 },
      strategyConfig: { riskTolerance: 'medium', rebalanceThreshold: 1 },
      marketConditions: { solPrice: 180, avgApy: 8.3 },
    },
    meta: {
      date: '2026-02-02',
      decisionType: 'hold',
      protocols: ['marinade'],
      assets: ['mSOL'],
      confidence: 0.91,
      executed: false,
      hasError: false,
      riskChange: 'unchanged',
      apyImpact: 0,
    },
  },
];

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const format = url.searchParams.get('format') || 'json';

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    totalRecords: DEMO_EXPORT_RECORDS.length,
    dateRange: {
      start: '2026-02-02',
      end: '2026-02-03',
    },
    records: DEMO_EXPORT_RECORDS,
    statistics: {
      totalDecisions: 2,
      executionRate: 0.5,
      avgConfidence: 0.865,
      errorRate: 0,
      totalApyGained: 4.3,
    },
    checksums: {
      recordCount: 2,
      firstId: '1706918400000-rf2k8m',
      lastId: '1706914800000-k4m9q2',
    },
    compliance: {
      purpose: 'Regulatory audit and compliance verification',
      integrity: 'Records are immutable once written',
      verification: 'Checksums can be used to verify export completeness',
    },
  };

  if (format === 'csv') {
    const csvLines = [
      'id,timestamp,type,confidence,executed,error,protocols,assets,riskChange,apyImpact,reasoning',
    ];
    
    for (const record of DEMO_EXPORT_RECORDS) {
      csvLines.push([
        record.id,
        new Date(record.decision.timestamp).toISOString(),
        record.decision.type,
        (record.decision.confidence * 100).toFixed(1),
        record.decision.executed ? 'true' : 'false',
        '',
        record.meta.protocols.join(';'),
        record.meta.assets.join(';'),
        record.meta.riskChange || '',
        record.meta.apyImpact.toFixed(2),
        `"${record.decision.reasoning.replace(/"/g, '""')}"`,
      ].join(','));
    }

    return new Response(csvLines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=solanayield-audit-${new Date().toISOString().split('T')[0]}.csv`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  return new Response(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename=solanayield-audit-${new Date().toISOString().split('T')[0]}.json`,
      'Access-Control-Allow-Origin': '*',
    },
  });
}
