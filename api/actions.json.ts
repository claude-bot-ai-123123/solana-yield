/**
 * Solana Actions discovery endpoint
 * Required for wallets to discover our blinks
 * 
 * This file tells Solana wallet clients where to find action endpoints.
 * See: https://docs.dialect.to/documentation/actions/actions-and-blinks
 */

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const actionsJson = {
    rules: [
      // Main actions API
      {
        pathPattern: '/api/actions',
        apiPath: '/api/actions'
      },
      {
        pathPattern: '/api/actions/**',
        apiPath: '/api/actions'
      },
      // Legacy blink endpoint (still supported)
      {
        pathPattern: '/api/blink',
        apiPath: '/api/blink'
      },
      {
        pathPattern: '/api/blink/**',
        apiPath: '/api/blink'
      },
      // Strategy shortcuts
      {
        pathPattern: '/strategy/**',
        apiPath: '/api/actions'
      },
      // Protocol shortcuts
      {
        pathPattern: '/stake/**',
        apiPath: '/api/actions'
      },
      {
        pathPattern: '/deposit/**',
        apiPath: '/api/actions'
      },
      {
        pathPattern: '/swap/**',
        apiPath: '/api/actions'
      }
    ]
  };

  return new Response(JSON.stringify(actionsJson, null, 2), { headers });
}
