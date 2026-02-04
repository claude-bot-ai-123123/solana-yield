/**
 * Real-time Yield Alert Dashboard
 * 
 * Beautiful cyberpunk UI for monitoring yield alerts across Solana DeFi.
 */

export const config = {
  runtime: 'edge',
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SolanaYield // YIELD ALERTS</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --neon-cyan: #00fff9;
      --neon-pink: #ff00ff;
      --neon-green: #39ff14;
      --neon-yellow: #ffff00;
      --neon-red: #ff3333;
      --neon-purple: #9d00ff;
      --dark-bg: #0a0a0f;
      --darker-bg: #050508;
      --grid-color: rgba(0, 255, 249, 0.05);
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
      border-bottom: 1px solid var(--neon-cyan);
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
      animation: pulse-cyan 2s ease-in-out infinite;
    }

    .logo-text {
      background: linear-gradient(90deg, var(--neon-cyan), var(--neon-green));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    @keyframes pulse-cyan {
      0%, 100% { opacity: 1; filter: drop-shadow(0 0 10px var(--neon-cyan)); }
      50% { opacity: 0.7; filter: drop-shadow(0 0 20px var(--neon-cyan)); }
    }

    .status-bar {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8rem;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--neon-green);
      animation: blink 1.5s ease-in-out infinite;
    }

    .status-dot.warning { background: var(--neon-yellow); }
    .status-dot.critical { background: var(--neon-red); }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .container {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 20px;
      padding: 20px 40px;
      max-width: 1800px;
      margin: 0 auto;
    }

    .main-panel {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
    }

    .stat-card {
      background: var(--darker-bg);
      border: 1px solid rgba(0, 255, 249, 0.2);
      border-radius: 4px;
      padding: 15px;
      text-align: center;
    }

    .stat-value {
      font-family: 'Orbitron', sans-serif;
      font-size: 2rem;
      font-weight: 900;
      margin-bottom: 5px;
    }

    .stat-value.cyan { color: var(--neon-cyan); }
    .stat-value.green { color: var(--neon-green); }
    .stat-value.yellow { color: var(--neon-yellow); }
    .stat-value.red { color: var(--neon-red); }

    .stat-label {
      font-size: 0.7rem;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .alert-feed {
      background: var(--darker-bg);
      border: 1px solid rgba(0, 255, 249, 0.2);
      border-radius: 4px;
      padding: 20px;
      max-height: calc(100vh - 350px);
      overflow-y: auto;
    }

    .feed-header {
      font-family: 'Orbitron', sans-serif;
      font-size: 0.85rem;
      color: var(--neon-cyan);
      margin-bottom: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(0, 255, 249, 0.1);
    }

    .alert-card {
      margin-bottom: 12px;
      padding: 15px;
      background: rgba(0, 255, 249, 0.03);
      border-left: 4px solid var(--neon-cyan);
      border-radius: 4px;
      animation: fadeIn 0.3s ease-out;
    }

    .alert-card.info { border-left-color: var(--neon-cyan); }
    .alert-card.warning { border-left-color: var(--neon-yellow); background: rgba(255, 255, 0, 0.03); }
    .alert-card.critical { border-left-color: var(--neon-red); background: rgba(255, 51, 51, 0.05); }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .alert-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }

    .alert-title {
      font-size: 0.9rem;
      font-weight: bold;
    }

    .alert-badge {
      font-size: 0.6rem;
      padding: 3px 8px;
      border-radius: 3px;
      text-transform: uppercase;
      font-weight: bold;
    }

    .alert-card.info .alert-badge { background: var(--neon-cyan); color: var(--dark-bg); }
    .alert-card.warning .alert-badge { background: var(--neon-yellow); color: var(--dark-bg); }
    .alert-card.critical .alert-badge { background: var(--neon-red); color: #fff; }

    .alert-message {
      font-size: 0.8rem;
      color: #aaa;
      margin-bottom: 8px;
    }

    .alert-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.7rem;
      color: #666;
    }

    .alert-protocol {
      color: var(--neon-purple);
      font-weight: bold;
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
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(0, 255, 249, 0.1);
    }

    .condition-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      margin-bottom: 8px;
      background: rgba(0, 255, 249, 0.03);
      border-radius: 4px;
    }

    .condition-info {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .condition-type {
      font-size: 0.8rem;
      font-weight: bold;
    }

    .condition-target {
      font-size: 0.7rem;
      color: #666;
    }

    .condition-status {
      font-size: 0.65rem;
      padding: 3px 8px;
      border-radius: 3px;
      background: rgba(57, 255, 20, 0.2);
      color: var(--neon-green);
    }

    .condition-status.triggered {
      background: rgba(255, 255, 0, 0.2);
      color: var(--neon-yellow);
    }

    .preset-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .preset-btn {
      width: 100%;
      padding: 12px;
      background: transparent;
      border: 1px solid rgba(0, 255, 249, 0.3);
      color: #ccc;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      text-align: left;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .preset-btn:hover {
      border-color: var(--neon-cyan);
      background: rgba(0, 255, 249, 0.05);
      color: var(--neon-cyan);
    }

    .preset-name {
      font-weight: bold;
      margin-bottom: 3px;
    }

    .preset-desc {
      font-size: 0.65rem;
      color: #666;
    }

    .action-btn {
      width: 100%;
      padding: 12px;
      margin-top: 10px;
      background: transparent;
      border: 1px solid var(--neon-green);
      color: var(--neon-green);
      font-family: 'Orbitron', sans-serif;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      cursor: pointer;
      transition: all 0.3s ease;
      border-radius: 4px;
    }

    .action-btn:hover {
      background: var(--neon-green);
      color: var(--dark-bg);
      box-shadow: 0 0 20px rgba(57, 255, 20, 0.3);
    }

    .action-btn.primary {
      border-color: var(--neon-cyan);
      color: var(--neon-cyan);
    }

    .action-btn.primary:hover {
      background: var(--neon-cyan);
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

    .stream-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.7rem;
      color: #666;
    }

    .stream-status.connected {
      color: var(--neon-green);
    }

    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: var(--darker-bg); }
    ::-webkit-scrollbar-thumb { background: var(--neon-cyan); border-radius: 2px; }

    @media (max-width: 1200px) {
      .container { grid-template-columns: 1fr; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="scanlines"></div>

  <header class="header">
    <div class="logo">
      <span class="logo-icon">🔔</span>
      <span class="logo-text">YIELD ALERT SYSTEM</span>
    </div>
    <div class="status-bar">
      <div class="status-item">
        <div class="status-dot" id="streamDot"></div>
        <span id="streamStatus">Connecting...</span>
      </div>
    </div>
  </header>

  <main class="container">
    <section class="main-panel">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value cyan" id="activeConditions">0</div>
          <div class="stat-label">Active Conditions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value green" id="totalAlerts">0</div>
          <div class="stat-label">Total Alerts</div>
        </div>
        <div class="stat-card">
          <div class="stat-value yellow" id="alertsToday">0</div>
          <div class="stat-label">Alerts Today</div>
        </div>
        <div class="stat-card">
          <div class="stat-value red" id="unacknowledged">0</div>
          <div class="stat-label">Unacknowledged</div>
        </div>
      </div>

      <div class="alert-feed">
        <div class="feed-header">
          <span>📡 LIVE ALERT FEED</span>
          <span class="stream-status" id="feedStatus">Waiting for alerts...</span>
        </div>
        <div id="alertList">
          <div class="no-alerts">
            <div class="no-alerts-icon">⏳</div>
            <div>Connecting to alert stream...</div>
          </div>
        </div>
      </div>
    </section>

    <aside class="sidebar">
      <div class="panel">
        <div class="panel-title">Active Conditions</div>
        <div id="conditionList">Loading...</div>
      </div>

      <div class="panel">
        <div class="panel-title">Quick Presets</div>
        <div class="preset-list">
          <button class="preset-btn" onclick="activatePreset('yield-hunter')">
            <div class="preset-name">🎯 Yield Hunter</div>
            <div class="preset-desc">Alert on high APY opportunities (15%+ APY, low risk)</div>
          </button>
          <button class="preset-btn" onclick="activatePreset('whale-alert')">
            <div class="preset-name">🐋 Whale Alert</div>
            <div class="preset-desc">Track large TVL movements (25%+ changes)</div>
          </button>
          <button class="preset-btn" onclick="activatePreset('risk-monitor')">
            <div class="preset-name">🛡️ Risk Monitor</div>
            <div class="preset-desc">Track risk score and APY volatility</div>
          </button>
          <button class="preset-btn" onclick="activatePreset('conservative')">
            <div class="preset-name">🏦 Conservative</div>
            <div class="preset-desc">Stablecoin-focused, low-risk alerts</div>
          </button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">Actions</div>
        <button class="action-btn primary" onclick="triggerCheck()">
          ⚡ Run Alert Check Now
        </button>
        <button class="action-btn" onclick="acknowledgeAll()">
          ✓ Acknowledge All Alerts
        </button>
      </div>

      <div class="panel">
        <div class="panel-title">Alert Types</div>
        <div style="font-size: 0.7rem; color: #888; line-height: 1.8;">
          📈 APY above/below threshold<br>
          📊 APY change percentage<br>
          💰 TVL significant changes<br>
          ⚠️ Risk score increases<br>
          ✨ New opportunities<br>
          🔔 Protocol events
        </div>
      </div>
    </aside>
  </main>

  <script>
    let eventSource = null;
    let alerts = [];
    let conditions = [];

    // Connect to SSE stream
    function connectStream() {
      if (eventSource) {
        eventSource.close();
      }

      eventSource = new EventSource('/api/yield-alerts?action=stream');
      
      eventSource.onopen = () => {
        document.getElementById('streamDot').className = 'status-dot';
        document.getElementById('streamStatus').textContent = 'Connected';
        document.getElementById('feedStatus').textContent = 'Live stream active';
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleStreamEvent(data);
        } catch (err) {
          console.error('Parse error:', err);
        }
      };

      eventSource.onerror = () => {
        document.getElementById('streamDot').className = 'status-dot critical';
        document.getElementById('streamStatus').textContent = 'Reconnecting...';
        
        setTimeout(() => {
          connectStream();
        }, 3000);
      };
    }

    function handleStreamEvent(event) {
      switch (event.type) {
        case 'welcome':
          updateStats(event.data.stats);
          if (event.data.recentAlerts) {
            alerts = event.data.recentAlerts;
            renderAlerts();
          }
          break;
          
        case 'alert':
          alerts.unshift(event.data);
          alerts = alerts.slice(0, 50);
          renderAlerts();
          updateStats();
          
          // Flash effect
          document.getElementById('alertsToday').style.animation = 'none';
          setTimeout(() => {
            document.getElementById('alertsToday').style.animation = 'pulse-cyan 0.5s';
          }, 10);
          break;
          
        case 'stats':
          updateStats(event.data);
          break;
      }
    }

    function updateStats(stats) {
      if (stats) {
        document.getElementById('activeConditions').textContent = stats.activeConditions || 0;
        document.getElementById('totalAlerts').textContent = stats.totalAlerts || 0;
        document.getElementById('alertsToday').textContent = stats.alertsToday || 0;
      }
      
      const unack = alerts.filter(a => !a.acknowledged).length;
      document.getElementById('unacknowledged').textContent = unack;
    }

    function renderAlerts() {
      const container = document.getElementById('alertList');
      
      if (alerts.length === 0) {
        container.innerHTML = \`
          <div class="no-alerts">
            <div class="no-alerts-icon">✨</div>
            <div>No alerts yet</div>
            <div style="font-size: 0.8rem; color: #666; margin-top: 10px;">
              Create conditions or activate a preset to start receiving alerts
            </div>
          </div>
        \`;
        return;
      }
      
      container.innerHTML = alerts.map(alert => \`
        <div class="alert-card \${alert.severity}">
          <div class="alert-header">
            <span class="alert-title">\${alert.title}</span>
            <span class="alert-badge">\${alert.severity}</span>
          </div>
          <div class="alert-message">\${alert.message}</div>
          <div class="alert-meta">
            <span class="alert-protocol">\${alert.protocol} / \${alert.asset}</span>
            <span>\${formatTime(alert.timestamp)}</span>
          </div>
        </div>
      \`).join('');
    }

    function formatTime(ts) {
      const d = new Date(ts);
      return d.toLocaleTimeString();
    }

    // Load initial data
    async function loadInitialData() {
      try {
        const [condRes, histRes] = await Promise.all([
          fetch('/api/yield-alerts?action=conditions'),
          fetch('/api/yield-alerts?action=history&limit=20')
        ]);
        
        const condData = await condRes.json();
        const histData = await histRes.json();
        
        conditions = condData.conditions || [];
        alerts = histData.alerts || [];
        
        renderConditions();
        renderAlerts();
        updateStats({ 
          activeConditions: conditions.filter(c => c.enabled).length,
          totalAlerts: alerts.length,
          alertsToday: alerts.filter(a => a.timestamp > Date.now() - 86400000).length
        });
      } catch (err) {
        console.error('Load error:', err);
      }
    }

    function renderConditions() {
      const container = document.getElementById('conditionList');
      
      if (conditions.length === 0) {
        container.innerHTML = '<div style="color: #666; text-align: center; padding: 15px;">No conditions configured</div>';
        return;
      }
      
      container.innerHTML = conditions.map(c => \`
        <div class="condition-item">
          <div class="condition-info">
            <div class="condition-type">\${formatConditionType(c.type)}</div>
            <div class="condition-target">\${c.protocol || '*'} / \${c.asset || '*'} @ \${c.threshold || c.changePercent || '-'}%</div>
          </div>
          <div class="condition-status \${c.triggerCount > 0 ? 'triggered' : ''}">\${c.triggerCount}x</div>
        </div>
      \`).join('');
    }

    function formatConditionType(type) {
      const types = {
        'apy_above': '📈 APY Above',
        'apy_below': '📉 APY Below',
        'apy_change': '📊 APY Change',
        'tvl_change': '💰 TVL Change',
        'risk_increase': '⚠️ Risk Increase',
        'risk_decrease': '🟢 Risk Decrease',
        'new_opportunity': '✨ New Opportunity',
      };
      return types[type] || type;
    }

    async function activatePreset(preset) {
      try {
        const res = await fetch(\`/api/yield-alerts?action=presets&preset=\${preset}\`, {
          method: 'POST'
        });
        const data = await res.json();
        
        if (data.success) {
          alert(\`Created \${data.conditionsCreated} condition(s) from "\${preset}" preset!\\n\\nNote: In demo mode, these won't persist across page reloads.\`);
          loadInitialData();
        }
      } catch (err) {
        console.error('Preset error:', err);
      }
    }

    async function triggerCheck() {
      try {
        document.getElementById('feedStatus').textContent = 'Running check...';
        
        const res = await fetch('/api/yield-alerts?action=check', { method: 'POST' });
        const data = await res.json();
        
        document.getElementById('feedStatus').textContent = \`Checked \${data.yieldsChecked} yields, \${data.alertsGenerated} alerts\`;
        
        if (data.alerts && data.alerts.length > 0) {
          alerts = [...data.alerts, ...alerts].slice(0, 50);
          renderAlerts();
        }
      } catch (err) {
        console.error('Check error:', err);
        document.getElementById('feedStatus').textContent = 'Check failed';
      }
    }

    async function acknowledgeAll() {
      try {
        const res = await fetch('/api/yield-alerts?action=acknowledge', { method: 'POST' });
        const data = await res.json();
        
        alerts.forEach(a => a.acknowledged = true);
        updateStats();
        
        alert(\`Acknowledged \${data.acknowledgedCount} alert(s)\`);
      } catch (err) {
        console.error('Acknowledge error:', err);
      }
    }

    // Initialize
    loadInitialData();
    connectStream();
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
