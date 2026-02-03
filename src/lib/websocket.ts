/**
 * WebSocket Server for Real-Time Trading Updates
 * 
 * Provides live streaming of:
 * - Trading decisions and reasoning
 * - Trade execution status
 * - Portfolio changes
 * - Yield updates
 * - Alerts and circuit breakers
 */

import { IncomingMessage, Server as HttpServer, ServerResponse } from 'http';
import { TradingModeManager, TradingEvent, TradingState } from './trading-mode';

// ============================================================================
// Types
// ============================================================================

interface WebSocketClient {
  id: string;
  response: ServerResponse;
  subscriptions: Set<string>;
  connectedAt: number;
  lastPing: number;
}

interface WebSocketMessage {
  type: 'event' | 'state' | 'ping' | 'error' | 'welcome';
  timestamp: number;
  data: unknown;
}

// ============================================================================
// SSE-based WebSocket Alternative
// Server-Sent Events work in all browsers without additional dependencies
// ============================================================================

export class TradingWebSocketServer {
  private clients: Map<string, WebSocketClient> = new Map();
  private tradingManager: TradingModeManager | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private stateInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Heartbeat to keep connections alive
    this.pingInterval = setInterval(() => this.sendPingToAll(), 30000);
    // Periodic state broadcast
    this.stateInterval = setInterval(() => this.broadcastState(), 5000);
  }

  /**
   * Attach trading manager for events
   */
  attachTradingManager(manager: TradingModeManager): void {
    this.tradingManager = manager;
    
    // Forward all trading events to connected clients
    manager.on('event', (event: TradingEvent) => {
      this.broadcast({
        type: 'event',
        timestamp: Date.now(),
        data: event,
      });
    });
  }

  /**
   * Handle SSE connection request
   */
  handleConnection(req: IncomingMessage, res: ServerResponse): void {
    const clientId = generateClientId();
    
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no', // Disable buffering in nginx
    });
    
    const client: WebSocketClient = {
      id: clientId,
      response: res,
      subscriptions: new Set(['all']),
      connectedAt: Date.now(),
      lastPing: Date.now(),
    };
    
    this.clients.set(clientId, client);
    
    console.log(`🔌 Client connected: ${clientId} (total: ${this.clients.size})`);
    
    // Send welcome message with current state
    this.sendToClient(client, {
      type: 'welcome',
      timestamp: Date.now(),
      data: {
        clientId,
        serverTime: Date.now(),
        state: this.tradingManager?.getState() || null,
        config: this.tradingManager?.getConfig() || null,
      },
    });
    
    // Handle client disconnect
    req.on('close', () => {
      this.clients.delete(clientId);
      console.log(`🔌 Client disconnected: ${clientId} (total: ${this.clients.size})`);
    });
    
    req.on('error', () => {
      this.clients.delete(clientId);
    });
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: WebSocketClient, message: WebSocketMessage): void {
    try {
      const data = `data: ${JSON.stringify(message)}\n\n`;
      client.response.write(data);
      client.lastPing = Date.now();
    } catch (err) {
      // Client disconnected
      this.clients.delete(client.id);
    }
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message: WebSocketMessage): void {
    for (const client of this.clients.values()) {
      this.sendToClient(client, message);
    }
  }

  /**
   * Broadcast current state to all clients
   */
  private broadcastState(): void {
    if (!this.tradingManager || this.clients.size === 0) return;
    
    this.broadcast({
      type: 'state',
      timestamp: Date.now(),
      data: this.tradingManager.getState(),
    });
  }

  /**
   * Send ping to all clients to keep connections alive
   */
  private sendPingToAll(): void {
    const pingMessage: WebSocketMessage = {
      type: 'ping',
      timestamp: Date.now(),
      data: { clients: this.clients.size },
    };
    
    this.broadcast(pingMessage);
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get all client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.stateInterval) {
      clearInterval(this.stateInterval);
    }
    
    // Close all client connections
    for (const client of this.clients.values()) {
      try {
        client.response.end();
      } catch (err) {
        // Ignore
      }
    }
    this.clients.clear();
  }
}

