import { expect, test } from '@playwright/test';

async function openChallenge(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('link', { name: '도전' }).click();
  await expect(page).toHaveURL(/#challenge/);
  await expect(page.locator('.challenge-prompt')).toBeVisible();
}

test('answers a challenge correctly, earns stars, and persists progress', async ({ page }) => {
  await page.goto('/');
  await openChallenge(page);
  await page.getByRole('radio', { name: /접을 수 있어요/ }).click();
  await page.getByRole('button', { name: '답 제출하기' }).click();
  await expect(page.locator('.challenge-feedback')).toContainText('정답이에요');
  await expect(page.locator('.challenge-explanation')).toContainText('여섯 개의 정사각형');
  await expect(page.locator('.challenge-stars').first()).toContainText('완료 1/8');
  await expect(page.locator('.challenge-stars').first()).toContainText('모은 별 3개');

  await page.reload();
  await expect(page.locator('.challenge-stars').first()).toContainText('완료 1/8');
  await expect(page.locator('.challenge-stars').first()).toContainText('모은 별 3개');
});

test('reveals the explanation after two wrong attempts', async ({ page }) => {
  await page.goto('/');
  await openChallenge(page);
  await page.getByRole('radio', { name: /접을 수 없어요/ }).click();
  await page.getByRole('button', { name: '답 제출하기' }).click();
  await expect(page.locator('.challenge-feedback')).toContainText('아직 정답이 아니에요');
  await page.getByRole('button', { name: '답 제출하기' }).click();
  await expect(page.locator('.challenge-feedback')).toContainText('두 번 도전했어요');
  await expect(page.locator('.challenge-explanation')).toBeVisible();
  await expect(page.locator('.challenge-stars').first()).toContainText('모은 별 0개');
});

test('hides the solid name until the identification answer is submitted', async ({ page }) => {
  await page.goto('/');
  await openChallenge(page);
  await page.locator('[data-challenge-id="pyramid-identify"]').click();
  await expect(page.locator('.stage-title')).toHaveText('어떤 입체일까요?');
  await expect(page.locator('.stage-subtitle')).toHaveText('전개도의 단서를 살펴보세요.');
  await expect(page.getByRole('button', { name: '3D 입체' })).toBeDisabled();
  await page.getByRole('radio', { name: /^B 정사각뿔/ }).click();
  await page.getByRole('button', { name: '답 제출하기' }).click();
  await expect(page.locator('.stage-title')).toHaveText('정사각뿔');
});

test('keeps the cross-section hidden until the answer is submitted', async ({ page }) => {
  await page.goto('/');
  await openChallenge(page);
  await page.locator('[data-challenge-id="cube-section-square"]').click();
  await expect(page.locator('.challenge-prompt')).toContainText('가로로 반쯤');
  await expect(page.locator('.stage-section-label')).toContainText('답을 제출');
  await page.getByRole('radio', { name: /^A 정사각형/ }).click();
  await page.getByRole('button', { name: '답 제출하기' }).click();
  await expect(page.locator('.stage-section-label')).toContainText('단면 · 정사각형');
  await expect(page.locator('.challenge-explanation')).toContainText('평행');
});

test('resets progress from teacher mode', async ({ page }) => {
  await page.goto('/');
  await openChallenge(page);
  await page.getByRole('radio', { name: /접을 수 있어요/ }).click();
  await page.getByRole('button', { name: '답 제출하기' }).click();
  await expect(page.locator('.challenge-stars').first()).toContainText('완료 1/8');

  await page.getByRole('link', { name: '교사' }).click();
  await expect(page).toHaveURL(/#teacher/);
  await page.getByRole('checkbox', { name: '정답과 해설 보기' }).check();
  await expect(page.locator('.answer-solution').first()).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '진행 초기화' }).click();
  await expect(page.locator('.teacher-stat').first()).toContainText('0/8');
  await page.waitForTimeout(300);
  const saved = await page.evaluate(() => localStorage.getItem('polyfold.progress.v1'));
  expect(saved).not.toBeNull();
  const parsed = JSON.parse(saved!);
  expect(parsed.answers).toEqual({});
  expect(parsed.stars).toEqual({});
});
