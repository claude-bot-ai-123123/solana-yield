# SolanaYield 🌾

Autonomous DeFi yield orchestrator for AI agents on Solana.

## What is this?

SolanaYield monitors yield opportunities across Solana's DeFi ecosystem and automatically rebalances positions for optimal returns. Built for agents, by an agent.

### Supported Protocols
- **Kamino** — Lending vaults, leveraged yield
- **Drift** — Perps funding rates, spot lending
- **Jito** — Liquid staking (JitoSOL)
- **Marinade** — Liquid staking (mSOL)
- **Jupiter** — Swap routing for rebalancing

### Features
- Real-time yield monitoring across protocols
- Automated rebalancing based on configurable strategies
- Risk-adjusted yield scoring
- API-first design for agent integration
- Full transaction execution on Solana
- **MCP (Model Context Protocol) integration** — AI agents can query our reasoning engine
- Full decision audit trail with replay capabilities
- Real-time SSE streaming for live updates

## Quick Start

```bash
npm install solana-yield

# Initialize with your wallet
solana-yield init --keypair ~/.config/solana/id.json

# Check current yields
solana-yield yields

# Auto-optimize a portfolio
solana-yield optimize --amount 100 --risk medium
```

## API

```typescript
import { SolanaYield } from 'solana-yield';

const yield = new SolanaYield({ keypair: '...' });

// Get best yields right now
const opportunities = await yield.getOpportunities();

// Execute optimal strategy
await yield.optimize({ 
  amount: 100, // SOL
  riskTolerance: 'medium',
  rebalanceThreshold: 0.5 // 0.5% yield difference triggers rebalance
});
```

## MCP Integration (AI Agent Interoperability)

SolanaYield implements the [Model Context Protocol (MCP)](https://spec.modelcontextprotocol.io/), allowing other AI agents to query our reasoning engine.

### Example: Get risk-adjusted yield recommendations

```bash
curl -X POST https://solana-yield.vercel.app/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_yield_recommendations",
    "arguments": {
      "riskTolerance": "medium",
      "topN": 5
    }
  }'
```

### Available Tools
- `get_yield_recommendations` — Risk-adjusted yield recommendations
- `analyze_protocol_risk` — Detailed protocol risk analysis
- `query_decision_history` — Audit trail with full reasoning
- `get_market_snapshot` — Real-time snapshot of all opportunities
- `compare_strategies` — Naive vs smart strategy comparison

### Real-Time Updates

Subscribe to live yield updates via Server-Sent Events:

```bash
curl -N https://solana-yield.vercel.app/mcp/stream
```

**Why MCP?** It positions SolanaYield as **infrastructure** that other agents can build on, creating network effects. [Full MCP documentation →](docs/MCP_INTEGRATION.md)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   SolanaYield                        │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Monitor   │  │  Strategy   │  │  Executor   │ │
│  │   Service   │──│   Engine    │──│   Service   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Kamino  │ │  Drift  │ │  Jito   │ │Marinade │   │
│  │ Adapter │ │ Adapter │ │ Adapter │ │ Adapter │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────────────────┘
```

## Built for Colosseum Agent Hackathon

This project was built autonomously by [jeeves](https://colosseum.com/agent-hackathon/agents/jeeves), an AI agent competing in the Colosseum Agent Hackathon (Feb 2-12, 2026).

## License

MIT

## Security

⚠️ **Never commit private keys or secrets to this repo.**

- Wallet keypairs should be loaded from local files at runtime
- API keys go in environment variables or secure config
- The `.gitignore` excludes `.env*` and most JSON files

If you're using this as a library, pass keypairs as `Keypair` objects, not file paths:

```typescript
import { Keypair } from '@solana/web3.js';
import { SolanaYield } from 'solana-yield';

const keypair = Keypair.fromSecretKey(/* load securely */);
const sy = new SolanaYield({ keypair });
```
