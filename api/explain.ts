export const config = {
  runtime: 'edge',
};

/**
 * Interactive Reasoning Explanation Page
 * 
 * Visual walkthrough of the agent's decision-making process.
 * Shows step-by-step logic with expandable details.
 */

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SolanaYield // Decision Explained</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #0a0a0f;
      --bg-card: #12121a;
      --bg-hover: #1a1a25;
      --border: rgba(255, 255, 255, 0.1);
      --text-primary: #ffffff;
      --text-secondary: #888;
      --text-muted: #555;
      --cyan: #00fff9;
      --green: #39ff14;
      --yellow: #ffd93d;
      --red: #ff4757;
      --purple: #a855f7;
      --pink: #ff00ff;
      --gradient-cyan: linear-gradient(135deg, #00fff9, #00d4ff);
      --gradient-green: linear-gradient(135deg, #39ff14, #00ff88);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: var(--bg-dark);
      color: var(--text-primary);
      font-family: 'Inter', sans-serif;
      line-height: 1.6;
      min-height: 100vh;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    header {
      text-align: center;
      margin-bottom: 60px;
    }

    .logo {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
      color: var(--cyan);
      letter-spacing: 3px;
      margin-bottom: 20px;
      text-transform: uppercase;
    }

    h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 15px;
      background: linear-gradient(90deg, var(--cyan), var(--green));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      color: var(--text-secondary);
      font-size: 1.1rem;
      max-width: 600px;
      margin: 0 auto;
    }

    /* Summary Card */
    .summary-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 40px;
      position: relative;
      overflow: hidden;
    }

    .summary-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--gradient-cyan);
    }

    .decision-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
      font-size: 0.9rem;
      margin-bottom: 20px;
    }

    .decision-badge.rebalance {
      background: rgba(57, 255, 20, 0.15);
      color: var(--green);
      border: 1px solid var(--green);
    }

    .decision-badge.hold {
      background: rgba(255, 217, 61, 0.15);
      color: var(--yellow);
      border: 1px solid var(--yellow);
    }

    .summary-text {
      font-size: 1.25rem;
      font-weight: 500;
      margin-bottom: 20px;
    }

    .eli5-box {
      background: rgba(168, 85, 247, 0.1);
      border: 1px solid rgba(168, 85, 247, 0.3);
      border-radius: 12px;
      padding: 20px;
      margin-top: 20px;
    }

    .eli5-label {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--purple);
      font-weight: 600;
      font-size: 0.85rem;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .eli5-text {
      color: var(--text-secondary);
      font-size: 1rem;
      line-height: 1.7;
    }

    /* Confidence Meter */
    .confidence-section {
      margin-top: 25px;
      padding-top: 25px;
      border-top: 1px solid var(--border);
    }

    .confidence-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .confidence-label {
      font-weight: 500;
      color: var(--text-secondary);
    }

    .confidence-value {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 1.5rem;
      color: var(--cyan);
    }

    .confidence-bar {
      height: 12px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      overflow: hidden;
    }

    .confidence-fill {
      height: 100%;
      background: var(--gradient-green);
      border-radius: 6px;
      transition: width 1s ease;
    }

    /* Reasoning Steps */
    .steps-section {
      margin-bottom: 40px;
    }

    .section-title {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 25px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .phase-timeline {
      position: relative;
      padding-left: 30px;
    }

    .phase-timeline::before {
      content: '';
      position: absolute;
      left: 6px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: linear-gradient(180deg, var(--cyan), var(--green), var(--yellow), var(--purple));
    }

    .step {
      position: relative;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      transition: all 0.3s ease;
    }

    .step:hover {
      background: var(--bg-hover);
      border-color: rgba(0, 255, 249, 0.3);
      transform: translateX(5px);
    }

    .step::before {
      content: '';
      position: absolute;
      left: -30px;
      top: 24px;
      width: 14px;
      height: 14px;
      background: var(--bg-dark);
      border: 3px solid var(--cyan);
      border-radius: 50%;
    }

    .step.observe::before { border-color: var(--cyan); }
    .step.analyze::before { border-color: var(--purple); }
    .step.evaluate::before { border-color: var(--yellow); }
    .step.decide::before { border-color: var(--green); }
    .step.verify::before { border-color: var(--pink); }

    .step-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      cursor: pointer;
    }

    .step-emoji {
      font-size: 1.5rem;
    }

    .step-title {
      font-weight: 600;
      font-size: 1.1rem;
      flex: 1;
    }

    .step-phase {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: 600;
    }

    .step.observe .step-phase { background: rgba(0, 255, 249, 0.15); color: var(--cyan); }
    .step.analyze .step-phase { background: rgba(168, 85, 247, 0.15); color: var(--purple); }
    .step.evaluate .step-phase { background: rgba(255, 217, 61, 0.15); color: var(--yellow); }
    .step.decide .step-phase { background: rgba(57, 255, 20, 0.15); color: var(--green); }
    .step.verify .step-phase { background: rgba(255, 0, 255, 0.15); color: var(--pink); }

    .step-explanation {
      color: var(--text-secondary);
      margin-bottom: 15px;
      line-height: 1.7;
    }

    .step-evidence {
      display: none;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      padding: 15px;
      margin-top: 15px;
    }

    .step.expanded .step-evidence {
      display: block;
      animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .evidence-item {
      display: flex;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 0.9rem;
    }

    .evidence-item:last-child { border-bottom: none; }

    .evidence-type {
      width: 80px;
      color: var(--text-muted);
      font-size: 0.75rem;
      text-transform: uppercase;
    }

    .evidence-label {
      flex: 1;
      color: var(--text-secondary);
    }

    .evidence-value {
      font-family: 'JetBrains Mono', monospace;
      color: var(--cyan);
    }

    .expand-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      color: var(--text-muted);
      font-size: 0.85rem;
      cursor: pointer;
      margin-top: 10px;
      transition: color 0.2s;
    }

    .expand-btn:hover { color: var(--cyan); }

    /* Alternatives Section */
    .alternatives-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .alt-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      transition: all 0.3s ease;
    }

    .alt-card:hover {
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-3px);
    }

    .alt-card.not-chosen { opacity: 0.7; }
    .alt-card.chosen { 
      border-color: var(--green);
      background: rgba(57, 255, 20, 0.05);
    }

    .alt-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 15px;
    }

    .alt-name {
      font-weight: 600;
      font-size: 1rem;
    }

    .alt-apy {
      font-family: 'JetBrains Mono', monospace;
      color: var(--green);
      font-weight: 700;
    }

    .alt-reason {
      color: var(--text-secondary);
      font-size: 0.9rem;
      margin-bottom: 15px;
    }

    .alt-why-not {
      font-size: 0.85rem;
      color: var(--text-muted);
      padding-top: 15px;
      border-top: 1px solid var(--border);
    }

    .alt-why-not strong {
      color: var(--yellow);
    }

    /* Counterfactual Section */
    .counterfactual-section {
      margin-bottom: 40px;
    }

    .cf-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }

    .cf-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 25px;
    }

    .cf-title {
      font-weight: 600;
      font-size: 1rem;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .cf-stats {
      display: flex;
      gap: 20px;
      margin-bottom: 15px;
    }

    .cf-stat {
      text-align: center;
    }

    .cf-stat-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.25rem;
      font-weight: 700;
    }

    .cf-stat-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .cf-explanation {
      color: var(--text-secondary);
      font-size: 0.9rem;
      line-height: 1.6;
    }

    /* Decision Factors */
    .factors-section {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 40px;
    }

    .factor-row {
      display: flex;
      align-items: center;
      padding: 15px 0;
      border-bottom: 1px solid var(--border);
    }

    .factor-row:last-child { border-bottom: none; }

    .factor-name {
      width: 150px;
      font-weight: 500;
    }

    .factor-bar-container {
      flex: 1;
      margin: 0 20px;
    }

    .factor-bar {
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
    }

    .factor-bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 1s ease;
    }

    .factor-bar-fill.positive { background: var(--green); }
    .factor-bar-fill.negative { background: var(--red); }
    .factor-bar-fill.neutral { background: var(--text-muted); }

    .factor-impact {
      width: 80px;
      text-align: right;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
    }

    .factor-impact.positive { color: var(--green); }
    .factor-impact.negative { color: var(--red); }
    .factor-impact.neutral { color: var(--text-muted); }

    .factor-explanation {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 5px;
    }

    /* Loading State */
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
    }

    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 3px solid var(--border);
      border-top-color: var(--cyan);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-text {
      color: var(--text-secondary);
      font-size: 1rem;
    }

    /* Footer */
    footer {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    footer a {
      color: var(--cyan);
      text-decoration: none;
    }

    /* Mobile */
    @media (max-width: 768px) {
      .container { padding: 20px 15px; }
      h1 { font-size: 1.75rem; }
      .summary-card { padding: 20px; }
      .phase-timeline { padding-left: 25px; }
      .step { padding: 15px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">SolanaYield</div>
      <h1>Decision Transparency Engine</h1>
      <p class="subtitle">Complete visibility into every decision. No black boxes. No hidden logic.</p>
    </header>

    <div id="content">
      <div class="loading">
        <div class="loading-spinner"></div>
        <div class="loading-text">Analyzing yields and generating reasoning...</div>
      </div>
    </div>

    <footer>
      Built for the <a href="https://colosseum.org" target="_blank">Colosseum Agent Hackathon</a> • 
      <a href="/api/reasoning" target="_blank">View Raw API</a>
    </footer>
  </div>

  <script>
    async function loadReasoning() {
      try {
        const response = await fetch('/api/reasoning');
        const data = await response.json();
        renderReasoning(data);
      } catch (err) {
        document.getElementById('content').innerHTML = \`
          <div class="summary-card">
            <p style="color: var(--red)">Failed to load reasoning: \${err.message}</p>
          </div>
        \`;
      }
    }

    function renderReasoning(data) {
      const content = document.getElementById('content');
      
      content.innerHTML = \`
        <!-- Summary Card -->
        <div class="summary-card">
          <div class="decision-badge \${data.summary.decision.toLowerCase()}">
            \${data.summary.decision === 'REBALANCE' ? '✅' : '🛑'} 
            \${data.summary.decision}
          </div>
          <div class="summary-text">\${data.summary.oneLineSummary}</div>
          
          <div class="eli5-box">
            <div class="eli5-label">🧒 Explain Like I'm 5</div>
            <div class="eli5-text">\${data.summary.eli5}</div>
          </div>
          
          <div class="confidence-section">
            <div class="confidence-header">
              <span class="confidence-label">Decision Confidence</span>
              <span class="confidence-value">\${data.summary.confidence}%</span>
            </div>
            <div class="confidence-bar">
              <div class="confidence-fill" style="width: \${data.summary.confidence}%"></div>
            </div>
          </div>
        </div>

        <!-- Reasoning Steps -->
        <div class="steps-section">
          <div class="section-title">📋 Reasoning Chain</div>
          <div class="phase-timeline">
            \${data.steps.map((step, i) => renderStep(step, i)).join('')}
          </div>
        </div>

        <!-- Decision Factors -->
        <div class="factors-section">
          <div class="section-title">⚖️ Decision Factors</div>
          \${data.decisionFactors.map(f => renderFactor(f)).join('')}
        </div>

        <!-- Alternatives -->
        <div class="section-title">🔀 Alternatives Considered</div>
        <div class="alternatives-grid">
          \${data.alternatives.map(alt => renderAlternative(alt)).join('')}
        </div>

        <!-- Counterfactuals -->
        <div class="counterfactual-section">
          <div class="section-title">🔮 What-If Scenarios</div>
          <div class="cf-cards">
            \${renderCounterfactual('🎢 High Risk', data.counterfactual.ifHighRisk)}
            \${renderCounterfactual('🛡️ Low Risk', data.counterfactual.ifLowRisk)}
            \${renderCounterfactual('💤 No Action', data.counterfactual.ifNoAction)}
          </div>
        </div>
      \`;

      // Add click handlers for expandable steps
      document.querySelectorAll('.step').forEach(step => {
        step.querySelector('.step-header').addEventListener('click', () => {
          step.classList.toggle('expanded');
        });
      });
    }

    function renderStep(step, index) {
      return \`
        <div class="step \${step.phase}">
          <div class="step-header">
            <span class="step-emoji">\${step.emoji}</span>
            <span class="step-title">\${step.title}</span>
            <span class="step-phase">\${step.phase}</span>
          </div>
          <div class="step-explanation">\${step.explanation}</div>
          <div class="expand-btn">▼ Show evidence</div>
          <div class="step-evidence">
            \${step.evidence.map(e => \`
              <div class="evidence-item">
                <span class="evidence-type">\${e.type}</span>
                <span class="evidence-label">\${e.label}</span>
                <span class="evidence-value">\${e.value}</span>
              </div>
            \`).join('')}
          </div>
          \${step.children ? step.children.map(c => renderSubStep(c)).join('') : ''}
        </div>
      \`;
    }

    function renderSubStep(step) {
      return \`
        <div style="margin-left: 20px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px; margin-top: 10px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span>\${step.emoji}</span>
            <strong>\${step.title}</strong>
          </div>
          <div style="color: var(--text-secondary); font-size: 0.9rem;">\${step.explanation}</div>
        </div>
      \`;
    }

    function renderFactor(factor) {
      const barWidth = Math.abs(factor.contribution) * 2;
      return \`
        <div class="factor-row">
          <div class="factor-name">\${factor.factor}</div>
          <div class="factor-bar-container">
            <div class="factor-bar">
              <div class="factor-bar-fill \${factor.impact}" style="width: \${barWidth}%"></div>
            </div>
            <div class="factor-explanation">\${factor.explanation}</div>
          </div>
          <div class="factor-impact \${factor.impact}">
            \${factor.contribution > 0 ? '+' : ''}\${factor.contribution}
          </div>
        </div>
      \`;
    }

    function renderAlternative(alt) {
      const isChosen = alt.whyNotChosen.includes('recommended action');
      return \`
        <div class="alt-card \${isChosen ? 'chosen' : 'not-chosen'}">
          <div class="alt-header">
            <span class="alt-name">\${alt.choice}</span>
            <span class="alt-apy">\${alt.outcome.expectedApy.toFixed(1)}%</span>
          </div>
          <div class="alt-reason">\${alt.reasoning}</div>
          <div class="alt-why-not">
            <strong>Why not chosen:</strong> \${alt.whyNotChosen}
          </div>
        </div>
      \`;
    }

    function renderCounterfactual(title, cf) {
      return \`
        <div class="cf-card">
          <div class="cf-title">\${title}</div>
          <div class="cf-stats">
            <div class="cf-stat">
              <div class="cf-stat-value" style="color: var(--green)">\${cf.expectedApy.toFixed(1)}%</div>
              <div class="cf-stat-label">Expected APY</div>
            </div>
            <div class="cf-stat">
              <div class="cf-stat-value" style="color: var(--yellow)">\${cf.riskScore}</div>
              <div class="cf-stat-label">Risk Score</div>
            </div>
          </div>
          <div class="cf-explanation">\${cf.reasoning}</div>
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border); font-size: 0.9rem; color: var(--cyan);">
            \${cf.recommendation}
          </div>
        </div>
      \`;
    }

    loadReasoning();
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
