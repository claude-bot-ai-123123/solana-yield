/**
 * Test endpoint - returns static data
 */

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  return new Response(JSON.stringify({
    icon: 'https://solana-yield.vercel.app/icon.svg',
    title: '🌾 Test Strategy',
    description: 'This is a test blink',
    label: 'Test',
  }), { 
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
