import { expect, test } from '@playwright/test';

async function openTool(page: import('@playwright/test').Page, tab: string): Promise<void> {
  const tabs = page.getByRole('tab', { name: tab });
  if (await tabs.isVisible()) await tabs.click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.stage-title')).toHaveText('정육면체');
});

test('switches solids and view modes', async ({ page }) => {
  await page
    .getByRole('button', { name: /정사각뿔/ })
    .first()
    .click();
  await expect(page.locator('.stage-title')).toHaveText('정사각뿔');
  await page.getByRole('button', { name: '평면 전개도' }).click();
  await expect(page.locator('.stage')).toHaveClass(/is-net-view/);
  await expect(page.locator('.net-canvas')).toBeVisible();
  await expect(page.locator('.stage-region')).toHaveAttribute('aria-label', /전개도/);
  await page.getByRole('button', { name: '3D 입체' }).click();
  await expect(page.locator('.scene-canvas')).toBeVisible();
});

test('folds with the slider and the play button', async ({ page }) => {
  await page.locator('#fold-slider').evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = '0';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#fold-output')).toHaveText('0%');
  await page.getByRole('button', { name: /다시 접기|접기 시작/ }).click();
  await page.waitForTimeout(450);
  await expect(page.locator('#fold-output')).not.toHaveText('100%');
  await expect(page.locator('#fold-output')).toHaveText('100%', { timeout: 5000 });
  await page.waitForTimeout(200);
  await expect(page.getByRole('button', { name: /다시 접기/ })).toBeVisible();
});

test('selects faces by clicking the 3D solid', async ({ page }) => {
  const box = await page.locator('.stage-region').boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page.locator('#face-text')).toContainText('선택한 면');
});

test('cuts a square and a hexagon with the section plane', async ({ page }) => {
  await openTool(page, '단면');
  await page.getByRole('checkbox', { name: '단면 보기' }).check();
  await expect(page.locator('#fold-output')).toHaveText('100%');
  await expect(page.locator('#section-meta')).toContainText('정사각형');
  await page.getByRole('button', { name: '대각선' }).click();
  await expect(page.locator('#section-meta')).toContainText('정육각형');
  await expect(page.locator('#section-canvas')).toBeVisible();
});

test('shows the reason for an invalid net', async ({ page }) => {
  await openTool(page, '접기');
  await page.locator('#net-select').selectOption('cube-invalid-missing');
  await expect(page.locator('#net-note')).toContainText('면이 하나 빠져 있어요');
  await expect(page.locator('#net-meta')).toContainText('접을 수 없는');
  await expect(page.locator('.stage')).toHaveClass(/is-net-view/);
});

test('changes fold speed and scrubs with the progress bar', async ({ page }) => {
  await openTool(page, '접기');
  const slow = page.getByRole('button', { name: '느리게' });
  await slow.click();
  await expect(slow).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#fold-slider').evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = '0';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.getByRole('button', { name: /다시 접기|접기 시작/ }).click();
  await page.waitForTimeout(900);
  const playingPercent = Number.parseInt(
    (await page.locator('#fold-output').textContent()) ?? '0',
    10,
  );
  expect(playingPercent).toBeLessThan(45);

  const slider = page.locator('#fold-slider');
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.25, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.6, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const scrubbed = Number.parseFloat(await slider.inputValue());
  expect(scrubbed).toBeGreaterThan(0.4);
  expect(scrubbed).toBeLessThan(0.8);
  await expect(page.getByRole('button', { name: '멈춤' })).toHaveCount(0);
});

test('respects the reduced-motion toggle', async ({ page }) => {
  await openTool(page, '접기');
  await page.getByRole('checkbox', { name: '애니메이션 줄이기' }).check();
  await page.getByRole('button', { name: /다시 접기|접기 시작/ }).click();
  await expect(page.locator('#fold-output')).toHaveText('0%');
});

test('toggles the formula panel', async ({ page }) => {
  await openTool(page, '측정');
  const toggle = page.getByRole('checkbox', { name: '공식과 풀이 함께 보기' });
  await expect(toggle).toBeChecked();
  await expect(page.locator('#formula-blocks')).toBeVisible();
  await toggle.uncheck();
  await expect(page.locator('#formula-blocks')).toBeHidden();
  await toggle.check();
  await expect(page.locator('#formula-blocks')).toBeVisible();
});
