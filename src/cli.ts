#!/usr/bin/env node
import { Command } from 'commander';
import { Keypair, Connection } from '@solana/web3.js';
import { readFileSync } from 'fs';
import { SolanaYield } from './lib/yield';
import { YieldMonitor } from './lib/monitor';
import { 
  analyzeOpportunities, 
  sortByRiskAdjustedReturn, 
  getTopRecommendations,
  RiskAdjustedOpportunity 
} from './lib/risk';
import {
  analyzeYields,
  runMultiAgentAnalysis,
  AGENT_PERSONAS,
} from './lib/consensus';
import {
  BacktestEngine,
  BacktestConfig,
  runQuickBacktest,
  compareStrategies,
  generateComparisonReport,
} from './lib/backtest';
import { Strategy } from './types';

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
        maxSlippage: 0.01,
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

program
  .command('risk-analyze')
  .description('Analyze yields with risk-adjusted scoring (not just highest APY)')
  .option('--risk <level>', 'Max risk tolerance (low/medium/high)', 'medium')
  .option('--top <n>', 'Number of top recommendations', '10')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const monitor = new YieldMonitor(connection);
    
    console.log('🔍 Fetching yields and analyzing risk...\n');
    
    const opportunities = await monitor.fetchAllYields();
    const maxRisk = options.risk === 'low' ? 35 : options.risk === 'high' ? 75 : 55;
    const topN = parseInt(options.top);
    
    const recommendations = getTopRecommendations(opportunities, topN, maxRisk);

    if (options.json) {
      console.log(JSON.stringify(recommendations, null, 2));
      return;
    }

    console.log('🎯 Risk-Adjusted Yield Recommendations');
    console.log('━'.repeat(70));
    console.log('(Sorted by risk-adjusted APY, not raw APY)\n');
    
    recommendations.forEach((opp, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      const recEmoji = opp.recommendation === 'strong' ? '✅' : 
                       opp.recommendation === 'moderate' ? '🟡' : 
                       opp.recommendation === 'weak' ? '🟠' : '🔴';
      
      console.log(`${medal} ${opp.asset.padEnd(15)} ${recEmoji} ${opp.recommendation.toUpperCase()}`);
      console.log(`   Protocol: ${opp.protocol}`);
      console.log(`   APY: ${opp.apy.toFixed(2)}% raw → ${opp.adjustedApy.toFixed(2)}% risk-adjusted`);
      console.log(`   Risk Score: ${opp.riskScore.overall}/100 | Sharpe: ${opp.sharpeRatio.toFixed(2)}`);
      console.log(`   TVL: $${formatTvl(opp.tvl)}`);
      
      if (opp.riskScore.positives.length > 0) {
        console.log(`   ✅ ${opp.riskScore.positives.join(', ')}`);
      }
      if (opp.riskScore.warnings.length > 0) {
        console.log(`   ⚠️  ${opp.riskScore.warnings.join(', ')}`);
      }
      console.log('');
    });

    console.log('━'.repeat(70));
    console.log('💡 Risk-adjusted APY = Raw APY penalized for risk factors');
    console.log('   Sharpe Ratio = Return per unit of risk (higher is better)');
  });

program
  .command('compare')
  .description('Compare raw APY vs risk-adjusted rankings')
  .option('--top <n>', 'Number to compare', '5')
  .action(async (options) => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const monitor = new YieldMonitor(connection);
    
    console.log('📊 Comparing Raw APY vs Risk-Adjusted Rankings\n');
    
    const opportunities = await monitor.fetchAllYields();
    const analyzed = analyzeOpportunities(opportunities);
    const topN = parseInt(options.top);
    
    // Sort by raw APY
    const byRawApy = [...analyzed].sort((a, b) => b.apy - a.apy).slice(0, topN);
    
    // Sort by risk-adjusted APY
    const byAdjusted = sortByRiskAdjustedReturn(analyzed).slice(0, topN);
    
    console.log('🏆 TOP BY RAW APY (naive approach)');
    console.log('─'.repeat(50));
    byRawApy.forEach((o, i) => {
      console.log(`${i + 1}. ${o.asset.padEnd(12)} ${o.apy.toFixed(2).padStart(7)}% | Risk: ${o.riskScore.overall}/100`);
      if (o.riskScore.warnings.length > 0) {
        console.log(`   ⚠️  ${o.riskScore.warnings[0]}`);
      }
    });
    
    console.log('\n🎯 TOP BY RISK-ADJUSTED APY (smart approach)');
    console.log('─'.repeat(50));
    byAdjusted.forEach((o, i) => {
      console.log(`${i + 1}. ${o.asset.padEnd(12)} ${o.adjustedApy.toFixed(2).padStart(7)}% adj (${o.apy.toFixed(1)}% raw) | Risk: ${o.riskScore.overall}/100`);
      if (o.riskScore.positives.length > 0) {
        console.log(`   ✅ ${o.riskScore.positives[0]}`);
      }
    });
    
    console.log('\n💡 Notice how the naive approach picks high-risk yields that look');
    console.log('   attractive but carry significant smart contract and liquidity risks.');
  });

