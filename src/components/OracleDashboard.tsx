'use client';

import { useEffect, useState } from 'react';
import { PriceData } from '@/lib/pyth';

export default function OracleDashboard() {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchPrices = async () => {
    try {
      const response = await fetch('/api/oracle');
      const data = await response.json();
      setPrices(data.prices || []);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch oracle prices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 5000); // Update every 5s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          📡 Oracle Prices
        </h2>
        <p className="text-zinc-400">Loading price feeds...</p>
      </div>
    );
  }

  const formatPrice = (price: number, decimals = 2) => {
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(decimals)}`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString();
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          📡 Oracle Prices
          <span className="text-xs text-zinc-500 font-normal">
            Powered by Pyth Network
          </span>
        </h2>
        {lastUpdate && (
          <span className="text-xs text-zinc-500">
            Updated: {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {prices.map((price) => (
          <div
            key={price.symbol}
            className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 hover:bg-zinc-800 transition-colors"
          >
            <div className="text-xs text-zinc-400 mb-1">
              {price.symbol.split('/')[0]}
            </div>
            <div className="text-lg font-bold text-white mb-1">
              {formatPrice(price.price)}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={
                price.status === 'trading' 
                  ? 'text-green-400' 
                  : 'text-yellow-400'
              }>
                ● {price.status}
              </span>
              <span className="text-zinc-500">
                ±{formatPrice(price.confidence, 4)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-zinc-500 flex items-center gap-4">
        <span>🔒 On-chain data</span>
        <span>⚡ Real-time updates</span>
        <span>🎯 Sub-second latency</span>
      </div>
    </div>
  );
}
