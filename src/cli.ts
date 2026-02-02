#!/usr/bin/env node
import { Command } from 'commander';
import { Keypair, Connection } from '@solana/web3.js';
import { readFileSync } from 'fs';
import { SolanaYield } from './lib/yield';
import { YieldMonitor } from './lib/monitor';

const program = new Command();

program
  .name('solana-yield')
  .description('Autonomous DeFi yield orchestrator for Solana')
  .version('0.1.0');

program
  .command('yields')
  .description('Show current yield opportunities across protocols')
  .option('--risk <level>', 'Filter by risk level (low/medium/high)')
  .option('--min-apy <percent>', 'Minimum APY threshold')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const monitor = new YieldMonitor(connection);
    
    let opportunities = await monitor.fetchAllYields();
    
    if (options.risk) {
      opportunities = opportunities.filter(o => o.risk === options.risk);
    }
    if (options.minApy) {
      opportunities = opportunities.filter(o => o.apy >= parseFloat(options.minApy));
    }

    if (options.json) {
      console.log(JSON.stringify(opportunities, null, 2));
    } else {
      console.log('\n🌾 Current Yield Opportunities\n');
      console.log('Protocol    Asset      APY       Risk     TVL');
      console.log('─'.repeat(55));
      for (const opp of opportunities) {
        console.log(
          `${opp.protocol.padEnd(11)} ${opp.asset.padEnd(10)} ${opp.apy.toFixed(2).padStart(6)}%   ${opp.risk.padEnd(8)} $${(opp.tvl / 1e6).toFixed(1)}M`
        );
      }
    }
  });

program
  .command('portfolio')
  .description('Show current portfolio positions')
  .requiredOption('--keypair <path>', 'Path to keypair file')
  .action(async (options) => {
    const keypairData = JSON.parse(readFileSync(options.keypair, 'utf-8'));
    const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    
    const sy = new SolanaYield({ keypair });
    const portfolio = await sy.getPortfolio();
    
    console.log('\n📊 Portfolio Summary\n');
    console.log(`Total Value: $${portfolio.totalValue.toFixed(2)}`);
    console.log(`Weighted APY: ${portfolio.weightedApy.toFixed(2)}%`);
    console.log('\nPositions:');
    for (const pos of portfolio.positions) {
      console.log(`  ${pos.protocol}/${pos.asset}: $${pos.valueUsd.toFixed(2)} @ ${pos.currentApy.toFixed(2)}%`);
    }
  });

program
  .command('optimize')
  .description('Calculate and optionally execute optimal rebalancing')
  .requiredOption('--keypair <path>', 'Path to keypair file')
  .option('--dry-run', 'Show what would be done without executing')
  .option('--risk <level>', 'Risk tolerance (low/medium/high)', 'medium')
  .action(async (options) => {
    const keypairData = JSON.parse(readFileSync(options.keypair, 'utf-8'));
    const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    
    const sy = new SolanaYield({ 
      keypair,
      strategy: {
        name: 'cli-optimize',
        riskTolerance: options.risk,
        rebalanceThreshold: 0.5,
        maxProtocolConcentration: 0.4,
      }
    });
    
    const { actions, txIds } = await sy.optimize({ dryRun: options.dryRun });
    
    if (actions.length === 0) {
      console.log('✨ Portfolio is already optimized!');
      return;
    }
    
    console.log(`\n📋 ${options.dryRun ? 'Proposed' : 'Executed'} Actions:\n`);
    for (const action of actions) {
      console.log(`  ${action.type.toUpperCase()}`);
      if (action.from) {
        console.log(`    From: ${action.from.protocol}/${action.from.asset} (${action.from.amount})`);
      }
      if (action.to) {
        console.log(`    To: ${action.to.protocol}/${action.to.asset}`);
      }
      console.log(`    Expected APY gain: +${action.expectedApyGain.toFixed(2)}%`);
    }
    
    if (txIds) {
      console.log('\nTransaction IDs:');
      txIds.forEach(tx => console.log(`  ${tx}`));
    }
  });

program
  .command('autopilot')
  .description('Start continuous monitoring and auto-rebalancing')
  .requiredOption('--keypair <path>', 'Path to keypair file')
  .option('--interval <ms>', 'Check interval in milliseconds', '60000')
  .action(async (options) => {
    const keypairData = JSON.parse(readFileSync(options.keypair, 'utf-8'));
    const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    
    const sy = new SolanaYield({ keypair });
    await sy.startAutoPilot(parseInt(options.interval));
  });

program.parse();
