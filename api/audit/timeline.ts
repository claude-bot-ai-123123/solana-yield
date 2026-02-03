/**
 * Audit Trail API - Decision Timeline (Edge Runtime)
 * 
 * GET /api/audit/timeline
 * Query parameters:
 *   - groupBy: 'hour' | 'day' (default: day)
 */

export const config = {
  runtime: 'edge',
};

const DEMO_TIMELINE_HOURLY = [
  { label: '2026-02-02T18:00', timestamp: 1706896800000, decisions: 3, rebalances: 1, holds: 2, executed: 1, avgConfidence: 76 },
  { label: '2026-02-02T19:00', timestamp: 1706900400000, decisions: 2, rebalances: 0, holds: 2, executed: 0, avgConfidence: 88 },
  { label: '2026-02-02T20:00', timestamp: 1706904000000, decisions: 4, rebalances: 2, holds: 2, executed: 2, avgConfidence: 72 },
  { label: '2026-02-02T21:00', timestamp: 1706907600000, decisions: 1, rebalances: 0, holds: 1, executed: 0, avgConfidence: 95 },
  { label: '2026-02-02T22:00', timestamp: 1706911200000, decisions: 3, rebalances: 1, holds: 1, executed: 2, avgConfidence: 78 },
  { label: '2026-02-02T23:00', timestamp: 1706914800000, decisions: 2, rebalances: 0, holds: 2, executed: 0, avgConfidence: 91 },
  { label: '2026-02-03T00:00', timestamp: 1706918400000, decisions: 3, rebalances: 2, holds: 1, executed: 2, avgConfidence: 82 },
  { label: '2026-02-03T01:00', timestamp: 1706922000000, decisions: 2, rebalances: 0, holds: 2, executed: 0, avgConfidence: 85 },
];

const DEMO_TIMELINE_DAILY = [
  { label: '2026-02-01', timestamp: 1706745600000, decisions: 12, rebalances: 4, holds: 7, executed: 5, avgConfidence: 74 },
  { label: '2026-02-02', timestamp: 1706832000000, decisions: 18, rebalances: 6, holds: 10, executed: 7, avgConfidence: 79 },
  { label: '2026-02-03', timestamp: 1706918400000, decisions: 5, rebalances: 2, holds: 3, executed: 2, avgConfidence: 83 },
];

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const groupBy = url.searchParams.get('groupBy') || 'day';

  const timeline = groupBy === 'hour' ? DEMO_TIMELINE_HOURLY : DEMO_TIMELINE_DAILY;

  return new Response(JSON.stringify({
    success: true,
    description: 'Decision activity timeline',
    groupBy,
    bucketCount: timeline.length,
    timeline,
    visualization: {
      tip: 'Use this data to visualize decision patterns over time',
      chartTypes: ['bar', 'line', 'area'],
      metrics: ['decisions', 'rebalances', 'holds', 'executed', 'avgConfidence'],
    },
  }, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
