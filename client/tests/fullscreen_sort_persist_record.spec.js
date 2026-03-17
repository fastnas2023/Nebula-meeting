import { test, expect } from '@playwright/test';

test.use({ video: 'on' });

async function joinWebRTCMeeting(page, { roomId, name }) {
  await page.goto('/');
  await page.getByText(/Self-Hosted|无限时会议|自托管/i).click();

  await page.getByPlaceholder(/room-123/i).fill(roomId);
  await page.getByRole('button', { name: /Continue|继续/i }).click();

  const nameInput = page.getByPlaceholder(/name|昵称/i);
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill(name);
  }

  await page.getByRole('button', { name: /Join Now|立即加入/i }).click();
  await expect(page.locator('[data-tile-id="local"]')).toBeVisible();
}

test('record demo: fullscreen toggle x5, sort switch, refresh restore', async ({ browser }) => {
  const roomId = `room-demo-${Date.now()}`;

  const context = await browser.newContext({
    permissions: ['camera', 'microphone'],
  });

  const page1 = await context.newPage();
  const page2 = await context.newPage();
  const page3 = await context.newPage();

  await joinWebRTCMeeting(page1, { roomId, name: 'Alice' });
  await joinWebRTCMeeting(page2, { roomId, name: 'Bob' });
  await joinWebRTCMeeting(page3, { roomId, name: 'Charlie' });

  await expect(page1.locator('[data-tile-id]')).toHaveCount(3);

  const localTile = page1.locator('[data-tile-id="local"]');

  for (let i = 0; i < 5; i += 1) {
    await localTile.hover();
    await localTile.locator('button[title*="Full"], button[title*="全屏"]').click();
    await expect(page1.locator('[data-tile-id="local"][data-mode="fullscreen"]')).toBeVisible();

    await page1.locator('[data-tile-id="local"][data-mode="fullscreen"]').hover();
    await page1.locator('[data-tile-id="local"][data-mode="fullscreen"] button[title*="Restore"], [data-tile-id="local"][data-mode="fullscreen"] button[title*="恢复"]').click();
    await expect(page1.locator('[data-tile-id="local"][data-mode="fullscreen"]')).toHaveCount(0);
  }

  await page1.getByRole('button', { name: /Sort|排序/i }).click();
  await page1.getByRole('button', { name: /Name \(A → Z\)|按姓名升序/i }).click();
  await page1.getByRole('button', { name: /Sort|排序/i }).click();
  await page1.getByRole('button', { name: /Speaking first|正在发言优先/i }).click();
  await page1.getByRole('button', { name: /Sort|排序/i }).click();
  await page1.getByRole('button', { name: /Join time|按入会时间/i }).click();

  await localTile.hover();
  await localTile.locator('button[title*="Full"], button[title*="全屏"]').click();
  await expect(page1.locator('[data-tile-id="local"][data-mode="fullscreen"]')).toBeVisible();

  await page1.reload();
  const returnBtn = page1.getByRole('button', { name: /Return to Room|返回到房间|Return/i });
  if (await returnBtn.isVisible().catch(() => false)) {
    await returnBtn.click();
  }
  await page1.getByRole('button', { name: /Join Now|立即加入/i }).click();
  await expect(page1.locator('[data-tile-id="local"][data-mode="fullscreen"]')).toBeVisible();
});

