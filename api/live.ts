export const config = {
  runtime: 'edge',
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SolanaYield // LIVE FEED</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --neon-cyan: #00fff9;
      --neon-pink: #ff00ff;
      --neon-green: #39ff14;
      --neon-yellow: #ffff00;
      --dark-bg: #0a0a0f;
      --darker-bg: #050508;
      --grid-color: rgba(0, 255, 249, 0.1);
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
      animation: gridMove 20s linear infinite;
    }

    @keyframes gridMove {
      0% { transform: perspective(500px) rotateX(60deg) translateY(0); }
      100% { transform: perspective(500px) rotateX(60deg) translateY(50px); }
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
      background: rgba(10, 10, 15, 0.9);
    }

    .logo {
      font-family: 'Orbitron', sans-serif;
      font-size: 1.5rem;
      font-weight: 900;
      background: linear-gradient(90deg, var(--neon-cyan), var(--neon-pink));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 0 30px rgba(0, 255, 249, 0.5);
    }

    .status {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .status-dot {
      width: 10px; height: 10px;
      background: var(--neon-green);
      border-radius: 50%;
      animation: pulse 1s ease-in-out infinite;
    }

    .status-dot.disconnected {
      background: #ff4444;
      animation: none;
    }

    .status-dot.connecting {
      background: var(--neon-yellow);
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 10px var(--neon-green); }
      50% { opacity: 0.5; box-shadow: 0 0 20px var(--neon-green); }
    }

    .status-text {
      color: var(--neon-green);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .status-text.disconnected { color: #ff4444; }
    .status-text.connecting { color: var(--neon-yellow); }

    .container {
      display: grid;
      grid-template-columns: 1fr 400px;
      gap: 20px;
      padding: 20px 40px;
      max-width: 1600px;
      margin: 0 auto;
    }

    .thought-stream {
      background: var(--darker-bg);
      border: 1px solid var(--neon-cyan);
      border-radius: 4px;
      padding: 20px;
      height: calc(100vh - 140px);
      overflow-y: auto;
    }

    .stream-header {
      font-family: 'Orbitron', sans-serif;
      color: var(--neon-cyan);
      font-size: 0.9rem;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .stream-header::before {
      content: '>';
      animation: blink 1s step-end infinite;
    }

    @keyframes blink { 50% { opacity: 0; } }

    .thought {
      margin-bottom: 15px;
      padding: 15px;
      background: rgba(0, 255, 249, 0.05);
      border-left: 3px solid var(--neon-cyan);
      animation: fadeIn 0.5s ease-out;
    }

    .thought.decision {
      border-left-color: var(--neon-green);
      background: rgba(57, 255, 20, 0.08);
    }

    .thought.warning {
      border-left-color: var(--neon-yellow);
      background: rgba(255, 255, 0, 0.05);
    }

    .thought.action {
      border-left-color: var(--neon-pink);
      background: rgba(255, 0, 255, 0.08);
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .thought-time { font-size: 0.7rem; color: #666; margin-bottom: 5px; }
    .thought-type { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }

    .thought.decision .thought-type { color: var(--neon-green); }
    .thought.warning .thought-type { color: var(--neon-yellow); }
    .thought.action .thought-type { color: var(--neon-pink); }
    .thought .thought-type { color: var(--neon-cyan); }

    .thought-content {
      font-size: 0.9rem;
      line-height: 1.6;
    }

    .thought-content code {
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 3px;
      color: var(--neon-cyan);
    }

    .sidebar { display: flex; flex-direction: column; gap: 20px; }

    .panel {
      background: var(--darker-bg);
      border: 1px solid rgba(0, 255, 249, 0.3);
      border-radius: 4px;
      padding: 20px;
    }

    .panel-title {
      font-family: 'Orbitron', sans-serif;
      font-size: 0.8rem;
      color: var(--neon-cyan);
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(0, 255, 249, 0.2);
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 0.85rem;
    }

    .stat-label { color: #888; }
    .stat-value { color: var(--neon-cyan); font-weight: bold; }
    .stat-value.positive { color: var(--neon-green); }
    .stat-value.negative { color: #ff4444; }

    .yield-ticker { display: flex; flex-direction: column; gap: 8px; }

    .ticker-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
      background: rgba(0, 255, 249, 0.05);
      border-radius: 4px;
      font-size: 0.8rem;
    }

    .ticker-protocol { display: flex; align-items: center; gap: 8px; }
    .ticker-apy { color: var(--neon-green); font-weight: bold; }

    .confidence-meter { margin-top: 10px; }

    .meter-bar {
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
      margin-top: 5px;
    }

    .meter-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--neon-cyan), var(--neon-green));
      border-radius: 4px;
      transition: width 0.5s ease;
    }

    .meter-label {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: #666;
      margin-top: 5px;
    }

    .confidence-factors {
      margin-top: 10px;
      font-size: 0.75rem;
      color: #888;
    }

    .confidence-factors li {
      margin-left: 15px;
      margin-bottom: 3px;
    }

    .action-btn {
      width: 100%;
      padding: 15px;
      margin-top: 15px;
      background: transparent;
      border: 2px solid var(--neon-pink);
      color: var(--neon-pink);
      font-family: 'Orbitron', sans-serif;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .action-btn:hover {
      background: var(--neon-pink);
      color: var(--dark-bg);
      box-shadow: 0 0 30px rgba(255, 0, 255, 0.5);
    }

    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .glitch { animation: glitch 2s infinite; }

    @keyframes glitch {
      0%, 90%, 100% { transform: translate(0); }
      92% { transform: translate(-2px, 1px); }
      94% { transform: translate(2px, -1px); }
      96% { transform: translate(-1px, -1px); }
      98% { transform: translate(1px, 1px); }
    }

    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: var(--darker-bg); }
    ::-webkit-scrollbar-thumb { background: var(--neon-cyan); border-radius: 3px; }

    @media (max-width: 900px) {
      .container { grid-template-columns: 1fr; padding: 10px; }
      .thought-stream { height: 50vh; }
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="scanlines"></div>

  <header class="header">
    <div class="logo glitch">SOLANA_YIELD://LIVE</div>
    <div class="status">
      <div class="status-dot connecting" id="statusDot"></div>
      <span class="status-text connecting" id="statusText">Connecting...</span>
    </div>
  </header>

  <main class="container">
    <section class="thought-stream" id="thoughtStream">
      <div class="stream-header">AGENT THOUGHT STREAM</div>
    </section>

    <aside class="sidebar">
      <div class="panel">
        <div class="panel-title">Agent Status</div>
        <div class="stat-row">
          <span class="stat-label">Mode</span>
          <span class="stat-value">AUTOPILOT</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Uptime</span>
          <span class="stat-value" id="uptime">00:00:00</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Thoughts</span>
          <span class="stat-value" id="thoughtCount">0</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Decisions</span>
          <span class="stat-value" id="decisions">0</span>
        </div>
        <div class="confidence-meter">
          <div class="stat-row">
            <span class="stat-label">Decision Confidence</span>
            <span class="stat-value" id="confidence">—</span>
          </div>
          <div class="meter-bar">
            <div class="meter-fill" id="confidenceFill" style="width: 0%"></div>
          </div>
          <ul class="confidence-factors" id="confidenceFactors"></ul>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">Live Yields</div>
        <div class="yield-ticker" id="yieldTicker">
          <div class="ticker-item" style="color: #666">Waiting for data...</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">Current Recommendation</div>
        <div id="recommendation">
          <div class="stat-row">
            <span class="stat-label">Action</span>
            <span class="stat-value" id="recAction">ANALYZING...</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Protocol</span>
            <span class="stat-value" id="recProtocol">—</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Expected APY</span>
            <span class="stat-value positive" id="recApy">—</span>
          </div>
        </div>
        <button class="action-btn" id="executeBtn" onclick="executeRecommendation()" disabled>
          Execute Strategy
        </button>
      </div>
    </aside>
  </main>

  <script>
    let thoughtCount = 0;
    let decisionCount = 0;
    let startTime = Date.now();
    let eventSource = null;
    let reconnectAttempts = 0;

    function setStatus(status) {
      const dot = document.getElementById('statusDot');
      const text = document.getElementById('statusText');
      
      dot.className = 'status-dot ' + status;
      text.className = 'status-text ' + status;
      
      const labels = {
        '': 'Neural Link Active',
        'connecting': 'Connecting...',
        'disconnected': 'Disconnected'
      };
      text.textContent = labels[status] || labels[''];
    }

    function addThought(type, content) {
      const stream = document.getElementById('thoughtStream');
      const time = new Date().toLocaleTimeString('en-US', { hour12: false });
      
      thoughtCount++;
      document.getElementById('thoughtCount').textContent = thoughtCount;
      
      if (type === 'decision') {
        decisionCount++;
        document.getElementById('decisions').textContent = decisionCount;
      }
      
      const div = document.createElement('div');
      div.className = 'thought ' + type;
      div.innerHTML = \`
        <div class="thought-time">\${time}</div>
        <div class="thought-type">\${type}</div>
        <div class="thought-content">\${content}</div>
      \`;
      
      stream.appendChild(div);
      stream.scrollTop = stream.scrollHeight;
    }

    function updateConfidence(value, factors) {
      document.getElementById('confidence').textContent = value + '/100';
      document.getElementById('confidenceFill').style.width = value + '%';
      
      if (factors && factors.length > 0) {
        const list = document.getElementById('confidenceFactors');
        list.innerHTML = factors.map(f => '<li>' + f + '</li>').join('');
      }
    }

    function updateYields(yields) {
      const ticker = document.getElementById('yieldTicker');
      ticker.innerHTML = yields.map(y => \`
        <div class="ticker-item">
          <div class="ticker-protocol">
            <span>\${y.protocol}</span>
            <span style="color: #666">\${y.asset}</span>
          </div>
          <span class="ticker-apy">\${y.apy.toFixed(1)}%</span>
        </div>
      \`).join('');
    }

    function updateRecommendation(rec) {
      document.getElementById('recAction').textContent = rec.action;
      document.getElementById('recProtocol').textContent = rec.protocol;
      document.getElementById('recApy').textContent = rec.apy.toFixed(1) + '%';
      document.getElementById('executeBtn').disabled = false;
    }

    function updateUptime() {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const hours = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const seconds = String(elapsed % 60).padStart(2, '0');
      document.getElementById('uptime').textContent = hours + ':' + minutes + ':' + seconds;
    }

    function connectStream() {
      if (eventSource) {
        eventSource.close();
      }
      
      setStatus('connecting');
      eventSource = new EventSource('/api/stream');
      
      eventSource.addEventListener('thought', function(e) {
        reconnectAttempts = 0;
        setStatus('');
        
        try {
          const data = JSON.parse(e.data);
          
          if (data.type === 'data') {
            // Handle structured data updates
            if (data.content === 'yields' && data.metadata?.yields) {
              updateYields(data.metadata.yields);
            } else if (data.content === 'confidence' && data.metadata) {
              updateConfidence(data.metadata.confidence, data.metadata.factors);
            } else if (data.content === 'recommendation' && data.metadata) {
              updateRecommendation(data.metadata);
            }
          } else {
            // Regular thought
            addThought(data.type, data.content);
          }
        } catch (err) {
          console.error('Parse error:', err);
        }
      });
      
      eventSource.onerror = function() {
        setStatus('disconnected');
        eventSource.close();
        
        // Exponential backoff reconnect
        reconnectAttempts++;
        const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts));
        console.log('Reconnecting in ' + delay + 'ms...');
        setTimeout(connectStream, delay);
      };
    }

    function executeRecommendation() {
      addThought('action', '⚡ EXECUTING STRATEGY: Initiating transaction sequence... Wallet signature required.');
      document.getElementById('recAction').textContent = 'EXECUTING...';
      document.getElementById('recAction').style.color = 'var(--neon-pink)';
      document.getElementById('executeBtn').disabled = true;
      
      // Simulate execution
      setTimeout(() => {
        addThought('action', '⏳ Awaiting wallet connection... (Demo mode - no real transaction)');
      }, 2000);
    }

    // Initialize
    setInterval(updateUptime, 1000);
    connectStream();
  </script>
</body>
</html>
`;

export default function handler(request: Request) {
  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate'
    },
  });
}
