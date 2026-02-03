/**
 * Solana Actions discovery endpoint
 * Required for wallets to discover our blinks
 */

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const actionsJson = {
    rules: [
      {
        pathPattern: '/api/blink',
        apiPath: '/api/blink'
      },
      {
        pathPattern: '/api/blink/**',
        apiPath: '/api/blink'
      },
      {
        pathPattern: '/strategy/**',
        apiPath: '/api/blink'
      }
    ]
  };

  return new Response(JSON.stringify(actionsJson), { headers });
}