program
  .command('consensus')
  .description('🤝 Multi-agent yield analysis with voting consensus (UNIQUE FEATURE)')
  .option('--sentiment <level>', 'Market sentiment (bullish/neutral/bearish)', 'neutral')
  .option('--volatility <level>', 'Market volatility (low/medium/high)', 'medium')
  .option('--stream', 'Show agent thought stream')
  .option('--agents', 'List available agents')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const monitor = new YieldMonitor(connection);
    
    // Just list the analysis approach if requested
    if (options.agents) {
      console.log('\n🔍 Yield Analysis System\n');
      console.log('Multi-factor analysis with transparent reasoning:\n');
      console.log('📊 Factors Analyzed:');
      console.log('   • APY (raw yield)');
      console.log('   • Risk Score (protocol safety)');
      console.log('   • TVL (liquidity depth)');
      console.log('   • Audit Status (security verification)');
      console.log('   • Protocol Maturity (battle-tested)');
      console.log('   • APY Sustainability (realistic yields)\n');
      console.log('Each factor is weighted and combined into an overall score.');
      console.log('Full reasoning is transparent and viewable.\n');
      return;
    }

    console.log('\n🔍 Yield Analysis');
    console.log('━'.repeat(60));
    console.log('Multi-factor analysis with transparent reasoning\n');
    
    console.log('🔍 Fetching yields...');
    const opportunities = await monitor.fetchAllYields();
    
    console.log('📊 Running analysis...\n');
    const analysis = await analyzeYields(opportunities);

    if (options.json) {
      console.log(JSON.stringify(analysis, null, 2));
      return;
    }

    // Show thought stream if requested
    if (options.stream) {
      console.log('💭 Analysis Stream:\n');
      for (const t of analysis.thoughtStream) {
        const icon = t.type === 'concern' ? '⚠️' : t.type === 'approval' ? '✅' : t.type === 'conclusion' ? '🎯' : '🔍';
        console.log(`${icon} ${t.message}`);
      }
      console.log('\n' + '━'.repeat(60) + '\n');
    }

    // Show summary
    console.log(analysis.summary);
    console.log('');

    // Show top 3 analysis results
    console.log('\n### 📋 Top Recommendations\n');
    analysis.analyses.slice(0, 5).forEach((result, i) => {
      const opp = result.opportunity;
      const icon = result.decision.includes('approve') ? '✅' : result.decision === 'neutral' ? '⚖️' : '⚠️';
      
      console.log(`${icon} **${i + 1}. ${opp.asset} on ${opp.protocol}**`);
      console.log(`   APY: ${opp.apy.toFixed(2)}% | Risk-adjusted: ${result.riskAnalysis.adjustedApy.toFixed(2)}%`);
      console.log(`   Score: ${result.overallScore.toFixed(0)}/100 | Decision: ${result.decision.replace('_', ' ').toUpperCase()}`);
      console.log(`   TVL: $${formatTvl(opp.tvl)} | Confidence: ${Math.round(result.confidence * 100)}%`);
      
      // Show key factors
      const positives = result.factors.filter(f => f.impact === 'positive');
      const negatives = result.factors.filter(f => f.impact === 'negative');
      if (positives.length > 0) {
        console.log(`   ✅ Strengths: ${positives.map(f => f.name).join(', ')}`);
      }
      if (negatives.length > 0) {
        console.log(`   ⚠️ Concerns: ${negatives.map(f => f.name).join(', ')}`);
      }
      console.log('');
    });

    console.log('━'.repeat(60));
    console.log('💡 Each opportunity scored on 6 factors: APY, Risk, TVL, Audits, Maturity, Sustainability');
    console.log('   Use --stream to see the full analysis process.\n');
  });

function formatTvl(tvl: number): string {
  if (tvl >= 1e9) return `${(tvl / 1e9).toFixed(2)}B`;
  if (tvl >= 1e6) return `${(tvl / 1e6).toFixed(2)}M`;
  if (tvl >= 1e3) return `${(tvl / 1e3).toFixed(2)}K`;
  return tvl.toFixed(0);
}

// ============================================================================
// BACKTESTING COMMANDS
// ============================================================================

