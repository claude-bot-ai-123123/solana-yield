/**
 * Live Rug Pull Alert Dashboard
 * 
 * Real-time monitoring UI showing active threats across Solana DeFi.
 * Cyberpunk aesthetic. Trust verification made visible.
 */

export const config = {
  runtime: 'edge',
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SolanaYield // RUG DETECTION</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --neon-cyan: #00fff9;
      --neon-pink: #ff00ff;
      --neon-green: #39ff14;
      --neon-yellow: #ffff00;
      --neon-red: #ff3333;
      --dark-bg: #0a0a0f;
      --darker-bg: #050508;
      --grid-color: rgba(255, 51, 51, 0.08);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: var(--dark-bg);
      color: #fff;
      font-family: 'JetBrains Mono', monospace;
      min-height: 100vh;
      overflow-x: hidden;
    }

    .grid-bg {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background-image: 
        linear-gradient(var(--grid-color) 1px, transparent 1px),
        linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
      background-size: 50px 50px;
      z-index: -1;
    }

    .scanlines {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: repeating-linear-gradient(
        0deg,
        rgba(0, 0, 0, 0.15),
        rgba(0, 0, 0, 0.15) 1px,
        transparent 1px,
        transparent 2px
      );
      pointer-events: none;
      z-index: 1000;
    }

    .header {
      padding: 20px 40px;
      border-bottom: 1px solid var(--neon-red);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(10, 10, 15, 0.95);
    }

    .logo {
      font-family: 'Orbitron', sans-serif;
      font-size: 1.3rem;
      font-weight: 900;
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .logo-icon {
      font-size: 1.8rem;
      animation: pulse-red 2s ease-in-out infinite;
    }

    .logo-text {
      background: linear-gradient(90deg, var(--neon-red), var(--neon-yellow));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    @keyframes pulse-red {
      0%, 100% { opacity: 1; filter: drop-shadow(0 0 10px var(--neon-red)); }
      50% { opacity: 0.7; filter: drop-shadow(0 0 20px var(--neon-red)); }
    }

    .market-status {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 10px 20px;
      border: 1px solid var(--neon-red);
      border-radius: 4px;
      background: rgba(255, 51, 51, 0.1);
    }

    .market-status.normal {
      border-color: var(--neon-green);
      background: rgba(57, 255, 20, 0.1);
    }

    .market-status.warning {
      border-color: var(--neon-yellow);
      background: rgba(255, 255, 0, 0.1);
    }

    .status-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--neon-red);
      animation: blink-status 1s ease-in-out infinite;
    }

    .market-status.normal .status-indicator { background: var(--neon-green); }
    .market-status.warning .status-indicator { background: var(--neon-yellow); }

    @keyframes blink-status {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    .status-label {
      font-family: 'Orbitron', sans-serif;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .container {
      display: grid;
      grid-template-columns: 1fr 350px;
      gap: 20px;
      padding: 20px 40px;
      max-width: 1600px;
      margin: 0 auto;
    }

    .main-panel {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .alert-feed {
      background: var(--darker-bg);
      border: 1px solid rgba(255, 51, 51, 0.3);
      border-radius: 4px;
      padding: 20px;
      max-height: calc(100vh - 250px);
      overflow-y: auto;
    }

    .feed-header {
      font-family: 'Orbitron', sans-serif;
      font-size: 0.9rem;
      color: var(--neon-red);
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .feed-header span:first-child::before {
      content: '⚡';
      margin-right: 8px;
    }

    .refresh-indicator {
      font-size: 0.75rem;
      color: #666;
    }

    .alert-card {
      margin-bottom: 15px;
      padding: 15px;
      background: rgba(255, 51, 51, 0.05);
      border-left: 4px solid var(--neon-red);
      border-radius: 4px;
      animation: slideIn 0.5s ease-out;
    }

    .alert-card.critical {
      border-left-color: var(--neon-red);
      background: rgba(255, 51, 51, 0.1);
    }

    .alert-card.high {
      border-left-color: #ff8800;
      background: rgba(255, 136, 0, 0.08);
    }

    .alert-card.medium {
      border-left-color: var(--neon-yellow);
      background: rgba(255, 255, 0, 0.05);
    }

    .alert-card.healthy {
      border-left-color: var(--neon-green);
      background: rgba(57, 255, 20, 0.05);
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .alert-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }

    .alert-protocol {
      font-family: 'Orbitron', sans-serif;
      font-size: 0.85rem;
      color: var(--neon-cyan);
      text-transform: uppercase;
    }

    .alert-badge {
      font-size: 0.65rem;
      padding: 3px 8px;
      border-radius: 3px;
      text-transform: uppercase;
      font-weight: bold;
    }

    .alert-card.critical .alert-badge {
      background: var(--neon-red);
      color: var(--dark-bg);
    }

    .alert-card.high .alert-badge {
      background: #ff8800;
      color: var(--dark-bg);
    }

    .alert-card.medium .alert-badge {
      background: var(--neon-yellow);
      color: var(--dark-bg);
    }

    .alert-title {
      font-size: 0.95rem;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .alert-description {
      font-size: 0.8rem;
      color: #aaa;
      line-height: 1.5;
      margin-bottom: 10px;
    }

    .alert-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.7rem;
      color: #666;
    }

    .alert-recommendation {
      padding: 5px 10px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 3px;
      font-size: 0.7rem;
    }

    .alert-card.critical .alert-recommendation {
      color: var(--neon-red);
      background: rgba(255, 51, 51, 0.2);
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .panel {
      background: var(--darker-bg);
      border: 1px solid rgba(0, 255, 249, 0.2);
      border-radius: 4px;
      padding: 15px;
    }

    .panel-title {
      font-family: 'Orbitron', sans-serif;
      font-size: 0.75rem;
      color: var(--neon-cyan);
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(0, 255, 249, 0.1);
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 0.8rem;
    }

    .stat-label { color: #888; }
    .stat-value { color: var(--neon-cyan); font-weight: bold; }
    .stat-value.danger { color: var(--neon-red); }
    .stat-value.warning { color: var(--neon-yellow); }
    .stat-value.safe { color: var(--neon-green); }

    .protocol-list {
      max-height: 300px;
      overflow-y: auto;
    }

    .protocol-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      margin-bottom: 8px;
      background: rgba(0, 255, 249, 0.03);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .protocol-item:hover {
      background: rgba(0, 255, 249, 0.08);
    }

    .protocol-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .protocol-name {
      font-size: 0.85rem;
      font-weight: bold;
    }

    .protocol-tvl {
      font-size: 0.7rem;
      color: #666;
    }

    .risk-badge {
      font-size: 0.7rem;
      padding: 4px 8px;
      border-radius: 3px;
      font-weight: bold;
    }

    .risk-badge.A { background: var(--neon-green); color: var(--dark-bg); }
    .risk-badge.B { background: #88ff88; color: var(--dark-bg); }
    .risk-badge.C { background: var(--neon-yellow); color: var(--dark-bg); }
    .risk-badge.D { background: #ff8800; color: var(--dark-bg); }
    .risk-badge.F { background: var(--neon-red); color: #fff; }

    .action-btn {
      width: 100%;
      padding: 12px;
      margin-top: 10px;
      background: transparent;
      border: 1px solid var(--neon-cyan);
      color: var(--neon-cyan);
      font-family: 'Orbitron', sans-serif;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .action-btn:hover {
      background: var(--neon-cyan);
      color: var(--dark-bg);
      box-shadow: 0 0 20px rgba(0, 255, 249, 0.3);
    }

    .no-alerts {
      text-align: center;
      padding: 40px;
      color: var(--neon-green);
    }

    .no-alerts-icon {
      font-size: 3rem;
      margin-bottom: 15px;
    }

    .no-alerts-text {
      font-family: 'Orbitron', sans-serif;
      font-size: 1rem;
    }

    .no-alerts-sub {
      font-size: 0.8rem;
      color: #666;
      margin-top: 10px;
    }

    .agent-insight {
      margin-top: 15px;
      padding: 15px;
      background: rgba(0, 255, 249, 0.05);
      border: 1px solid rgba(0, 255, 249, 0.2);
      border-radius: 4px;
    }

    .insight-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      font-family: 'Orbitron', sans-serif;
      font-size: 0.75rem;
      color: var(--neon-cyan);
    }

    .insight-text {
      font-size: 0.8rem;
      line-height: 1.6;
      color: #ccc;
    }

    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: var(--darker-bg); }
    ::-webkit-scrollbar-thumb { background: var(--neon-red); border-radius: 2px; }

    @media (max-width: 1000px) {
      .container { grid-template-columns: 1fr; padding: 10px; }
      .header { padding: 15px; }
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="scanlines"></div>

  <header class="header">
    <div class="logo">
      <span class="logo-icon">🛡️</span>
      <span class="logo-text">RUG DETECTION SYSTEM</span>
    </div>
    <div class="market-status" id="marketStatus">
      <div class="status-indicator"></div>
      <span class="status-label" id="statusLabel">SCANNING...</span>
    </div>
  </header>

  <main class="container">
    <section class="main-panel">
      <div class="alert-feed" id="alertFeed">
        <div class="feed-header">
          <span>LIVE THREAT FEED</span>
          <span class="refresh-indicator" id="refreshIndicator">Refreshing in 30s</span>
        </div>
        <div id="alertList">
          <div class="no-alerts">
            <div class="no-alerts-icon">⏳</div>
            <div class="no-alerts-text">Loading...</div>
          </div>
        </div>
      </div>

      <div class="agent-insight" id="agentInsight">
        <div class="insight-header">
          <span>🤖</span>
          <span>AGENT ANALYSIS</span>
        </div>
        <div class="insight-text" id="insightText">
          Analyzing protocol health across the Solana DeFi ecosystem...
        </div>
      </div>
    </section>

    <aside class="sidebar">
      <div class="panel">
        <div class="panel-title">Alert Summary</div>
        <div class="stat-row">
          <span class="stat-label">Critical</span>
          <span class="stat-value danger" id="criticalCount">0</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">High</span>
          <span class="stat-value warning" id="highCount">0</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Medium</span>
          <span class="stat-value" id="mediumCount">0</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Protocols Monitored</span>
          <span class="stat-value safe" id="protocolCount">0</span>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">Protocol Risk Ranking</div>
        <div class="protocol-list" id="protocolList">
          <div style="color: #666; text-align: center; padding: 20px;">Loading...</div>
        </div>
        <button class="action-btn" onclick="refreshData()">Refresh Analysis</button>
      </div>

      <div class="panel">
        <div class="panel-title">Detection Capabilities</div>
        <div style="font-size: 0.75rem; color: #888; line-height: 1.8;">
          📉 TVL collapse detection<br>
          🐋 Whale concentration monitoring<br>
          🔐 Contract authority analysis<br>
          🖨️ Mint/freeze authority flags<br>
          🔓 Token unlock tracking<br>
          ⚡ Real-time alert generation
        </div>
      </div>
    </aside>
  </main>

  <script>
    let refreshInterval = 30;
    let refreshTimer = null;

    async function fetchAlerts() {
      try {
        const [alertsRes, allRes] = await Promise.all([
          fetch('/api/rugpull?alerts=true'),
          fetch('/api/rugpull?all=true')
        ]);
        
        const alertsData = await alertsRes.json();
        const allData = await allRes.json();
        
        updateUI(alertsData, allData);
      } catch (err) {
        console.error('Fetch error:', err);
        document.getElementById('alertList').innerHTML = \`
          <div class="no-alerts" style="color: #ff4444;">
            <div class="no-alerts-icon">⚠️</div>
            <div class="no-alerts-text">Connection Error</div>
            <div class="no-alerts-sub">Unable to fetch alerts. Retrying...</div>
          </div>
        \`;
      }
    }

    function updateUI(alertsData, allData) {
      // Update market status
      const status = document.getElementById('marketStatus');
      const label = document.getElementById('statusLabel');
      
      if (alertsData.summary.critical > 0) {
        status.className = 'market-status';
        label.textContent = '🚨 ELEVATED RISK';
      } else if (alertsData.summary.high > 0) {
        status.className = 'market-status warning';
        label.textContent = '⚠️ CAUTION';
      } else {
        status.className = 'market-status normal';
        label.textContent = '✅ NORMAL';
      }

      // Update counts
      document.getElementById('criticalCount').textContent = alertsData.summary.critical;
      document.getElementById('highCount').textContent = alertsData.summary.high;
      document.getElementById('mediumCount').textContent = alertsData.summary.totalAlerts - alertsData.summary.critical - alertsData.summary.high;
      document.getElementById('protocolCount').textContent = allData.protocolCount;

      // Update alert feed
      const alertList = document.getElementById('alertList');
      
      if (alertsData.summary.totalAlerts === 0) {
        alertList.innerHTML = \`
          <div class="no-alerts">
            <div class="no-alerts-icon">✅</div>
            <div class="no-alerts-text">All Clear</div>
            <div class="no-alerts-sub">No critical alerts detected. Markets healthy.</div>
          </div>
        \`;
      } else {
        let html = '';
        for (const protocol of alertsData.alerts) {
          for (const alert of protocol.alerts) {
            html += createAlertCard(protocol.protocol, alert);
          }
        }
        alertList.innerHTML = html;
      }

      // Update protocol list
      const protocolList = document.getElementById('protocolList');
      protocolList.innerHTML = allData.protocols.map(p => \`
        <div class="protocol-item" onclick="window.open('/api/rugpull?protocol=\${p.protocol}&format=markdown', '_blank')">
          <div class="protocol-info">
            <div class="protocol-name">\${p.protocol}</div>
            <div class="protocol-tvl">\${p.tvl} · \${p.tvlChange24h}</div>
          </div>
          <span class="risk-badge \${p.riskGrade}">\${p.riskGrade}</span>
        </div>
      \`).join('');

      // Update agent insight
      updateAgentInsight(alertsData, allData);
    }

    function createAlertCard(protocol, alert) {
      const severityClass = alert.severity === 'critical' ? 'critical' : 
                           alert.severity === 'high' ? 'high' : 'medium';
      
      return \`
        <div class="alert-card \${severityClass}">
          <div class="alert-header">
            <span class="alert-protocol">\${protocol}</span>
            <span class="alert-badge">\${alert.severity}</span>
          </div>
          <div class="alert-title">\${alert.title}</div>
          <div class="alert-meta">
            <span class="alert-recommendation">\${alert.recommendation.replace(/_/g, ' ')}</span>
            <span>\${alert.type}</span>
          </div>
        </div>
      \`;
    }

    function updateAgentInsight(alertsData, allData) {
      const insight = document.getElementById('insightText');
      
      if (alertsData.summary.critical > 0) {
        insight.innerHTML = \`
          <strong style="color: var(--neon-red);">⚠️ IMMEDIATE ACTION RECOMMENDED</strong><br><br>
          Detected \${alertsData.summary.critical} critical alert(s) across monitored protocols. 
          Review flagged protocols immediately before depositing. Critical alerts indicate 
          imminent rug pull risk indicators.
        \`;
      } else if (alertsData.summary.high > 0) {
        insight.innerHTML = \`
          <strong style="color: var(--neon-yellow);">Elevated Risk Environment</strong><br><br>
          \${alertsData.summary.high} high-severity warning(s) detected. Consider reducing exposure 
          to flagged protocols or increasing monitoring frequency. No critical threats, 
          but caution advised.
        \`;
      } else {
        const avgRisk = allData.summary.avgRisk;
        insight.innerHTML = \`
          <strong style="color: var(--neon-green);">Market Health: Good</strong><br><br>
          All \${allData.protocolCount} monitored protocols operating normally. Average risk score: 
          \${avgRisk}/100. No critical or high-severity alerts. Safe to operate with standard precautions.
        \`;
      }
    }

    function refreshData() {
      document.getElementById('refreshIndicator').textContent = 'Refreshing...';
      fetchAlerts().then(() => {
        refreshInterval = 30;
      });
    }

    function updateRefreshTimer() {
      refreshInterval--;
      document.getElementById('refreshIndicator').textContent = \`Refreshing in \${refreshInterval}s\`;
      
      if (refreshInterval <= 0) {
        refreshData();
      }
    }

    // Initial load
    fetchAlerts();
    
    // Auto-refresh every 30 seconds
    refreshTimer = setInterval(updateRefreshTimer, 1000);
  </script>
</body>
</html>
`;

export default function handler(request: Request) {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
