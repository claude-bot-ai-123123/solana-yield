#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const DEMO_URL = 'https://solana-yield.vercel.app/demo.html';
const OUTPUT_DIR = path.join(__dirname, '..', 'demo-screenshots');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function captureDemo() {
  console.log('🚀 Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport to capture full desktop experience
    await page.setViewport({ width: 1920, height: 1080 });

    console.log(`📡 Loading ${DEMO_URL}...`);
    await page.goto(DEMO_URL, { waitForNetworkIdle: true, timeout: 60000 });

    // Wait for animations to settle
    console.log('⏳ Waiting for animations...');
    await page.waitForTimeout(5000);

    // Capture full page
    console.log('📸 Capturing full page...');
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '01-full-demo.png'),
      fullPage: true
    });

    // Capture hero section
    console.log('📸 Capturing hero section...');
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '02-hero.png'),
      clip: { x: 0, y: 0, width: 1920, height: 400 }
    });

    // Capture yields table
    console.log('📸 Capturing yields table...');
    const yieldsPanel = await page.$('.panel.full-width');
    if (yieldsPanel) {
      await yieldsPanel.screenshot({
        path: path.join(OUTPUT_DIR, '03-yields-table.png')
      });
    }

    // Capture AI decision process
    console.log('📸 Capturing AI decision process...');
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '04-decision-process.png'),
      clip: { x: 40, y: 600, width: 900, height: 700 }
    });

    // Capture risk analysis
    console.log('📸 Capturing risk analysis...');
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '05-risk-analysis.png'),
      clip: { x: 980, y: 600, width: 900, height: 700 }
    });

    // Capture strategy card
    console.log('📸 Capturing strategy recommendation...');
    await page.evaluate(() => window.scrollTo(0, 1400));
    await page.waitForTimeout(1000);
    const strategyPanel = await page.$('.strategy-card');
    if (strategyPanel) {
      await strategyPanel.screenshot({
        path: path.join(OUTPUT_DIR, '06-strategy-recommendation.png')
      });
    }

    // Capture protocol comparison
    console.log('📸 Capturing protocol comparison...');
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '07-protocol-comparison.png'),
      clip: { x: 40, y: 2000, width: 1840, height: 400 }
    });

    // Capture live metrics
    console.log('📸 Capturing live metrics...');
    await page.evaluate(() => window.scrollTo(0, 2500));
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '08-live-metrics.png'),
      clip: { x: 40, y: 2500, width: 1840, height: 300 }
    });

    console.log('✅ All screenshots captured!');
    console.log(`📁 Saved to: ${OUTPUT_DIR}`);
    
    // List captured files
    const files = fs.readdirSync(OUTPUT_DIR);
    console.log('\n📸 Captured screenshots:');
    files.forEach(file => {
      const stats = fs.statSync(path.join(OUTPUT_DIR, file));
      console.log(`  - ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Create animated GIF from screenshots using ffmpeg
async function createGIF() {
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);

  console.log('\n🎬 Creating animated GIF...');
  
  try {
    // Check if ffmpeg is available
    await execPromise('which ffmpeg');
    
    // Create GIF from screenshots (showing key features in sequence)
    const gifPath = path.join(OUTPUT_DIR, 'solana-yield-demo.gif');
    
    // Use selected screenshots for GIF
    const frames = [
      '03-yields-table.png',
      '04-decision-process.png',
      '05-risk-analysis.png',
      '06-strategy-recommendation.png'
    ];

    // Create a temporary file list
    const fileListPath = path.join(OUTPUT_DIR, 'frames.txt');
    const fileList = frames.map(f => `file '${f}'`).join('\n');
    fs.writeFileSync(fileListPath, fileList);

    // Create GIF with ffmpeg
    const command = `cd ${OUTPUT_DIR} && ffmpeg -y -f concat -safe 0 -i frames.txt -vf "fps=1,scale=1280:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 solana-yield-demo.gif`;
    
    await execPromise(command);
    
    // Clean up temp file
    fs.unlinkSync(fileListPath);
    
    const stats = fs.statSync(gifPath);
    console.log(`✅ GIF created: solana-yield-demo.gif (${(stats.size / 1024).toFixed(1)} KB)`);
    
  } catch (error) {
    console.log('⚠️  ffmpeg not available or failed. Skipping GIF creation.');
    console.log('   You can manually create GIFs from the PNG screenshots.');
  }
}

// Main execution
(async () => {
  try {
    await captureDemo();
    await createGIF();
    console.log('\n🎉 Demo capture complete!');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
