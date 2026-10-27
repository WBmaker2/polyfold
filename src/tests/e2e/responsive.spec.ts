import { expect, test } from '@playwright/test';

test('phone layout uses tabs and avoids horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone only');
  await page.goto('/');
  await expect(page.locator('.stage-title')).toHaveText('정육면체');
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(4);
  await expect(page.getByRole('tab', { name: '접기' })).toBeVisible();
  await page.getByRole('tab', { name: '단면' }).click();
  await expect(page.locator('.card[data-card="slice"]')).toBeVisible();
  await expect(page.locator('.card[data-card="fold"]')).toBeHidden();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('tablet stacks the tool panel below the stage', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'tablet', 'tablet only');
  await page.goto('/');
  const stage = await page.locator('.stage').boundingBox();
  const right = await page.locator('.panel-right').boundingBox();
  expect(stage).not.toBeNull();
  expect(right).not.toBeNull();
  expect(right!.y).toBeGreaterThan(stage!.y + stage!.height - 2);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('desktop keeps the gallery and tools beside the stage', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop only');
  await page.goto('/');
  const stage = await page.locator('.stage').boundingBox();
  const left = await page.locator('.panel-left').boundingBox();
  const right = await page.locator('.panel-right').boundingBox();
  expect(stage).not.toBeNull();
  expect(left).not.toBeNull();
  expect(right).not.toBeNull();
  expect(left!.x + left!.width).toBeLessThanOrEqual(stage!.x + 1);
  expect(right!.x).toBeGreaterThanOrEqual(stage!.x + stage!.width - 1);
});
