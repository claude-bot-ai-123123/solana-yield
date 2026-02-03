/**
 * Webhook Notifier - Shared utility for triggering webhooks across API routes
 */

export interface WebhookEvent {
  event: 'yield_earned' | 'position_opened' | 'position_closed' | 'rebalance_executed' | 'fee_incurred' | 'decision_made';
  timestamp: string;
  wallet: string;
  protocol: string;
  asset: string;
  amount?: number;
  amountUsd?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Notify all webhook subscribers about an event
 * Calls the webhook endpoint internally to broadcast
 */
export async function notifyWebhooks(event: WebhookEvent): Promise<void> {
  try {
    // Call our own webhook endpoint to broadcast the event
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'https://solana-yield.vercel.app';
    
    await fetch(`${baseUrl}/api/webhook/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch (err) {
    console.error('Failed to notify webhooks:', err);
    // Don't throw - webhook failures shouldn't break main flow
  }
}

/**
 * Helper to create decision event from autopilot analysis
 */
export function createDecisionEvent(
  decision: any,
  strategy: any
): WebhookEvent {
  const topOpp = decision.topOpportunities?.[0];
  
  return {
    event: decision.type === 'rebalance' ? 'rebalance_executed' : 'decision_made',
    timestamp: decision.timestamp,
    wallet: 'autopilot-demo',
    protocol: topOpp?.protocol || 'N/A',
    asset: topOpp?.asset || 'N/A',
    amountUsd: 0, // Demo mode - no actual amounts
    metadata: {
      decisionType: decision.type,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      recommendation: decision.recommendation,
      strategyName: strategy.name,
      riskTolerance: strategy.riskTolerance,
      bestApy: decision.analysisDetails?.bestApy,
      demo: true,
    },
  };
}
