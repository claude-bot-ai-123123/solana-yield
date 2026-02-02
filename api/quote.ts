export const config = {
  runtime: 'edge',
};

const TOKENS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  MSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  JITOSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  JLP: '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
};

export default async function handler(request: Request) {
  const headers = { 
    'Content-Type': 'application/json', 
    'Access-Control-Allow-Origin': '*' 
  };

  const url = new URL(request.url);
  const from = (url.searchParams.get('from') || 'SOL').toUpperCase();
  const to = (url.searchParams.get('to') || 'USDC').toUpperCase();
  const amount = parseFloat(url.searchParams.get('amount') || '1');

  const inputMint = TOKENS[from];
  const outputMint = TOKENS[to];

  if (!inputMint || !outputMint) {
    return new Response(JSON.stringify({ 
      error: `Unknown token. Supported: ${Object.keys(TOKENS).join(', ')}` 
    }), { status: 400, headers });
  }

  try {
    const decimals = from === 'USDC' || from === 'USDT' ? 6 : 9;
    const amountBase = Math.floor(amount * Math.pow(10, decimals));

    // Add timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountBase}&slippageBps=50`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status}`);
    }

    const quote = await response.json();
    const outDecimals = to === 'USDC' || to === 'USDT' ? 6 : 9;
    
    return new Response(JSON.stringify({
      from,
      to,
      inputAmount: amount,
      outputAmount: parseInt(quote.outAmount) / Math.pow(10, outDecimals),
      priceImpact: quote.priceImpactPct,
      route: quote.routePlan?.map((r: any) => r.swapInfo?.label).filter(Boolean).join(' → ') || 'direct',
    }), { headers });
  } catch (err: any) {
    const errorMsg = err.name === 'AbortError' ? 'Request timeout' : err.message || 'Quote failed';
    return new Response(JSON.stringify({ error: errorMsg }), { status: 500, headers });
  }
}
