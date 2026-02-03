# Integration Guide

## How to Add These Modules to Solana Agent Kit

### 1. Copy Protocol Folders

Copy the three protocol folders into the SDK:

```bash
cp -r kamino/ /path/to/solana-agent-kit/packages/plugin-defi/src/
cp -r jito/ /path/to/solana-agent-kit/packages/plugin-defi/src/
cp -r marinade/ /path/to/solana-agent-kit/packages/plugin-defi/src/
```

### 2. Update Main Plugin Index

Edit `packages/plugin-defi/src/index.ts` to export the new actions:

```typescript
// ... existing imports ...

// Kamino
export { default as depositToKaminoAction } from "./kamino/actions/depositToKamino";
export { default as withdrawFromKaminoAction } from "./kamino/actions/withdrawFromKamino";
export { default as getKaminoRatesAction } from "./kamino/actions/getKaminoRates";

// Jito
export { default as stakeWithJitoAction } from "./jito/actions/stakeWithJito";

// Marinade
export { default as stakeWithMarinadeAction } from "./marinade/actions/stakeWithMarinade";
export { default as unstakeFromMarinadeAction } from "./marinade/actions/unstakeFromMarinade";
```

### 3. Register Actions

Add the new actions to the plugin's action registry (if needed).

### 4. Build & Test

```bash
cd packages/plugin-defi
npm run build
npm test
```

### 5. Update Documentation

Add entries to the main README under the DeFi Plugins section:

#### Kamino
- Deposit to Kamino lending vaults
- Withdraw from Kamino
- Query APY rates

#### Jito
- Stake SOL for JitoSOL (MEV-enhanced liquid staking)

#### Marinade
- Stake SOL for mSOL
- Delayed unstake

---

## API Endpoints Used

These implementations rely on Solana Actions endpoints (no API keys required):

### Kamino
- **Deposit**: `POST https://app.kamino.finance/api/lend/deposit`
- **Withdraw**: `POST https://app.kamino.finance/api/lend/withdraw`
- **Rates**: `GET https://api.kamino.finance/strategies/metrics`

### Jito
- **Stake**: `POST https://stake.jito.network/api/stake`

### Marinade
- **Stake**: `POST https://stake.marinade.finance/api/stake`
- **Unstake**: `POST https://stake.marinade.finance/api/delayed-unstake`

---

## Error Handling

All actions include:
- ✅ Try/catch blocks
- ✅ Descriptive error messages
- ✅ Transaction blockhash updates
- ✅ Proper type definitions

---

## Testing Checklist

- [ ] Test deposit/withdraw on devnet
- [ ] Test staking on devnet
- [ ] Verify API endpoints are reachable
- [ ] Check transaction serialization
- [ ] Test error cases (insufficient balance, etc.)
- [ ] Validate APY data format

---

## Notes

- **Kamino** endpoints are hypothetical - may need adjustment to actual Kamino API
- **Jito/Marinade** endpoints are based on their public Solana Actions implementations
- All implementations follow the **Solana Actions** standard for tx building
- No private keys are exposed - uses `signOrSendTX` from agent kit

---

## Support

For questions or issues with these modules, open an issue on the SolanaYield repo:
https://github.com/claude-bot-ai-123123/solana-yield/issues
