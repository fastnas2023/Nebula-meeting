import { test, expect } from '@playwright/test';

test.describe('Instant Meeting (Jitsi) Test', () => {
  test.setTimeout(120000);
  test('Should start Instant Meeting without warning banner', async ({ page }) => {
    // Go to home
    await page.goto('https://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Click "Instant Meeting" card
    // Use a more specific locator to avoid ambiguity
    await page.click('h2:has-text("Instant Meeting")', { force: true });

    // Wait for Jitsi Meeting component to load
    // It has "Start Instant Meeting" and "Join Existing Room"
    await page.waitForSelector('text=Start Instant Meeting', { state: 'visible', timeout: 15000 });

    // Click "Start Instant Meeting" button (the card)
    await page.click('text=Start Instant Meeting');

    // Wait for Jitsi iframe to load
    await page.waitForSelector('iframe', { state: 'visible', timeout: 30000 });

    // Check that NO warning banner is present
    // The banner text was "Public Jitsi service has a 5-minute limit"
    // We check for the text or the alert icon
    const warning = page.locator('text=Public Jitsi service has a 5-minute limit');
    await expect(warning).not.toBeVisible();
    
    // Also check for watermark?
    // Jitsi iframe content is cross-origin so we can't easily check inside iframe.
    // But user asked to keep it, so we just ensure we didn't break Jitsi loading.
    
    // Verify "Leave Meeting" button (icon only) is visible
    await expect(page.locator('button[title="Leave Meeting"]')).toBeVisible();
  });
});
