import { Connection, PublicKey } from '@solana/web3.js';
import { YieldOpportunity, Position } from '../types';

/**
 * Mango Markets adapter
 * Note: Mango Markets was exploited in Oct 2022 ($115M). Protocol appears deprecated.
 * Keeping this integration for historical reference and potential future relaunch.
 */
export class MangoAdapter {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async getYields(): Promise<YieldOpportunity[]> {
    // Protocol appears to be deprecated (domains don't resolve)
    // Return empty array as there are no active yields
    return [];
  }

  async getPositions(wallet: PublicKey): Promise<Position[]> {
    return [];
  }

  private getFallbackYields(): YieldOpportunity[] {
    // Historical reference - not currently active
    return [];
  }
}
