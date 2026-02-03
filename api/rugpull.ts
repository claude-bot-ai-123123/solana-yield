/**
 * Rug Pull Detection API
 * 
 * Real-time risk monitoring for Solana DeFi protocols.
 * "Trust is THE gap in the market" — this fills it.
 * 
 * Endpoints:
 *   /api/rugpull                  - API overview
 *   /api/rugpull?protocol=kamino  - Analyze single protocol
 *   /api/rugpull?all=true         - Analyze all monitored protocols
 *   /api/rugpull?alerts=true      - Get active alerts only
 */

export const config = {
  runtime: 'edge',
};

import {
  analyzeProtocolRisk,
  analyzeAllProtocols,
  getActiveAlerts,
  generateRiskSummary,
  MOCK_HEALTH_DATA,
  AlertSeverity,
} from './lib/rugpull';

export default async function handler(request: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=60', // Cache for 1 min
  };

  const url = new URL(request.url);
  const protocol = url.searchParams.get('protocol');
  const all = url.searchParams.get('all') === 'true';
  const alerts = url.searchParams.get('alerts') === 'true';
  const minSeverity = (url.searchParams.get('minSeverity') || 'medium') as AlertSeverity;
  const format = url.searchParams.get('format') || 'json';

  try {
    // Single protocol analysis
    if (protocol) {
      const health = await analyzeProtocolRisk(protocol);
      
      if (format === 'markdown' || format === 'md') {
        const summary = generateRiskSummary(health);
        return new Response(summary, {
          headers: { 
            ...headers, 
            'Content-Type': 'text/markdown',
          },
        });
      }
      
      return new Response(JSON.stringify({
        protocol: health.protocol,
        status: health.status,
        overallRisk: health.overallRisk,
        riskGrade: getRiskGrade(health.overallRisk),
        lastChecked: new Date(health.lastChecked).toISOString(),
        metrics: {
          tvl: health.metrics.tvl,
          tvlFormatted: formatNumber(health.metrics.tvl),
          tvlChange24h: health.metrics.tvlChange24h,
          tvlChange7d: health.metrics.tvlChange7d,
          whaleConcentration: health.metrics.whaleConcentration,
          liquidityDepth: health.metrics.liquidityDepth,
          upgradeAuthority: health.metrics.upgradeAuthorityStatus,
          mintAuthorityActive: health.metrics.mintAuthorityActive,
          freezeAuthorityActive: health.metrics.freezeAuthorityActive,
        },
        alertCount: health.alerts.length,
        alerts: health.alerts.map(a => ({
          id: a.id,
          type: a.type,
          severity: a.severity,
          title: a.title,
          description: a.description,
          recommendation: a.recommendation,
          riskImpact: `+${a.riskDelta}`,
          evidence: a.evidence,
          timestamp: new Date(a.timestamp).toISOString(),
        })),
        agentRecommendation: getAgentRecommendation(health.overallRisk, health.status),
      }, null, 2), { headers });
    }

    // Active alerts only
    if (alerts) {
      const activeAlerts = await getActiveAlerts(minSeverity);
      
      const totalAlerts = activeAlerts.reduce((sum, p) => sum + p.alerts.length, 0);
      const criticalCount = activeAlerts.reduce(
        (sum, p) => sum + p.alerts.filter(a => a.severity === 'critical').length, 0
      );
      const highCount = activeAlerts.reduce(
        (sum, p) => sum + p.alerts.filter(a => a.severity === 'high').length, 0
      );
      
      return new Response(JSON.stringify({
        timestamp: new Date().toISOString(),
        minSeverity,
        summary: {
          totalAlerts,
          critical: criticalCount,
          high: highCount,
          protocolsAffected: activeAlerts.length,
        },
        marketStatus: criticalCount > 0 ? '🚨 ELEVATED RISK' : 
                      highCount > 0 ? '⚠️ CAUTION' : '✅ NORMAL',
        alerts: activeAlerts.map(p => ({
          protocol: p.protocol,
          alertCount: p.alerts.length,
          alerts: p.alerts.map(a => ({
            severity: a.severity,
            title: a.title,
            type: a.type,
            recommendation: a.recommendation,
          })),
        })),
      }, null, 2), { headers });
    }

    // All protocols analysis
    if (all) {
      const allHealth = await analyzeAllProtocols();
      
      return new Response(JSON.stringify({
        timestamp: new Date().toISOString(),
        protocolCount: allHealth.length,
        summary: {
          critical: allHealth.filter(h => h.status === 'critical').length,
          warning: allHealth.filter(h => h.status === 'warning').length,
          healthy: allHealth.filter(h => h.status === 'healthy').length,
          avgRisk: Math.round(allHealth.reduce((sum, h) => sum + h.overallRisk, 0) / allHealth.length),
        },
        protocols: allHealth.map(h => ({
          protocol: h.protocol,
          status: h.status,
          overallRisk: h.overallRisk,
          riskGrade: getRiskGrade(h.overallRisk),
          tvl: formatNumber(h.metrics.tvl),
          tvlChange24h: `${h.metrics.tvlChange24h >= 0 ? '+' : ''}${h.metrics.tvlChange24h.toFixed(1)}%`,
          whaleConcentration: `${h.metrics.whaleConcentration}%`,
          alertCount: h.alerts.length,
          topAlert: h.alerts[0]?.title || 'None',
          recommendation: getAgentRecommendation(h.overallRisk, h.status),
        })),
      }, null, 2), { headers });
    }

    // Default: API overview
    return new Response(JSON.stringify({
      name: 'SolanaYield Rug Pull Detection API',
      version: '1.0.0',
      description: 'Real-time risk monitoring for Solana DeFi protocols. The trust layer AI agents need.',
      tagline: '"Trust, but verify — automatically."',
      endpoints: {
        single_protocol: {
          url: '/api/rugpull?protocol=kamino',
          description: 'Comprehensive risk analysis for a single protocol',
        },
        all_protocols: {
          url: '/api/rugpull?all=true',
          description: 'Risk analysis for all monitored protocols',
        },
        active_alerts: {
          url: '/api/rugpull?alerts=true&minSeverity=high',
          description: 'Get active alerts across all protocols (filter by severity)',
        },
        markdown_format: {
          url: '/api/rugpull?protocol=kamino&format=markdown',
          description: 'Human-readable markdown summary',
        },
      },
      monitored_protocols: Object.keys(MOCK_HEALTH_DATA),
      detection_capabilities: [
        '📉 TVL collapse / liquidity drain detection',
        '🐋 Whale concentration & dump monitoring',
        '🔐 Contract upgrade authority analysis',
        '🖨️ Mint/freeze authority detection',
        '🔓 Token unlock schedule tracking',
        '⚡ Real-time alert generation',
      ],
      alert_severities: {
        critical: 'Exit immediately — imminent risk',
        high: 'Reduce exposure — significant risk',
        medium: 'Monitor closely — elevated risk',
        low: 'Be aware — minor concern',
        info: 'Informational — no action needed',
      },
      risk_grades: {
        'A': '0-25 — Low risk, well-established protocol',
        'B': '26-40 — Moderate risk, some concerns',
        'C': '41-55 — Elevated risk, caution advised',
        'D': '56-70 — High risk, consider reducing exposure',
        'F': '71-100 — Critical risk, exit recommended',
      },
      use_cases: [
        'AI agents: Verify protocol safety before deposits',
        'Traders: Real-time risk alerts',
        'Protocols: Trust score for marketing',
        'Compliance: Audit trail of risk analysis',
      ],
    }, null, 2), { headers });

  } catch (err) {
    console.error('Rug pull detection error:', err);
    return new Response(JSON.stringify({
      error: 'Analysis failed',
      details: err instanceof Error ? err.message : 'Unknown error',
    }), { 
      status: 500, 
      headers,
    });
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function getRiskGrade(risk: number): string {
  if (risk <= 25) return 'A';
  if (risk <= 40) return 'B';
  if (risk <= 55) return 'C';
  if (risk <= 70) return 'D';
  return 'F';
}

function getAgentRecommendation(risk: number, status: string): string {
  if (status === 'critical' || risk >= 70) {
    return '🚨 EXIT_IMMEDIATELY — Critical risk signals detected';
  }
  if (status === 'warning' || risk >= 50) {
    return '⚠️ REDUCE_EXPOSURE — Significant risks identified';
  }
  if (risk >= 35) {
    return '👀 MONITOR_CLOSELY — Some concerns to watch';
  }
  return '✅ SAFE_TO_OPERATE — Protocol appears healthy';
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return '$' + (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return '$' + (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return '$' + (num / 1_000).toFixed(0) + 'K';
  return '$' + num.toFixed(0);
}
