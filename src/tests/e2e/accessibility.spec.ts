import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function scan(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
}

test('has no serious accessibility violations on every route', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.stage-title')).toHaveText('정육면체');
  expect(await scan(page)).toEqual([]);

  await page.getByRole('link', { name: '도전' }).click();
  await expect(page.locator('.challenge-prompt')).toBeVisible();
  expect(await scan(page)).toEqual([]);

  await page.getByRole('link', { name: '교사' }).click();
  await expect(page.locator('.teacher-summary')).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test('supports a keyboard-only challenge path', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '도전' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#challenge/);

  const answer = page.getByRole('radio', { name: /접을 수 있어요/ });
  await answer.focus();
  await page.keyboard.press('Enter');
  await expect(answer).toHaveAttribute('aria-checked', 'true');

  const submit = page.getByRole('button', { name: '답 제출하기' });
  await submit.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.challenge-explanation')).toBeVisible();
  await expect(page.locator('.challenge-feedback')).toContainText('정답이에요');
});

test('provides a skip link and keyboard stage controls', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.locator('.skip-link');
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page).toHaveURL(/#explore/);

  await page.locator('.stage-region').focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  await expect(page.locator('#fold-output')).not.toHaveText('100%');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('+');
  await expect(page.locator('.stage-region')).toBeFocused();
});
