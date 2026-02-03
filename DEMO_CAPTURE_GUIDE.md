# SolanaYield Demo GIF Creation Guide

## Quick Setup

The automated capture script failed due to Chrome dependencies. Here's how to manually capture stunning demo GIFs for forum posts:

## Method 1: Browser DevTools (Fastest)

### Step 1: Open Demo Page
1. Navigate to: https://solana-yield.vercel.app/demo.html
2. Wait 5 seconds for all animations to complete
3. Open DevTools (F12) and set device toolbar to Desktop (1920x1080)

### Step 2: Capture Screenshots

Use browser screenshots or tools like:
- **Chrome**: DevTools → ⋯ menu → Capture screenshot / Capture full size screenshot
- **Firefox**: Right-click → Take Screenshot → Save full page
- **Screenshot tools**: ShareX (Windows), Kap (Mac), Peek (Linux)

### Key Frames to Capture:

1. **Full Demo Overview** (0-5s)
   - Full page scroll from top to bottom
   - Shows entire AI decision interface

2. **Yields Table** (Section 1)
   - Top protocols with live APY data
   - Color-coded risk badges
   - TVL metrics

3. **AI Decision Process** (Section 2)  
   - Step-by-step reasoning chain
   - 5 decision steps with animations
   - Shows transparency in action

4. **Risk Analysis** (Section 3)
   - 5 risk factors with progress bars
   - Scores out of 100
   - Security, liquidity, audit status

5. **Strategy Recommendation** (Section 4)
   - 3-protocol allocation
   - Portfolio APY: 24.3%
   - Visual allocation breakdown

6. **Protocol Comparison** (Section 5)
   - Animated bar chart
   - APY comparison across 6 protocols
   - Visual hierarchy

7. **Live Metrics** (Section 6)
   - 4 real-time metrics
   - Sharpe ratio, risk score, TVL
   - Positive/negative indicators

## Method 2: Screen Recording → GIF Conversion

### Record Demo (10-15 seconds)
```bash
# Mac
QuickTime Screen Recording → Export as MOV

# Linux
peek --record demo.gif

# Windows  
OBS Studio or ShareX
```

### Convert Video → GIF
```bash
# Using ffmpeg (if available)
ffmpeg -i demo-recording.mov -vf "fps=10,scale=800:-1:flags=lanczos" \
  -c:v gif -loop 0 solana-yield-demo.gif

# Optimize GIF size
gifsicle -O3 --lossy=80 solana-yield-demo.gif -o solana-yield-optimized.gif
```

## Method 3: Online Tools (No Install Required)

1. **Record screen**: https://www.loom.com or https://www.veed.io/screen-recorder
2. **Download as MP4**
3. **Convert to GIF**: https://ezgif.com/video-to-gif
   - Set FPS: 10-15
   - Width: 800-1000px
   - Loop: Forever

## Recommended GIF Specs for Forum Posts

- **Duration**: 10-15 seconds
- **Dimensions**: 800x600 to 1280x720
- **FPS**: 10-15 (smooth but not huge file size)
- **File size**: < 5 MB (most forums limit to 10MB)
- **Loop**: Infinite
- **Format**: GIF or MP4 (many forums now support MP4)

## What to Highlight in Forum Post

### GIF 1: "AI Decision Process" (5-7 seconds)
Show the decision steps animating in sequence, highlighting:
- Data ingestion (127 opportunities)
- Risk assessment (9 protocols)  
- Yield filtering (42 low-risk)
- Portfolio construction (3 protocols)
- Final strategy (24.3% APY)

**Caption**: "SolanaYield's AI shows its work. Every decision explained, every step transparent."

### GIF 2: "Live Yield Analysis" (8-10 seconds)
Scroll through yields table → risk analysis → strategy card
- Top protocols with APY/TVL
- Risk scores breakdown
- Optimized allocation

**Caption**: "Real-time monitoring of 9 Solana DeFi protocols. Trust score system ensures safe yields."

### GIF 3: "Protocol Comparison" (5-7 seconds)
Show the animated bar chart comparing APYs across protocols

**Caption**: "Not all yields are equal. Compare risk-adjusted returns across Kamino, Drift, Jito, and more."

## Alternative: Static Images

If GIFs are too complex, use high-quality PNG screenshots:

1. Full demo screenshot (hero)
2. Decision process panel (transparency)
3. Strategy recommendation (key differentiator)

Upload to Imgur or GitHub for easy embedding.

## Forum Post Template

```markdown
### 🎯 SolanaYield: AI Autopilot for DeFi

Watch our AI make autonomous yield decisions in real-time:

[GIF 1: AI Decision Process]

**What makes us different?**
✅ Full transparency - see every decision step
✅ Trust scoring - Moody's-style protocol ratings
✅ Risk-adjusted yields - not just highest APY
✅ Live monitoring - 9 protocols, real-time data

[GIF 2: Live Analysis Dashboard]

**Key Stats:**
- 127 yield opportunities tracked
- 9 protocols integrated (Kamino, Drift, Jito, Raydium, Sanctum, Marinade, Orca, Lulo, Mango)
- 24.3% portfolio APY (risk-adjusted)

[GIF 3: Protocol Comparison]

**Demo**: https://solana-yield.vercel.app/demo.html
**Tech**: TypeScript, DeFiLlama API, Solana RPC
**Open Source**: Coming soon

Feedback welcome! 🚀
```

## Quick GIF Capture Commands

### Using Kap (Mac - Recommended)
```bash
brew install --cask kap
# Open Kap, select area, record demo, export as GIF
```

### Using Peek (Linux - Recommended)
```bash
# Ubuntu/Debian
sudo add-apt-repository ppa:peek-developers/stable
sudo apt update && sudo apt install peek

# Fedora
sudo dnf install peek

# Record demo, save as GIF
```

### Using Gifcam (Windows - Recommended)
Download from: http://blog.bahraniapps.com/gifcam/
- Lightweight, easy to use
- Adjust frame rate and size
- Record, stop, save

---

## Next Steps

1. **Capture 2-3 key GIFs** using method above
2. **Save to** `demo-screenshots/` folder
3. **Update forum post** with GIF links
4. **Post to Colosseum Arena** for visibility

**Target file sizes:**
- GIF 1 (Decision): ~2-3 MB
- GIF 2 (Analysis): ~3-4 MB  
- GIF 3 (Comparison): ~1-2 MB

Total forum post should be < 10 MB for fast loading.

