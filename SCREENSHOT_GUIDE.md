# Screenshot & GIF Demo Guide

## 🎬 Demo Pages Created

### 1. **Main Landing Page** (`/`)
- **Best for:** Hero shots, protocol showcase, overall project vision
- **Key elements:** Cyberpunk design, live yields grid, API demo
- **Recommended size:** 1920x1080 (Full HD) or 2560x1440 (2K)

### 2. **Live Feed** (`/live.html`)
- **Best for:** Real-time updates, streaming data visualization
- **Key elements:** Live yield updates, WebSocket-powered feed
- **Recommended size:** 1920x1080

### 3. **AI Demo** (`/demo.html`) ⭐ NEW!
- **Best for:** Showcasing AI decision-making process
- **Key elements:**
  - Animated AI thinking process (5-step decision flow)
  - Risk factor analysis with animated progress bars
  - Protocol comparison charts
  - Live portfolio metrics
  - Recommended strategy allocation
- **Recommended size:** 1920x1080 or 1920x1200

---

## 📸 Screenshot Best Practices

### Capture Timing
**For `/demo.html`:**
- Wait 3-4 seconds after page load for all animations to complete
- Decision steps fade in sequentially over 3 seconds
- Progress bars animate over 1.5 seconds
- Chart bars grow over 1.5 seconds

### Recommended Tools

**For Screenshots:**
- **Mac:** Cmd+Shift+4 (select region) or Cmd+Shift+3 (full screen)
- **Windows:** Windows+Shift+S or Snipping Tool
- **Linux:** Spectacle, Flameshot, or gnome-screenshot
- **Browser Extension:** Awesome Screenshot, Nimbus Screenshot

**For GIFs/Video:**
- **Loom** (loom.com) - Great for quick recordings with narration
- **ScreenToGif** (Windows) - Free, powerful GIF recorder
- **LICEcap** (Mac/Windows) - Lightweight GIF recorder
- **Kap** (Mac) - Beautiful, open-source recorder
- **OBS Studio** (All platforms) - Professional recording

---

## 🎨 What to Capture

### Priority 1: AI Decision Process (demo.html)
**Best single screenshot:**
- Full page showing:
  - "AI AUTOPILOT // LIVE ANALYSIS" header
  - Thinking indicator animation
  - Top yields table
  - 5-step decision flow (left panel)
  - Risk factor analysis (right panel)
  - Recommended strategy allocation at bottom

**URL:** `https://solana-yield.vercel.app/demo.html`

**Timing:** Wait 3 seconds after page load

**What makes it great:**
- Shows AI "thinking" in real-time
- Demonstrates transparent decision-making
- Risk analysis visualization
- Clear portfolio recommendations
- Professional, futuristic design

### Priority 2: Protocol Comparison
**Crop to:** Just the "Protocol APY Comparison" section from demo.html
- Shows animated bar chart comparing 6 protocols
- Visual hierarchy of yields
- Clean, easy to understand

### Priority 3: Landing Page Hero
**URL:** `https://solana-yield.vercel.app/`
**Best crop:** Header + hero section + stats row
- Shows cyberpunk aesthetic
- Live yield stats
- "Watch Live Feed" CTA

### Priority 4: Live Yields Table
**Crop from:** demo.html or index.html
- Top 6 yields with APY, TVL, risk badges
- Shows real-time data fetching

---

## 🎥 GIF Creation Guide

### Option 1: Quick 3-5 Second GIF
**Purpose:** Twitter/X, forum posts, quick demos

**What to capture:**
1. Load demo.html
2. Record from page load through decision step animations (0-3 seconds)
3. Capture progress bars filling and chart bars growing

**Settings:**
- Duration: 3-5 seconds
- FPS: 15-20 (smaller file size)
- Resolution: 1920x1080 or 1280x720
- Loop: Yes

### Option 2: Full Demo Walkthrough (15-30 seconds)
**Purpose:** Forum deep-dive post, demo video

**Script:**
1. Show landing page (2 sec)
2. Scroll to live yields (2 sec)
3. Click "Watch Live Feed" button (1 sec)
4. Navigate to `/demo.html` (1 sec)
5. Let AI decision animation play (3 sec)
6. Scroll down to show strategy allocation (2 sec)
7. Show protocol comparison chart (2 sec)
8. Scroll to live metrics (2 sec)

**Settings:**
- Duration: 15-20 seconds
- FPS: 30 (smoother)
- Resolution: 1920x1080
- Add captions/annotations if possible

---

## 📊 Specific Shots for Forum Posts

### For "Day 3 Progress" Post:
1. **Hero shot:** demo.html full page (showing AI in action)
2. **Detail shot:** 5-step decision process zoomed in
3. **Metrics shot:** Live portfolio metrics panel
4. **Comparison:** Side-by-side of yields before optimization vs. after

### For "Feature Showcase" Post:
1. **Risk Analysis:** Risk factor progress bars
2. **Strategy Card:** The green "Optimal 3-Protocol Allocation" card
3. **Chart:** Protocol APY comparison bars
4. **Live Feed:** Stream of updates from live.html

---

## 🔧 Quick Screenshot Commands

### Full Page Screenshots (via CLI)
```bash
# Using Playwright (if installed)
npx playwright screenshot https://solana-yield.vercel.app/demo.html demo-screenshot.png --full-page

# Using Puppeteer (if installed)
node -e "const puppeteer = require('puppeteer'); (async () => { const browser = await puppeteer.launch(); const page = await browser.newPage(); await page.setViewport({width: 1920, height: 1080}); await page.goto('https://solana-yield.vercel.app/demo.html'); await page.waitForTimeout(3000); await page.screenshot({path: 'demo.png'}); await browser.close(); })();"
```

### Convert Video to GIF
```bash
# Using ffmpeg
ffmpeg -i recording.mp4 -vf "fps=20,scale=1280:-1:flags=lanczos" -c:v gif output.gif

# Optimize GIF size
gifsicle -O3 --colors 256 output.gif -o optimized.gif
```

---

## 🌟 Tips for Great Screenshots

1. **Wait for animations** - All bars/steps should be fully loaded
2. **Clean browser chrome** - Hide bookmarks bar, use full screen (F11)
3. **High resolution** - 1920x1080 minimum for clarity
4. **Crop strategically** - Remove empty space, focus on content
5. **Consistent lighting** - Use dark mode consistently across all shots
6. **Add annotations** - Circle key features in red/yellow after capture
7. **Compress wisely** - Use TinyPNG for PNGs, Gifsicle for GIFs

---

## 📱 Social Media Specs

| Platform | Image Size | GIF Size | Notes |
|----------|-----------|----------|-------|
| **Twitter/X** | 1200x675 | <15MB | GIFs auto-loop |
| **Discord** | 1920x1080 | <10MB | PNG preferred |
| **Colosseum Forum** | 1920x1080 | <20MB | Full-res supported |
| **GitHub README** | 1280x720 | <10MB | Smaller for mobile |

---

## ✨ Next Steps

1. Visit https://solana-yield.vercel.app/demo.html
2. Open browser dev tools (F12)
3. Set device to "Responsive" and size to 1920x1080
4. Capture screenshots following the guide above
5. Optionally record a 5-10 second GIF of the animation sequence
6. Use screenshots in forum posts, tweets, README updates

**Demo page highlights:**
- ✅ Animated AI decision-making process
- ✅ Risk factor visualization
- ✅ Protocol comparison charts
- ✅ Live metrics dashboard
- ✅ Strategy recommendations
- ✅ Cyberpunk aesthetic matching brand