program
  .command('backtest')
  .description('📈 Backtest a yield strategy against historical data')
  .option('--capital <usd>', 'Initial capital in USD', '10000')
  .option('--months <n>', 'Backtest period in months', '6')
  .option('--risk <level>', 'Risk tolerance (low/medium/high)', 'medium')
  .option('--rebalance-days <n>', 'Rebalance frequency in days', '7')
  .option('--threshold <percent>', 'Min APY improvement to rebalance', '1')
  .option('--benchmark <type>', 'Benchmark comparison (hold-sol/hold-usdc/top-apy)')
  .option('--protocols <list>', 'Comma-separated protocol whitelist')
  .option('--json', 'Output as JSON')
  .option('--verbose', 'Show detailed trade log')
  .action(async (options) => {
    const initialCapital = parseFloat(options.capital);
    const months = parseInt(options.months);
    const riskTolerance = options.risk as 'low' | 'medium' | 'high';
    
    const strategy: Strategy = {
      name: `${riskTolerance}-risk-yield`,
      riskTolerance,
      rebalanceThreshold: parseFloat(options.threshold),
      maxProtocolConcentration: 0.5,
      maxSlippage: 0.01,
    };
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    const config: BacktestConfig = {
      initialCapital,
      strategy,
      startDate,
      endDate,
      rebalanceFrequencyDays: parseInt(options.rebalanceDays),
      benchmark: options.benchmark,
      protocols: options.protocols?.split(','),
    };
    
    console.log('🔬 Starting backtest simulation...\n');
    
    const engine = new BacktestEngine(config);
    const result = await engine.run();
    
    if (options.json) {
      console.log(JSON.stringify({
        metrics: result.metrics,
        trades: result.trades.length,
        summary: result.summary,
      }, null, 2));
      return;
    }
    
    // Print summary
    console.log(result.summary);
    
    // Verbose trade log
    if (options.verbose && result.trades.length > 0) {
      console.log('\n📋 TRADE LOG');
      console.log('───────────────────────────────────────────────────────────────');
      for (const trade of result.trades.slice(-10)) {
        console.log(`  ${trade.date.toISOString().split('T')[0]} | ${trade.type.toUpperCase()}`);
        if (trade.from) {
          console.log(`    From: ${trade.from.protocol}/${trade.from.asset} @ ${trade.from.apy.toFixed(1)}%`);
        }
        console.log(`    To: ${trade.to.protocol}/${trade.to.asset} @ ${trade.to.apy.toFixed(1)}%`);
        console.log(`    Value: $${trade.capitalMoved.toFixed(2)} | Gas: $${trade.gasCost.toFixed(2)}`);
      }
      if (result.trades.length > 10) {
        console.log(`  ... and ${result.trades.length - 10} more trades`);
      }
    }
  });

program
  .command('backtest-compare')
  .description('📊 Compare multiple strategies via backtesting')
  .option('--capital <usd>', 'Initial capital in USD', '10000')
  .option('--months <n>', 'Backtest period in months', '6')
  .option('--benchmark <type>', 'Benchmark comparison (hold-sol/hold-usdc/top-apy)')
  .action(async (options) => {
    const initialCapital = parseFloat(options.capital);
    const months = parseInt(options.months);
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    const strategies: Strategy[] = [
      {
        name: 'Conservative',
        riskTolerance: 'low',
        rebalanceThreshold: 2,
        maxProtocolConcentration: 0.4,
        maxSlippage: 0.01,
      },
      {
        name: 'Balanced',
        riskTolerance: 'medium',
        rebalanceThreshold: 1,
        maxProtocolConcentration: 0.5,
        maxSlippage: 0.01,
      },
      {
        name: 'Aggressive',
        riskTolerance: 'high',
        rebalanceThreshold: 0.5,
        maxProtocolConcentration: 0.6,
        maxSlippage: 0.02,
      },
      {
        name: 'Risk-Adjusted Focus',
        riskTolerance: 'medium',
        rebalanceThreshold: 1.5,
        maxProtocolConcentration: 0.4,
        maxSlippage: 0.01,
      },
    ];
    
    console.log('🔬 Comparing strategies via backtesting...\n');
    console.log(`Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    console.log(`Initial Capital: $${initialCapital.toLocaleString()}\n`);
    
    const results = await compareStrategies(strategies, {
      initialCapital,
      startDate,
      endDate,
      benchmark: options.benchmark,
    });
    
    console.log('\n' + generateComparisonReport(results));
    
    // Detailed breakdown
    console.log('\n📈 DETAILED BREAKDOWN\n');
    for (const result of results) {
      console.log(`${result.config.strategy.name}:`);
      console.log(`  Final Value: $${result.metrics.finalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
      console.log(`  Avg Yield: ${result.metrics.averageYield.toFixed(2)}%`);
      console.log(`  Volatility: ${result.metrics.volatility.toFixed(2)}%`);
      console.log(`  Best/Worst Day: +${result.metrics.bestDay.toFixed(2)}% / ${result.metrics.worstDay.toFixed(2)}%`);
      console.log('');
    }
  });

program
  .command('backtest-quick')
  .description('⚡ Quick 6-month backtest with default settings')
  .option('--capital <usd>', 'Initial capital in USD', '10000')
  .option('--risk <level>', 'Risk tolerance (low/medium/high)', 'medium')
  .action(async (options) => {
    const initialCapital = parseFloat(options.capital);
    const riskTolerance = options.risk as 'low' | 'medium' | 'high';
    
    const strategy: Strategy = {
      name: `${riskTolerance}-risk`,
      riskTolerance,
      rebalanceThreshold: 1,
      maxProtocolConcentration: 0.5,
      maxSlippage: 0.01,
    };
    
    console.log('⚡ Running quick 6-month backtest...\n');
    
    const result = await runQuickBacktest(initialCapital, strategy, 6);
    console.log(result.summary);
  });

program.parse();
