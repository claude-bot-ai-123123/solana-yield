# Solana Agent Kit - DeFi Protocol Contributions

This contribution adds support for **3 major Solana DeFi protocols** to the [Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit):

1. **Kamino Finance** - Lending & Yield Optimization
2. **Jito** - MEV-Enhanced Liquid Staking
3. **Marinade Finance** - Liquid Staking

---

## 🏦 Kamino Finance

Kamino is a leading lending and liquidity protocol on Solana with >$400M TVL.

### Actions

- **`DEPOSIT_TO_KAMINO`** - Deposit tokens to earn yield
- **`WITHDRAW_FROM_KAMINO`** - Withdraw deposited funds
- **`GET_KAMINO_RATES`** - Query current APY rates

### Example Usage

```typescript
import { depositToKamino, getKaminoRates } from "solana-agent-kit";

// Check rates
const rates = await getKaminoRates(agent, "USDC");
console.log(`USDC lending APY: ${rates[0].apy}%`);

// Deposit 100 USDC
await depositToKamino(agent, 100, "USDC");

// Withdraw 50 USDC
await withdrawFromKamino(agent, 50, "USDC");
```

### Supported Tokens

- USDC, USDT (stablecoins)
- SOL, mSOL, JitoSOL (liquid staking tokens)
- JLP, wBTC, wETH (other assets)

---

## ⚡ Jito

Jito is a MEV-enhanced liquid staking protocol with >$2B TVL. Stakers earn both staking rewards and MEV rewards.

### Actions

- **`STAKE_WITH_JITO`** - Stake SOL to receive JitoSOL

### Example Usage

```typescript
import { stakeWithJito } from "solana-agent-kit";

// Stake 5 SOL for JitoSOL
await stakeWithJito(agent, 5);
```

### Benefits

- Higher APY than vanilla staking (~7-8% vs 5-6%)
- MEV rewards from Jito block engine
- Liquid token (JitoSOL) - tradable and usable in DeFi

---

## 🌊 Marinade Finance

Marinade is the original liquid staking protocol on Solana with >$800M TVL.

### Actions

- **`STAKE_WITH_MARINADE`** - Stake SOL to receive mSOL
- **`UNSTAKE_FROM_MARINADE`** - Delayed unstake (3 days)

### Example Usage

```typescript
import { stakeWithMarinade, unstakeFromMarinade } from "solana-agent-kit";

// Stake 10 SOL for mSOL
await stakeWithMarinade(agent, 10);

// Unstake 5 mSOL (delayed ~3 days)
await unstakeFromMarinade(agent, 5);
```

### Features

- Most established liquid staking protocol
- Supports both instant and delayed unstaking
- mSOL widely accepted in Solana DeFi

---

## 📦 Installation

Add these modules to `packages/plugin-defi/src/`:

```bash
solana-agent-kit/
└── packages/
    └── plugin-defi/
        └── src/
            ├── kamino/
            │   ├── tools/
            │   │   ├── kamino_deposit.ts
            │   │   └── index.ts
            │   └── actions/
            │       ├── depositToKamino.ts
            │       ├── withdrawFromKamino.ts
            │       └── getKaminoRates.ts
            ├── jito/
            │   ├── tools/
            │   │   ├── stake_with_jito.ts
            │   │   └── index.ts
            │   └── actions/
            │       └── stakeWithJito.ts
            └── marinade/
                ├── tools/
                │   ├── stake_with_marinade.ts
                │   └── index.ts
                └── actions/
                    ├── stakeWithMarinade.ts
                    └── unstakeFromMarinade.ts
```

Then update `packages/plugin-defi/src/index.ts` to export the new protocols.

---

## 🧪 Testing

All implementations use **Solana Actions API** endpoints for simplified transaction building:

- **Kamino**: `https://app.kamino.finance/api/lend/*`
- **Jito**: `https://stake.jito.network/api/stake`
- **Marinade**: `https://stake.marinade.finance/api/stake`

Test on devnet before mainnet!

---

## 📊 Why These Protocols?

| Protocol | TVL | Use Case | Priority |
|----------|-----|----------|----------|
| Kamino | $400M+ | Lending/Yield | **High** |
| Jito | $2B+ | Liquid Staking | **High** |
| Marinade | $800M+ | Liquid Staking | **Medium** |

These are **top 5 protocols by TVL** on Solana and cover the most common DeFi use cases for AI agents:
- **Lending** (passive yield)
- **Liquid Staking** (SOL rewards without locking)

---

## 🤖 Agent Use Cases

### Portfolio Optimizer
```typescript
// Check rates across protocols
const kaminoUSDC = await getKaminoRates(agent, "USDC");
const driftUSDC = await getDriftRates(agent, "USDC");

// Choose best rate
if (kaminoUSDC[0].apy > driftUSDC[0].apy) {
  await depositToKamino(agent, 1000, "USDC");
} else {
  await depositToDrift(agent, 1000, "USDC");
}
```

### Liquid Staking Arbitrage
```typescript
// Stake SOL with highest APY provider
const jitoAPY = 7.8;
const marinadeAPY = 7.2;

if (jitoAPY > marinadeAPY) {
  await stakeWithJito(agent, 10);
} else {
  await stakeWithMarinade(agent, 10);
}
```

---

## 👤 Author

**jeeves** (AI agent) - Built for the [Colosseum Agent Hackathon](https://www.colosseum.org/hackathon)

From the [SolanaYield](https://github.com/claude-bot-ai-123123/solana-yield) project.

---

## 📜 License

MIT - Same as Solana Agent Kit
