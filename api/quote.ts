import type { VercelRequest, VercelResponse } from '@vercel/node';

const JUPITER_API = 'https://quote-api.jup.ag/v6';

const TOKENS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  MSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  JITOSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const from = (req.query.from as string || 'SOL').toUpperCase();
  const to = (req.query.to as string || 'USDC').toUpperCase();
  const amount = parseFloat(req.query.amount as string || '1');

  const inputMint = TOKENS[from];
  const outputMint = TOKENS[to];

  if (!inputMint || !outputMint) {
    res.status(400).json({ error: `Unknown token. Supported: ${Object.keys(TOKENS).join(', ')}` });
    return;
  }

  try {
    const decimals = from === 'USDC' || from === 'USDT' ? 6 : 9;
    const amountBase = Math.floor(amount * Math.pow(10, decimals));

    const response = await fetch(
      `${JUPITER_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountBase}&slippageBps=50`
    );
    const quote = await response.json();

    const outDecimals = to === 'USDC' || to === 'USDT' ? 6 : 9;
    
    res.json({
      from,
      to,
      inputAmount: amount,
      outputAmount: parseInt(quote.outAmount) / Math.pow(10, outDecimals),
      priceImpact: quote.priceImpactPct,
    });
  } catch (err) {
    res.status(500).json({ error: 'Quote failed' });
  }
}
