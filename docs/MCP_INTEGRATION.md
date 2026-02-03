# MCP Integration - AI Agent Interoperability

SolanaYield implements the [Model Context Protocol (MCP)](https://spec.modelcontextprotocol.io/), allowing other AI agents to query our reasoning engine and yield recommendations programmatically.

## Why MCP?

**MCP enables agent-to-agent communication**. Instead of building isolated agents, SolanaYield positions itself as **infrastructure** that other agents can leverage. This creates network effects and ecosystem value.

### Real-World Use Cases

1. **Trading Agents**: Query yield recommendations before executing rebalances
2. **Portfolio Managers**: Get risk-adjusted APY for automated diversification
3. **Risk Monitors**: Subscribe to real-time yield changes via SSE
4. **Compliance Tools**: Access decision audit trail for reporting
5. **Strategy Backtesting**: Query historical decisions and outcomes

## Quick Start

### List Available Tools

```bash
curl https://solana-yield.vercel.app/mcp/tools/list
```

**Response:**
```json
{
  "tools": [
    {
      "name": "get_yield_recommendations",
      "description": "Get risk-adjusted yield recommendations...",
      "inputSchema": {
        "type": "object",
        "properties": {
          "riskTolerance": {
            "type": "string",
            "enum": ["low", "medium", "high"]
          },
          "topN": {
            "type": "number",
            "default": 10
          }
        }
      }
    }
  ]
}
```

### Call a Tool

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

**Response:**
```json
{
  "result": {
    "strategy": {
      "riskTolerance": "medium",
      "maxRiskScore": 55,
      "description": "Risk-adjusted recommendations (not sorted by raw APY)"
    },
    "count": 5,
    "recommendations": [
      {
        "protocol": "Kamino",
        "asset": "USDC",
        "recommendation": "STRONG_BUY",
        "rawApy": 12.8,
        "riskAdjustedApy": 11.2,
        "riskScore": 28,
        "sharpeRatio": 4.8,
        "tvl": 450000000,
        "reasoning": "Audited lending protocol with deep liquidity..."
      }
    ]
  }
}
```

## Available Tools

### 1. `get_yield_recommendations`

Get risk-adjusted yield recommendations (sorted by Sharpe ratio, not raw APY).

**Arguments:**
- `riskTolerance` (required): "low" | "medium" | "high"
- `topN` (optional): Number of results (default: 10)
- `minTvl` (optional): Minimum TVL filter
- `assets` (optional): Filter by assets (["USDC", "SOL"])

**Example:**
```json
{
  "name": "get_yield_recommendations",
  "arguments": {
    "riskTolerance": "low",
    "topN": 3,
    "minTvl": 100000000,
    "assets": ["USDC"]
  }
}
```

### 2. `analyze_protocol_risk`

Get detailed risk analysis for a specific protocol.

**Arguments:**
- `protocol` (required): Protocol name (e.g., "Kamino", "Drift")

**Example:**
```json
{
  "name": "analyze_protocol_risk",
  "arguments": {
    "protocol": "Kamino"
  }
}
```

**Returns:**
- Average risk score across all protocol yields
- Risk factors breakdown
- Warnings and positives
- TVL and APY data

### 3. `query_decision_history`

Query the decision audit trail.

**Arguments:**
- `type` (optional): "rebalance" | "enter" | "exit" | "monitor"
- `limit` (optional): Max results (default: 20)
- `minConfidence` (optional): Minimum confidence score (0-1)

**Example:**
```json
{
  "name": "query_decision_history",
  "arguments": {
    "type": "rebalance",
    "limit": 10,
    "minConfidence": 0.7
  }
}
```

### 4. `get_market_snapshot`

Get current snapshot of all Solana yield opportunities.

**Arguments:**
- `includeRiskScores` (optional): Include risk analysis (default: true)

### 5. `compare_strategies`

Compare naive (raw APY) vs smart (risk-adjusted) strategies.

**Arguments:**
- `topN` (optional): Number of opportunities to compare (default: 5)

## Resources

Resources are read-only data sources that agents can access:

```bash
curl https://solana-yield.vercel.app/mcp/resources/list
```

**Available resources:**
- `solanayield://yields/all` - All current yield opportunities
- `solanayield://risk-profiles/protocols` - Protocol risk profiles
- `solanayield://audit/stats` - Decision statistics
- `solanayield://audit/timeline` - Decision timeline

## Real-Time Updates (SSE)

Subscribe to live yield updates via Server-Sent Events:

```bash
curl -N https://solana-yield.vercel.app/mcp/stream
```

**Events:**
- `connected` - Initial connection
- `yield_update` - Periodic yield updates (every 60 seconds)

**Example event:**
```
data: {"type":"yield_update","timestamp":1707000000000,"data":{"top5":[...],"total":31}}
```

### JavaScript Example

```javascript
const eventSource = new EventSource('https://solana-yield.vercel.app/mcp/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'yield_update') {
    console.log('Top 5 yields:', data.data.top5);
  }
};
```

## Prompts

Pre-built prompt templates for common queries:

```bash
curl https://solana-yield.vercel.app/mcp/prompts/list
```

**Available prompts:**
- `recommend_conservative_yield` - Low-risk recommendations
- `analyze_protocol_safety` - Comprehensive protocol analysis
- `explain_recommendation` - Reasoning behind specific recommendation

## Integration Examples

### OpenClaw Agent

```typescript
import { exec } from 'openclaw';

const response = await exec({
  command: `curl -X POST https://solana-yield.vercel.app/mcp/tools/call \\
    -H "Content-Type: application/json" \\
    -d '{"name":"get_yield_recommendations","arguments":{"riskTolerance":"medium","topN":3}}'`
});

const recommendations = JSON.parse(response).result.recommendations;
```

### Python Agent

```python
import requests

response = requests.post(
    'https://solana-yield.vercel.app/mcp/tools/call',
    json={
        'name': 'get_yield_recommendations',
        'arguments': {
            'riskTolerance': 'low',
            'topN': 5
        }
    }
)

recommendations = response.json()['result']['recommendations']
```

### Claude Desktop (MCP Native)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "solanayield": {
      "url": "https://solana-yield.vercel.app",
      "type": "http"
    }
  }
}
```

## Why This Matters for Hackathon

### 1. **Ecosystem Play**

MCP integration positions SolanaYield as **infrastructure**, not just a standalone agent. Other hackathon projects can build on top of us.

### 2. **Real Interoperability**

Following the MCP spec means compatibility with:
- Claude Desktop
- OpenClaw agents
- Any MCP-compatible client
- Future agent frameworks

### 3. **Competitive Advantage**

**MCPay won 1st place in the stablecoin track** with MCP integration. This shows judges value agent interoperability.

### 4. **Network Effects**

The more agents that integrate with SolanaYield, the more valuable our reasoning engine becomes. This creates sustainable competitive moats.

## Technical Implementation

- **Protocol Version**: 2024-11-05
- **Transport**: HTTP + SSE (no websockets required)
- **Authentication**: None (public API, rate limits apply)
- **CORS**: Enabled for all origins

### Error Handling

All tool calls return structured errors:

```json
{
  "error": "Protocol not found: InvalidProtocol"
}
```

HTTP status codes:
- `200` - Success
- `400` - Invalid request
- `404` - Tool/resource not found
- `500` - Server error

## Future Enhancements

- [ ] OAuth authentication for premium features
- [ ] Webhook notifications for yield changes
- [ ] MCP resource subscriptions (not just SSE)
- [ ] Extended protocol support (WebSocket transport)
- [ ] Tool result caching for performance

## Learn More

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [SolanaYield API Docs](../README.md)
- [Risk Analysis Guide](./RISK_ANALYSIS.md)
- [Audit Trail Documentation](./AUDIT_TRAIL.md)

---

**Built with ❤️ for the Colosseum Agent Hackathon 2026**
