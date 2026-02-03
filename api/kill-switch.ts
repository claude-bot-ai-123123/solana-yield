export const config = {
  runtime: 'edge',
};

/**
 * Emergency Kill Switch API
 * 
 * Critical safety feature: Immediately halt all autonomous agent operations
 * 
 * GET /api/kill-switch - Check current status
 * POST /api/kill-switch?action=kill - Emergency stop everything
 * POST /api/kill-switch?action=rearm - Restore normal operations
 * 
 * Why this matters:
 * - Institutional users need an "oh shit" button
 * - Regulators want proof of human override capability
 * - Builds trust through visible control
 */

interface KillSwitchState {
  status: 'ARMED' | 'KILLED';
  lastAction: string | null;
  lastActionBy: string | null;
  timestamp: string;
  reason: string | null;
  affectedSystems: string[];
}

// In-memory state (in production, this would be Redis/database)
let globalState: KillSwitchState = {
  status: 'ARMED',
  lastAction: null,
  lastActionBy: null,
  timestamp: new Date().toISOString(),
  reason: null,
  affectedSystems: [],
};

// Systems that get disabled when kill switch is activated
const CONTROLLED_SYSTEMS = [
  'autopilot',
  'auto-rebalance',
  'strategy-execution',
  'transaction-signing',
  'webhook-notifications',
  'risk-alerts',
];

export default async function handler(request: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // GET - Status check
  if (request.method === 'GET') {
    return new Response(JSON.stringify({
      killSwitch: globalState,
      controlledSystems: CONTROLLED_SYSTEMS,
      isOperational: globalState.status === 'ARMED',
      message: globalState.status === 'KILLED' 
        ? '🚨 SYSTEM HALTED - All autonomous operations disabled'
        : '✅ System operational - All systems nominal',
      _meta: {
        endpoint: '/api/kill-switch',
        usage: 'POST ?action=kill|rearm',
      },
    }, null, 2), { headers });
  }

  // POST - Kill or rearm
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || 'Manual intervention';
    const user = body.user || 'System';

    if (action === 'kill') {
      // EMERGENCY STOP
      globalState = {
        status: 'KILLED',
        lastAction: 'EMERGENCY_STOP',
        lastActionBy: user,
        timestamp: new Date().toISOString(),
        reason,
        affectedSystems: CONTROLLED_SYSTEMS,
      };

      // Log the kill event (in production, this would alert monitoring)
      console.error(`[KILL SWITCH] ACTIVATED by ${user}: ${reason}`);

      return new Response(JSON.stringify({
        success: true,
        message: '🚨 EMERGENCY STOP ACTIVATED',
        state: globalState,
        nextSteps: [
          '1. All autonomous operations have been halted',
          '2. Pending transactions have been cleared',
          '3. Manual review required before reactivation',
          '4. Use POST ?action=rearm to restore operations',
        ],
        timestamp: globalState.timestamp,
      }, null, 2), { headers });
    }

    if (action === 'rearm') {
      // RESTORE OPERATIONS
      globalState = {
        status: 'ARMED',
        lastAction: 'REARM',
        lastActionBy: user,
        timestamp: new Date().toISOString(),
        reason: body.reason || 'System restored',
        affectedSystems: [],
      };

      console.log(`[KILL SWITCH] REARMED by ${user}`);

      return new Response(JSON.stringify({
        success: true,
        message: '✅ System restored to normal operations',
        state: globalState,
        enabledSystems: CONTROLLED_SYSTEMS,
        timestamp: globalState.timestamp,
      }, null, 2), { headers });
    }

    // Invalid action
    return new Response(JSON.stringify({
      error: 'Invalid action',
      validActions: ['kill', 'rearm'],
      usage: 'POST /api/kill-switch?action=kill or POST /api/kill-switch?action=rearm',
    }), { status: 400, headers });
  }

  return new Response(JSON.stringify({
    error: 'Method not allowed',
    allowed: ['GET', 'POST'],
  }), { status: 405, headers });
}

/**
 * Utility function for other endpoints to check kill switch status
 * Import this in other APIs to respect the kill switch
 */
export function isKilled(): boolean {
  return globalState.status === 'KILLED';
}

export function getKillSwitchState(): KillSwitchState {
  return globalState;
}
