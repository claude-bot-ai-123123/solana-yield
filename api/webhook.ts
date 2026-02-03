export const config = {
  runtime: 'edge',
};

/**
 * Webhook Endpoint - Agent-to-Agent Event Streaming
 * 
 * Allows other agents (like earn's Agent Treasury Protocol) to receive
 * real-time events about yield activities for financial tracking.
 * 
 * Event types:
 * - yield_earned: When yield is harvested/compounded
 * - position_opened: New position created in a protocol
 * - position_closed: Position withdrawn
 * - rebalance_executed: Portfolio rebalanced to optimize yields
 * - fee_incurred: Transaction or protocol fees charged
 */

interface WebhookEvent {
  event: 'yield_earned' | 'position_opened' | 'position_closed' | 'rebalance_executed' | 'fee_incurred';
  timestamp: string;
  wallet: string;
  protocol: string;
  asset: string;
  amount: number;
  amountUsd: number;
  metadata?: Record<string, unknown>;
}

interface WebhookSubscription {
  url: string;
  events: string[];
  active: boolean;
  created: string;
}

// In-memory store for demo (production would use database)
const SUBSCRIPTIONS: Map<string, WebhookSubscription> = new Map();

// Demo event log
const EVENT_LOG: WebhookEvent[] = [];

async function sendWebhook(url: string, event: WebhookEvent): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SolanaYield-Event': event.event,
        'X-SolanaYield-Timestamp': event.timestamp,
      },
      body: JSON.stringify(event),
    });
    
    return response.ok;
  } catch (err) {
    console.error(`Webhook delivery failed to ${url}:`, err);
    return false;
  }
}

async function broadcastEvent(event: WebhookEvent) {
  const promises: Promise<void>[] = [];
  
  for (const [id, sub] of SUBSCRIPTIONS.entries()) {
    if (sub.active && sub.events.includes(event.event)) {
      promises.push(
        sendWebhook(sub.url, event).then(success => {
          if (!success) {
            console.warn(`Failed to deliver ${event.event} to ${id}`);
          }
        })
      );
    }
  }
  
  await Promise.all(promises);
  EVENT_LOG.push(event);
  
  // Keep only last 100 events
  if (EVENT_LOG.length > 100) {
    EVENT_LOG.shift();
  }
}

export default async function handler(request: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };
  
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        ...headers,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // Subscribe to webhooks
    if (request.method === 'POST' && path === '/api/webhook') {
      const body = await request.json();
      const { url: webhookUrl, events, subscriberId } = body;
      
      if (!webhookUrl || !events || !subscriberId) {
        return new Response(JSON.stringify({
          error: 'Missing required fields: url, events, subscriberId',
        }), { status: 400, headers });
      }
      
      const subscription: WebhookSubscription = {
        url: webhookUrl,
        events: events,
        active: true,
        created: new Date().toISOString(),
      };
      
      SUBSCRIPTIONS.set(subscriberId, subscription);
      
      return new Response(JSON.stringify({
        success: true,
        subscriberId,
        subscription,
        message: 'Webhook subscription created. You will receive events as they occur.',
      }), { headers });
    }
    
    // Unsubscribe
    if (request.method === 'DELETE' && path === '/api/webhook') {
      const subscriberId = url.searchParams.get('id');
      
      if (!subscriberId) {
        return new Response(JSON.stringify({
          error: 'Missing subscriberId parameter',
        }), { status: 400, headers });
      }
      
      const existed = SUBSCRIPTIONS.delete(subscriberId);
      
      return new Response(JSON.stringify({
        success: existed,
        message: existed ? 'Subscription removed' : 'Subscription not found',
      }), { headers });
    }
    
    // List subscriptions (for admin/debugging)
    if (request.method === 'GET' && path === '/api/webhook/subscriptions') {
      return new Response(JSON.stringify({
        count: SUBSCRIPTIONS.size,
        subscriptions: Array.from(SUBSCRIPTIONS.entries()).map(([id, sub]) => ({
          id,
          ...sub,
        })),
      }), { headers });
    }
    
    // Simulate/trigger test event (for testing integrations)
    if (request.method === 'POST' && path === '/api/webhook/test') {
      const testEvent: WebhookEvent = {
        event: 'yield_earned',
        timestamp: new Date().toISOString(),
        wallet: 'DemoWallet123...',
        protocol: 'Kamino',
        asset: 'USDC',
        amount: 10.5,
        amountUsd: 10.5,
        metadata: {
          apy: 8.5,
          compounded: true,
          test: true,
        },
      };
      
      await broadcastEvent(testEvent);
      
      return new Response(JSON.stringify({
        success: true,
        event: testEvent,
        delivered: SUBSCRIPTIONS.size,
        message: 'Test event broadcast to all subscribers',
      }), { headers });
    }
    
    // Get recent events
    if (request.method === 'GET' && path === '/api/webhook/events') {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      
      return new Response(JSON.stringify({
        count: EVENT_LOG.length,
        events: EVENT_LOG.slice(-limit).reverse(),
      }), { headers });
    }
    
    // Usage/documentation
    return new Response(JSON.stringify({
      endpoint: '/api/webhook',
      description: 'Agent-to-Agent event streaming for DeFi activity tracking',
      integration: {
        name: 'earn Agent Treasury Protocol',
        status: 'Ready for integration',
      },
      usage: {
        subscribe: {
          method: 'POST',
          url: '/api/webhook',
          body: {
            subscriberId: 'earn-agent-123',
            url: 'https://your-agent.com/webhooks/solanayield',
            events: ['yield_earned', 'position_opened', 'position_closed', 'rebalance_executed', 'fee_incurred'],
          },
        },
        unsubscribe: {
          method: 'DELETE',
          url: '/api/webhook?id=<subscriberId>',
        },
        test: {
          method: 'POST',
          url: '/api/webhook/test',
          description: 'Trigger a test event to all subscribers',
        },
        listSubscriptions: {
          method: 'GET',
          url: '/api/webhook/subscriptions',
        },
        recentEvents: {
          method: 'GET',
          url: '/api/webhook/events?limit=20',
        },
      },
      eventTypes: {
        yield_earned: 'Yield harvested or auto-compounded',
        position_opened: 'New DeFi position created',
        position_closed: 'Position withdrawn/exited',
        rebalance_executed: 'Portfolio rebalanced to optimize yields',
        fee_incurred: 'Transaction or protocol fees charged',
      },
      eventSchema: {
        event: 'string (event type)',
        timestamp: 'ISO 8601 timestamp',
        wallet: 'string (wallet address)',
        protocol: 'string (protocol name)',
        asset: 'string (asset symbol)',
        amount: 'number (asset amount)',
        amountUsd: 'number (USD value)',
        metadata: 'object (additional context)',
      },
      security: {
        headers: [
          'X-SolanaYield-Event: event type',
          'X-SolanaYield-Timestamp: ISO timestamp',
        ],
        note: 'Production version would include HMAC signature for verification',
      },
      builder: 'SolanaYield - Colosseum Agent Hackathon',
    }), { headers });
    
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(JSON.stringify({
      error: 'Webhook operation failed',
      details: err instanceof Error ? err.message : 'Unknown error',
    }), {
      status: 500,
      headers,
    });
  }
}
