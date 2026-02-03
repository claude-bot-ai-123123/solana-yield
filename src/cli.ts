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
  MultiAgentConsensus,
  formatThoughtStream,
  formatConsensusResult,
} from './lib/consensus';

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
    
    // Initialize consensus engine with market conditions
    const consensus = new MultiAgentConsensus(undefined, {
      sentiment: options.sentiment as any,
      volatility: options.volatility as any,
    });

    // Just list agents if requested
    if (options.agents) {
      console.log('\n🤖 Agent Roster\n');
      console.log('Our multi-agent system uses diverse perspectives to build trust through consensus:\n');
      for (const agent of consensus.getAgents()) {
        console.log(`${agent.emoji} **${agent.name}**`);
        console.log(`   ${agent.description}`);
        console.log(`   Specialty: ${agent.specialty}`);
        console.log(`   Risk Tolerance: ${agent.riskTolerance}/100`);
        console.log('');
      }
      console.log('Each agent analyzes opportunities independently, then they vote.');
      console.log('Consensus = trust through multiple perspectives.\n');
      return;
    }

    console.log('\n🤝 Multi-Agent Yield Consensus Analysis');
    console.log('━'.repeat(60));
    console.log('Multiple AI agents voting on strategies = trust through consensus\n');
    console.log(`📊 Market Conditions: ${options.sentiment} sentiment, ${options.volatility} volatility\n`);
    
    console.log('🔍 Fetching yields...');
    const opportunities = await monitor.fetchAllYields();
    
    console.log('🤖 Running multi-agent analysis...\n');
    const analysis = consensus.analyze(opportunities);

    if (options.json) {
      console.log(JSON.stringify(analysis, null, 2));
      return;
    }

    // Show thought stream if requested
    if (options.stream) {
      console.log(formatThoughtStream(analysis.thoughtStream));
      console.log('\n' + '━'.repeat(60) + '\n');
    }

    // Show summary
    console.log(analysis.summary);
    console.log('');

    // Show top 3 consensus results
    console.log('\n### 📋 Detailed Consensus Results (Top 3)\n');
    analysis.results.slice(0, 3).forEach((result, i) => {
      const opp = result.opportunity;
      const cons = result.consensus;
      
      console.log(`**${i + 1}. ${opp.asset} on ${opp.protocol}**`);
      console.log(`   APY: ${opp.apy.toFixed(2)}% | Risk-adjusted: ${result.riskAnalysis.adjustedApy.toFixed(2)}%`);
      console.log(`   Risk Score: ${result.riskAnalysis.riskScore.overall}/100 | TVL: $${formatTvl(opp.tvl)}`);
      console.log(`   Consensus: ${cons.decision.replace('_', ' ').toUpperCase()} (score: ${cons.score}/100)`);
      
      if (cons.unanimity) {
        console.log(`   ✅ UNANIMOUS - All agents agree!`);
      } else {
        console.log(`   Agreement: ${Math.round(cons.confidence * 100)}%`);
        if (cons.dissent.length > 0) {
          console.log(`   Dissent: ${cons.dissent.join(', ')}`);
        }
      }
      
      // Show each agent's vote
      console.log('\n   Agent Votes:');
      result.votes.forEach(vote => {
        const icon = vote.decision.includes('approve') ? '👍' : vote.decision === 'neutral' ? '🤷' : '👎';
        console.log(`   ${vote.agent.emoji} ${vote.agent.name.padEnd(20)} ${icon} ${vote.decision.replace('_', ' ').padEnd(15)} (${vote.score}/100)`);
      });
      console.log('');
    });

    // Highlight unanimous decisions
    const unanimous = analysis.results.filter(r => r.consensus.unanimity && 
      (r.consensus.decision === 'strong_approve' || r.consensus.decision === 'approve'));
    
    if (unanimous.length > 0) {
      console.log('\n🏆 **UNANIMOUS APPROVALS** (All 5 agents agree)\n');
      unanimous.slice(0, 3).forEach(r => {
        console.log(`   ✅ ${r.opportunity.asset} on ${r.opportunity.protocol} — Score: ${r.consensus.score}/100`);
      });
    }

    // Show dissent (interesting for transparency)
    const contested = analysis.results.filter(r => r.consensus.dissent.length >= 2);
    if (contested.length > 0) {
      console.log('\n⚖️ **CONTESTED DECISIONS** (Significant disagreement)\n');
      contested.slice(0, 3).forEach(r => {
        console.log(`   ${r.opportunity.asset} on ${r.opportunity.protocol}`);
        console.log(`   Dissent from: ${r.consensus.dissent.join(', ')}`);
      });
    }

    console.log('\n' + '━'.repeat(60));
    console.log('💡 Multi-agent consensus builds trust through diverse perspectives.');
    console.log('   Each agent has different risk tolerance and analysis methodology.');
    console.log('   Use --stream to see the full agent thought process.\n');
  });

function formatTvl(tvl: number): string {
  if (tvl >= 1e9) return `${(tvl / 1e9).toFixed(2)}B`;
  if (tvl >= 1e6) return `${(tvl / 1e6).toFixed(2)}M`;
  if (tvl >= 1e3) return `${(tvl / 1e3).toFixed(2)}K`;
  return tvl.toFixed(0);
}

program.parse();