// ============================================================================
// REST API for Trading Mode Control
// ============================================================================

export interface TradingAPIRoutes {
  'GET /trading/status': () => Promise<TradingState>;
  'POST /trading/start': () => Promise<{ success: boolean }>;
  'POST /trading/stop': () => Promise<{ success: boolean }>;
  'POST /trading/mode': (mode: string) => Promise<{ success: boolean; mode: string }>;
  'POST /trading/pause': (reason: string) => Promise<{ success: boolean }>;
  'POST /trading/resume': () => Promise<{ success: boolean }>;
  'POST /trading/emergency': (reason: string) => Promise<{ success: boolean }>;
  'GET /trading/pending': () => Promise<unknown[]>;
  'POST /trading/approve/:id': (id: string) => Promise<{ success: boolean }>;
  'POST /trading/reject/:id': (id: string, reason: string) => Promise<{ success: boolean }>;
  'GET /trading/stream': 'SSE endpoint';
}

export function createTradingRoutes(
  manager: TradingModeManager,
  wsServer: TradingWebSocketServer
): Record<string, (req: IncomingMessage, res: ServerResponse) => Promise<void>> {
  
  const json = (res: ServerResponse, data: unknown, status = 200) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(data, null, 2));
  };
  
  const error = (res: ServerResponse, code: number, message: string) => {
    json(res, { error: message }, code);
  };
  
  const parseBody = (req: IncomingMessage): Promise<Record<string, unknown>> => {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (err) {
          reject(err);
        }
      });
      req.on('error', reject);
    });
  };
  
  return {
    // ============================================
    // Status & Info
    // ============================================
    
    'GET /trading': async (req, res) => {
      json(res, {
        name: 'SolanaYield Live Trading API',
        version: '1.0.0',
        description: 'Real-time autonomous trading control',
        endpoints: {
          'GET /trading/status': 'Current trading state',
          'GET /trading/config': 'Trading configuration',
          'GET /trading/summary': 'Human-readable status summary',
          'GET /trading/pending': 'Pending trades requiring approval',
          'GET /trading/history': 'Trade execution history',
          'GET /trading/stream': 'SSE stream for real-time updates',
          'POST /trading/start': 'Start trading mode manager',
          'POST /trading/stop': 'Stop trading mode manager',
          'POST /trading/mode': 'Change trading mode (manual/monitoring/autonomous)',
          'POST /trading/pause': 'Pause trading with reason',
          'POST /trading/resume': 'Resume trading after pause',
          'POST /trading/emergency': 'Emergency stop (immediate)',
          'POST /trading/approve/:id': 'Approve a pending trade',
          'POST /trading/reject/:id': 'Reject a pending trade',
          'POST /trading/config': 'Update trading configuration',
        },
      });
    },
    
    'GET /trading/status': async (req, res) => {
      const state = manager.getState();
      json(res, {
        mode: state.mode,
        isActive: state.isActive,
        isPaused: state.isPaused,
        pauseReason: state.pauseReason,
        sessionId: state.sessionId,
        stats: {
          tradesExecutedToday: state.tradesExecutedToday,
          totalVolumeToday: state.totalVolumeToday,
          consecutiveLosses: state.consecutiveLosses,
          currentDrawdown: state.currentDrawdown,
          peakValue: state.peakValue,
        },
        portfolio: state.portfolio,
        lastDecisionTime: state.lastDecisionTime,
        lastTradeTime: state.lastTradeTime,
        pendingTradesCount: state.pendingTrades.filter(t => t.status === 'pending').length,
        connectedClients: wsServer.getClientCount(),
        currentTime: Date.now(),
      });
    },
    
    'GET /trading/config': async (req, res) => {
      json(res, manager.getConfig());
    },
    
    'GET /trading/summary': async (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(manager.getStatusSummary());
    },
    
    'GET /trading/pending': async (req, res) => {
      json(res, {
        count: manager.getPendingTrades().length,
        trades: manager.getPendingTrades(),
      });
    },
    
    'GET /trading/history': async (req, res) => {
      const history = manager.getTradeHistory();
      json(res, {
        count: history.length,
        trades: history.map(t => ({
          id: t.id,
          timestamp: t.timestamp,
          status: t.status,
          estimatedValueUsd: t.estimatedValueUsd,
          requiresApproval: t.requiresApproval,
          approvedBy: t.approvedBy,
          executedAt: t.executedAt,
          txId: t.txId,
          error: t.error,
          action: t.action,
        })),
      });
    },
    
    // ============================================
    // Control
    // ============================================
    
    'POST /trading/start': async (req, res) => {
      try {
        await manager.start();
        json(res, { success: true, message: 'Trading manager started' });
      } catch (err) {
        error(res, 500, `Failed to start: ${err}`);
      }
    },
    
    'POST /trading/stop': async (req, res) => {
      manager.stop();
      json(res, { success: true, message: 'Trading manager stopped' });
    },
    
    'POST /trading/mode': async (req, res) => {
      try {
        const body = await parseBody(req);
        const mode = body.mode as string;
        
        if (!['manual', 'monitoring', 'autonomous'].includes(mode)) {
          error(res, 400, 'Invalid mode. Use: manual, monitoring, or autonomous');
          return;
        }
        
        manager.setMode(mode as 'manual' | 'monitoring' | 'autonomous');
        json(res, { success: true, mode });
      } catch (err) {
        error(res, 400, `Invalid request: ${err}`);
      }
    },
    
    'POST /trading/pause': async (req, res) => {
      try {
        const body = await parseBody(req);
        const reason = (body.reason as string) || 'Manual pause';
        manager.pause(reason);
        json(res, { success: true, message: `Trading paused: ${reason}` });
      } catch (err) {
        error(res, 400, `Invalid request: ${err}`);
      }
    },
    
    'POST /trading/resume': async (req, res) => {
      manager.resume();
      json(res, { success: true, message: 'Trading resumed' });
    },
    
    'POST /trading/emergency': async (req, res) => {
      try {
        const body = await parseBody(req);
        const reason = (body.reason as string) || 'Emergency stop triggered';
        await manager.emergencyStop(reason);
        json(res, { success: true, message: `EMERGENCY STOP: ${reason}` });
      } catch (err) {
        error(res, 500, `Emergency stop failed: ${err}`);
      }
    },
    
    'POST /trading/config': async (req, res) => {
      try {
        const body = await parseBody(req);
        manager.updateConfig(body);
        json(res, { success: true, config: manager.getConfig() });
      } catch (err) {
        error(res, 400, `Invalid config: ${err}`);
      }
    },
    
    // ============================================
    // Trade Approval
    // ============================================
    
    'POST /trading/approve': async (req, res) => {
      try {
        const url = new URL(req.url || '', 'http://localhost');
        const tradeId = url.searchParams.get('id') || '';
        const body = await parseBody(req);
        const approvedBy = (body.approvedBy as string) || 'api';
        
        const success = await manager.approveTrade(tradeId, approvedBy);
        json(res, { success, tradeId });
      } catch (err) {
        error(res, 400, `Approval failed: ${err}`);
      }
    },
    
    'POST /trading/reject': async (req, res) => {
      try {
        const url = new URL(req.url || '', 'http://localhost');
        const tradeId = url.searchParams.get('id') || '';
        const body = await parseBody(req);
        const reason = (body.reason as string) || 'Rejected via API';
        
        const success = manager.rejectTrade(tradeId, reason);
        json(res, { success, tradeId });
      } catch (err) {
        error(res, 400, `Rejection failed: ${err}`);
      }
    },
    
    // ============================================
    // WebSocket/SSE Stream
    // ============================================
    
    'GET /trading/stream': async (req, res) => {
      wsServer.handleConnection(req, res);
    },
  };
}

// ============================================================================
// Utilities
// ============================================================================

function generateClientId(): string {
  return `client_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
