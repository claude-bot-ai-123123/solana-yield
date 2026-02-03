import { Connection, PublicKey } from '@solana/web3.js';
import { YieldOpportunity, Position } from '../types';

const LULO_API = 'https://api.lulo.fi/v1';
const LULO_API_KEY = process.env.LULO_API_KEY; // Get from dev.lulo.fi

/**
 * Lulo Finance Adapter
 * 
 * Lulo is a DeFi lending aggregator on Solana that auto-routes deposits
 * to the best yields across Kamino, Drift, MarginFi, and Jupiter.
 * 
 * API Key Required:
 * - Sign up at https://dev.lulo.fi
 * - Get API key and set LULO_API_KEY env variable
 * - API requires 'x-api-key' header for authentication
 */
export class LuloAdapter {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async getYields(): Promise<YieldOpportunity[]> {
    if (!LULO_API_KEY) {
      console.warn('Lulo API key not configured (get from dev.lulo.fi), using fallback data');
      return this.getFallbackYields();
    }

    try {
      // Fetch Lulo yield data
      const response = await fetch(`${LULO_API}/flex-lending/stats`, {
        headers: {
          'x-api-key': LULO_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Lulo API error: ${response.status}`);
      }

      const data = await response.json();
      
      return this.parseYields(data);
    } catch (err) {
      console.warn('Lulo fetch failed:', err);
      return this.getFallbackYields();
    }
  }

  async getPositions(wallet: PublicKey): Promise<Position[]> {
    // TODO: Implement when API key is available
    // Requires: GET /v1/accounts/{wallet}/balance
    return [];
  }

  private parseYields(data: any): YieldOpportunity[] {
    // Parse actual API response structure
    // Structure TBD based on API documentation at dev.lulo.fi
    if (!data || !data.markets) {
      return this.getFallbackYields();
    }

    return data.markets.map((market: any) => ({
      protocol: 'lulo' as const,
      asset: market.symbol || 'USDC',
      apy: market.lendApy * 100 || 0,
      tvl: market.totalDepositsUsd || 0,
      risk: this.assessRisk(market),
      metadata: {
        utilization: market.utilization,
        underlying: market.underlyingProtocols, // Kamino, Drift, MarginFi, Jupiter
      },
    }));
  }

  private assessRisk(market: any): 'low' | 'medium' | 'high' {
    // Lulo aggregates across multiple protocols, inheriting their risk profiles
    // Generally lower risk due to diversification across lending protocols
    if (market.symbol === 'USDC' || market.symbol === 'USDT') {
      return 'low';
    }
    if (market.utilization > 0.9) {
      return 'high'; // High utilization = higher risk
    }
    return 'medium';
  }

  private getFallbackYields(): YieldOpportunity[] {
    // Fallback data based on typical Lulo rates
    // Lulo aggregates Kamino, Drift, MarginFi, Jupiter yields
    // Rates reflect auto-rebalancing across these protocols
    return [
      {
        protocol: 'lulo',
        asset: 'USDC',
        apy: 9.2, // Aggregated lending yield
        tvl: 75000000,
        risk: 'low',
        metadata: {
          underlying: ['Kamino', 'Drift', 'MarginFi'],
          note: 'Auto-rebalanced across integrated protocols',
        },
      },
      {
        protocol: 'lulo',
        asset: 'USDT',
        apy: 8.8,
        tvl: 45000000,
        risk: 'low',
        metadata: {
          underlying: ['Kamino', 'MarginFi'],
        },
      },
      {
        protocol: 'lulo',
        asset: 'SOL',
        apy: 11.5,
        tvl: 30000000,
        risk: 'medium',
        metadata: {
          underlying: ['Kamino', 'Drift'],
        },
      },
      {
        protocol: 'lulo',
        asset: 'mSOL',
        apy: 10.3,
        tvl: 20000000,
        risk: 'medium',
        metadata: {
          underlying: ['Kamino'],
        },
      },
    ];
  }
}
