import { test, expect } from '@playwright/test';

test.use({
  permissions: ['camera', 'microphone'],
});

async function joinRoom(page, roomId, _name = 'tester') {
  await page.goto('/');
  await page.getByText(/Self-Hosted|自托管|无限时/i).click();
  await page.getByPlaceholder(/room-123|例如 room-123|e\.g\./i).fill(roomId);
  await page.getByRole('button', { name: /Continue|继续/ }).click();
  // 在 setup 页不点击，直接在 meeting 重建逻辑应接管；如果未接管则点击 Join
  const joinNow = page.getByRole('button', { name: /Join Now|立即加入/i });
  if (await joinNow.isVisible().catch(() => false)) {
    await joinNow.click();
  }
  await expect(page.locator('[data-tile-id="local"]')).toBeVisible();
}

test('refresh keeps user in the same room', async ({ page, context: _context }) => {
  const roomId = `room-${Date.now()}`;
  await joinRoom(page, roomId);

  // 刷新
  await page.reload();

  // 如果出现 Return 弹窗，点击返回
  const returnBtn = page.getByRole('button', { name: /Return to Room|返回到房间|Return/ });
  if (await returnBtn.isVisible().catch(() => false)) {
    await returnBtn.click();
  }
  // 如果 setup 出现 Join Now，再点击一次
  const joinNow = page.getByRole('button', { name: /Join Now|立即加入/i });
  if (await joinNow.isVisible().catch(() => false)) {
    await joinNow.click();
  }
  await expect(page.locator('[data-tile-id="local"]')).toBeVisible();
});

test('offline then back online keeps meeting UI', async ({ page, context }) => {
  const roomId = `room-${Date.now()}`;
  await joinRoom(page, roomId);
  // 断网
  await context.setOffline(true);
  // 等待提示但不跳转
  await page.waitForTimeout(1000);
  // 恢复网络
  await context.setOffline(false);
  // 保持在会议页
  await expect(page.locator('[data-tile-id="local"]')).toBeVisible();
});

test('token param does not eject meeting', async ({ page }) => {
  const roomId = `room-${Date.now()}`;
  await page.goto(`/?roomId=${roomId}&token=invalid`);
  await page.getByText(/Self-Hosted|自托管|无限时/i).click();
  // 如果出现 Join Now 就点掉
  const joinNow = page.getByRole('button', { name: /Join Now|立即加入/i });
  if (await joinNow.isVisible().catch(() => false)) {
    await joinNow.click();
  }
  await expect(page.locator('[data-tile-id="local"]')).toBeVisible();
});

test('leave then re-enter webrtc stays on meeting list', async ({ page }) => {
  const roomId = `room-${Date.now()}`;
  await joinRoom(page, roomId);

  await page.getByRole('button', { name: /离开|Leave/i }).click();
  await expect(page.getByText(/无限时会议|Unlimited Meeting/i)).toBeVisible();

  await page.getByText(/无限时会议|Unlimited Meeting/i).click();
  await expect(page.getByText(/加入会议|Join Meeting/i)).toBeVisible();
});
