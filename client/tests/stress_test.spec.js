import { test, expect } from '@playwright/test';

test.describe('WebRTC Stability & Mute/Data Saver Stress Test', () => {
  test.beforeEach(async ({ context }) => {
    // Grant permissions
    await context.grantPermissions(['camera', 'microphone']);
  });

  test('Should handle rapid mute/unmute without breaking video', async ({ browser }) => {
    const context1 = await browser.newContext();
    await context1.grantPermissions(['camera', 'microphone']);
    const page1 = await context1.newPage();
    
    const context2 = await browser.newContext();
    await context2.grantPermissions(['camera', 'microphone']);
    const page2 = await context2.newPage();

    // User 1 joins
    // Point to Vite dev server (5173) instead of API server (5002) for UI testing
    await page1.goto('https://localhost:5173');
    
    // Handle self-signed certificate warning if needed (Playwright usually handles ignoreHTTPSErrors in config)
    
    // Wait for network to be idle to ensure page loaded
    await page1.waitForLoadState('networkidle');
    
    // Check if we are on landing page, if not (due to SPA routing), wait for it
    await page1.waitForLoadState('networkidle');
    
    // We are on landing page with 3 big cards.
    // Click "Self-Hosted" card
    await page1.click('h2:has-text("Self-Hosted")', { force: true });
    
    // NOW wait for input with longer timeout
    await page1.waitForSelector('input[placeholder="Enter Room ID..."]', { state: 'visible', timeout: 15000 });
    await page1.fill('input[placeholder="Enter Room ID..."]', 'stress-room-1');
    await page1.click('button:has-text("Continue")');
    // Wait for Join Now button to be visible and stable
    await page1.waitForSelector('button:has-text("Join Now")', { state: 'visible' });
    await page1.click('button:has-text("Join Now")');

    // User 2 joins
    await page2.goto('https://localhost:5173');
    await page2.waitForLoadState('networkidle');
    await page2.click('h2:has-text("Self-Hosted")', { force: true });
    await page2.waitForSelector('input[placeholder="Enter Room ID..."]', { state: 'visible', timeout: 15000 });
    await page2.fill('input[placeholder="Enter Room ID..."]', 'stress-room-1');
    await page2.click('button:has-text("Continue")');
    // Wait for Join Now button to be visible and stable
    await page2.waitForSelector('button:has-text("Join Now")', { state: 'visible' });
    await page2.click('button:has-text("Join Now")');

    // Wait for connection
    await page1.waitForTimeout(2000);

    // Rapid mute/unmute 20 times
    for (let i = 0; i < 20; i++) {
        await page1.click('button[title*="ute"]'); // Matches Mute/Unmute
        await page1.waitForTimeout(100); // 100ms interval
    }

    // Verify video is still present on remote
    const videoElement = page2.locator('video').nth(0); // Check first video
    await expect(videoElement).toBeVisible();
    
    // Check if video is not paused/frozen (simple check)
    const isPaused = await videoElement.evaluate(v => v.paused);
    expect(isPaused).toBe(false);

    await context1.close();
    await context2.close();
  });

  test('Should switch to low data mode without black screen', async ({ browser }) => {
    const context1 = await browser.newContext();
    await context1.grantPermissions(['camera', 'microphone']);
    const page1 = await context1.newPage();
    
    // User 1 joins
    // Point to Vite dev server (5173) instead of API server (5002) for UI testing
    await page1.goto('https://localhost:5173');
    await page1.waitForLoadState('networkidle');
    await page1.click('h2:has-text("Self-Hosted")', { force: true });
    await page1.waitForSelector('input[placeholder="Enter Room ID..."]', { state: 'visible', timeout: 15000 });
    await page1.fill('input[placeholder="Enter Room ID..."]', 'stress-room-2');
    await page1.click('button:has-text("Continue")');
    // Wait for Join Now button to be visible and stable
    await page1.waitForSelector('button:has-text("Join Now")', { state: 'visible' });
    await page1.click('button:has-text("Join Now")');
    
    await page1.waitForTimeout(1000);

    // Toggle Low Data Mode
    await page1.click('button[title*="Data Saver"]');
    
    // Wait for switch
    await page1.waitForTimeout(2000);

    // Verify local video is still playing and has correct dimensions (approx)
    const localVideo = page1.locator('video').nth(0);
    const videoWidth = await localVideo.evaluate(v => v.videoWidth);
    const videoHeight = await localVideo.evaluate(v => v.videoHeight);
    
    console.log(`Video dimensions after switch: ${videoWidth}x${videoHeight}`);
    
    // Expect lower resolution
    expect(videoWidth).toBeLessThanOrEqual(640);
    expect(videoHeight).toBeLessThanOrEqual(480);
    expect(videoWidth).toBeGreaterThan(0); // Not black/empty

    await context1.close();
  });
});
