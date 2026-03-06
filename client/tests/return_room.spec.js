import { test, expect } from '@playwright/test';

test.describe('Return to Room Scenarios', () => {
  test('Should show return confirmation when revisiting active room URL', async ({ page }) => {
    const roomId = `return-test-${Date.now()}`;
    
    // 1. Join a room initially
    await page.goto('https://localhost:5173');
    await page.waitForLoadState('networkidle');
    // Click Self-Hosted to enter WebRTC mode
    await page.click('h2:has-text("Self-Hosted")', { force: true });
    
    // Wait for network idle after click
    await page.waitForLoadState('networkidle');
    
    // Fill room ID and join - increase timeout and try catch to debug
    try {
      await page.waitForSelector('input[placeholder="Enter Room ID..."]', { timeout: 30000 });
    } catch(e) {
      console.log('Timeout waiting for input. Dumping page content:');
      // console.log(await page.content());
      throw e;
    }
    await page.fill('input[placeholder="Enter Room ID..."]', roomId);
    await page.click('button:has-text("Continue")');
    
    // In setup, click Join
    await page.waitForSelector('button:has-text("Join Now")');
    await page.click('button:has-text("Join Now")');
    
    // Wait for meeting to load (check for Leave button)
    await page.waitForSelector('button[title="Leave Meeting"]', { timeout: 10000 });
    
    // 2. Simulate leaving by going back to home (but URL has roomId param due to our fix)
    // Actually, let's reload the page with the query param to simulate "revisiting"
    // The previous fix ensures URL is updated.
    
    const currentUrl = page.url();
    expect(currentUrl).toContain(`roomId=${roomId}`);
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // 3. Verify Confirmation Dialog
    // It should NOT auto-join setup, but show the dialog on the Welcome screen
    // Wait for "Return to Meeting?" text
    await expect(page.locator('text=Return to Meeting?')).toBeVisible();
    await expect(page.locator(`text=${roomId}`)).toBeVisible();
    
    // 4. Click "Return to Room"
    await page.click('button:has-text("Return to Room")');
    
    // Should now be in Setup screen
    await expect(page.locator('text=Setup Audio & Video')).toBeVisible();
    
    // 5. Join again
    await page.click('button:has-text("Join Now")');
    await expect(page.locator('button[title="Leave Meeting"]')).toBeVisible();
  });

  test('Should clear URL when cancelling return', async ({ page }) => {
    const roomId = `cancel-test-${Date.now()}`;
    const url = `https://localhost:5173/?roomId=${roomId}`;
    
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    
    // Click Self-Hosted to enter WebRTC mode (since URL param is processed inside WebRTCMeeting)
    // Wait, the architecture is: App -> WebRTCMeeting. 
    // App handles routing mode. URL param doesn't automatically switch mode to 'webrtc' in App.jsx.
    // So we need to click "Self-Hosted" first.
    
    await page.click('h2:has-text("Self-Hosted")', { force: true });
    
    // Now WebRTCMeeting mounts and sees the URL param
    await expect(page.locator('text=Return to Meeting?')).toBeVisible();
    
    // Click Cancel
    await page.click('button:has-text("Cancel & Leave")');
    
    // Dialog should disappear
    await expect(page.locator('text=Return to Meeting?')).not.toBeVisible();
    
    // URL should be cleaned
    const newUrl = page.url();
    expect(newUrl).not.toContain('roomId=');
  });
});
