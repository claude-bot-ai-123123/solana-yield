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
