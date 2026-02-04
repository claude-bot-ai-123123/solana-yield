/**
 * Pyth Oracle Integration
 * Provides real-time price feeds from Pyth Network for DeFi assets
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { PythHttpClient, getPythProgramKeyForCluster } from '@pythnetwork/client';

// Pyth price feed IDs for major Solana DeFi assets
export const PYTH_PRICE_FEEDS = {
  'SOL/USD': 'H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG',
  'USDC/USD': 'Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD',
  'USDT/USD': '3vxLXJqLqF3JG5TCbYycbKWRBbCJQLxQmBGCkyqEEefL',
  'mSOL/USD': 'E4v1BBgoso9s64TQvmyownAVJbhbEPGyzA3qn4n46qj9',
  'stSOL/USD': '2LwhbcswZekofMNRtDRMukZJNSRUiKYMFbqtBwqjDfke',
  'jitoSOL/USD': '7yyaeuJ1GGtVBLT2z2xub5ZWYKaNhF28mj1RdV4VDFVk',
  'JTO/USD': '8npsqRFCKiMPsjVhLp9ZLfR4XfEYDovGGjbz3BvC42sY',
  'JUP/USD': 'g6eRCbboSwK4tSWWZ97FY8BzvgdqYzvyFE11gLxmNuA',
  'BONK/USD': '8ihFLu5FimgTQ1Unh4dVyEHUGodJ5gJQCrQf4KUVB9bN',
  'RAY/USD': 'AnLf8tVYCM816gmBjiy8n53eXKKEDydT5piYjjQDPgTB',
  'ORCA/USD': '4ivThkX8uRxBpHsdWSqyXYihzKF3zpRGAUCqyuagnLoV',
};

export interface PriceData {
  symbol: string;
  price: number;
  confidence: number;
  exponent: number;
  publishTime: number;
  status: string;
}

export class PythOracle {
  private client: PythHttpClient;
  private connection: Connection;

  constructor(connection: Connection, cluster: 'mainnet-beta' | 'devnet' = 'mainnet-beta') {
    this.connection = connection;
    const pythPublicKey = getPythProgramKeyForCluster(cluster);
    this.client = new PythHttpClient(connection, pythPublicKey);
  }

  /**
   * Fetch price for a single asset
   */
  async getPrice(symbol: keyof typeof PYTH_PRICE_FEEDS): Promise<PriceData | null> {
    try {
      const data = await this.client.getData();
      const productPrice = data.productPrice.get(symbol);
      
      if (!productPrice) return null;

      return {
        symbol,
        price: productPrice.price || 0,
        confidence: productPrice.confidence || 0,
        exponent: productPrice.exponent || 0,
        publishTime: productPrice.timestamp || Date.now() / 1000,
        status: productPrice.status?.toString() || 'unknown',
      };
    } catch (error) {
      console.error(`Failed to fetch ${symbol} price:`, error);
      return null;
    }
  }

  /**
   * Fetch prices for multiple assets in parallel
   */
  async getPrices(symbols: Array<keyof typeof PYTH_PRICE_FEEDS>): Promise<PriceData[]> {
    const promises = symbols.map(s => this.getPrice(s));
    const results = await Promise.all(promises);
    return results.filter((p): p is PriceData => p !== null);
  }

  /**
   * Fetch all available price feeds
   */
  async getAllPrices(): Promise<PriceData[]> {
    const symbols = Object.keys(PYTH_PRICE_FEEDS) as Array<keyof typeof PYTH_PRICE_FEEDS>;
    return this.getPrices(symbols);
  }

  /**
   * Get SOL price in USD (most commonly needed)
   */
  async getSolPrice(): Promise<number> {
    const data = await this.getPrice('SOL/USD');
    return data?.price || 0;
  }

  /**
   * Convert SOL amount to USD
   */
  async solToUsd(solAmount: number): Promise<number> {
    const solPrice = await this.getSolPrice();
    return solAmount * solPrice;
  }

  /**
   * Convert USD amount to SOL
   */
  async usdToSol(usdAmount: number): Promise<number> {
    const solPrice = await this.getSolPrice();
    return solPrice > 0 ? usdAmount / solPrice : 0;
  }

  /**
   * Get price with confidence interval
   */
  async getPriceWithConfidence(symbol: keyof typeof PYTH_PRICE_FEEDS): Promise<{
    price: number;
    low: number;
    high: number;
    confidence: number;
  } | null> {
    const data = await this.getPrice(symbol);
    if (!data) return null;

    const adjustedConfidence = data.confidence * Math.pow(10, data.exponent);
    return {
      price: data.price,
      low: data.price - adjustedConfidence,
      high: data.price + adjustedConfidence,
      confidence: adjustedConfidence,
    };
  }

  /**
   * Calculate asset value in USD using oracle price
   */
  async calculateValue(symbol: keyof typeof PYTH_PRICE_FEEDS, amount: number): Promise<number> {
    const data = await this.getPrice(symbol);
    if (!data) return 0;
    return amount * data.price;
  }

  /**
   * Monitor price changes (useful for liquidation monitoring)
   */
  async subscribeToPriceChanges(
    symbol: keyof typeof PYTH_PRICE_FEEDS,
    callback: (price: PriceData) => void,
    intervalMs: number = 1000
  ): Promise<() => void> {
    const interval = setInterval(async () => {
      const price = await this.getPrice(symbol);
      if (price) {
        callback(price);
      }
    }, intervalMs);

    // Return cleanup function
    return () => clearInterval(interval);
  }
}

/**
 * Helper: Create oracle instance with default connection
 */
export function createPythOracle(rpcUrl?: string): PythOracle {
  const connection = new Connection(rpcUrl || 'https://api.mainnet-beta.solana.com');
  return new PythOracle(connection);
}

/**
 * Helper: Quick price check
 */
export async function quickPrice(symbol: keyof typeof PYTH_PRICE_FEEDS, rpcUrl?: string): Promise<number> {
  const oracle = createPythOracle(rpcUrl);
  const data = await oracle.getPrice(symbol);
  return data?.price || 0;
}
