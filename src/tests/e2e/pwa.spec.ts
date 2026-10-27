import { expect, test } from '@playwright/test';

test('works offline after the first load', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'service worker check once');
  test.setTimeout(30_000);
  await page.goto('/');
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('service worker unavailable');
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.locator('.stage-title')).toHaveText('정육면체');
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.stage-title')).toHaveText('정육면체');
    await expect(page.locator('.stage-region')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
