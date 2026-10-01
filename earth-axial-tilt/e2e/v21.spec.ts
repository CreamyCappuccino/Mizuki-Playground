import { expect, test } from '@playwright/test';

test.describe('Planet Lab v2.1', () => {
  test('compares Earth and Mars without inventing a Mars climate model', async ({ page }) => {
    await page.goto('/planet-lab.html#planet=1&a=earth&b=mars&ls=90&lat=25');
    await expect(page.locator('[data-pl="title"]')).toContainText('Earth');
    await expect(page.locator('#pl-card-a h2')).toHaveText('Earth');
    await expect(page.locator('#pl-card-b h2')).toHaveText('Mars');
    await expect(page.locator('#pl-card-b .pl-capability')).toContainText('Not provided');
    await expect(page.locator('#pl-card-a .pl-metrics')).toContainText('W/m²');
    await expect(page.locator('#pl-card-b .pl-metrics')).toContainText('AU');
  });

  test('uses a versioned share state and can switch to Japanese Large', async ({ page }) => {
    await page.goto('/planet-lab.html#planet=1&a=mars&b=earth&ls=251&lat=-30');
    await expect(page.locator('#pl-world-a')).toHaveValue('mars');
    await expect(page.locator('#pl-season')).toHaveValue('251');
    await page.locator('#pl-language').selectOption('ja');
    await expect(page.locator('[data-pl="scope"]')).toContainText('Mars');
    await page.locator('#pl-large').check();
    await expect(page.locator('#pl-shell')).toHaveClass(/large/);
    await page.locator('[data-season="270"]').click();
    await expect(page).toHaveURL(/ls=270/);
    await expect(page.locator('#pl-url')).toHaveValue(/planet=1/);
  });
});


test('Planet Lab rejects incomplete links and updates hash state atomically', async ({ page }) => {
  const invalid = '#planet=1&a=earth&b=mars&ls=&lat=25';
  await page.goto('/planet-lab.html' + invalid);
  await expect(page.locator('#pl-status')).toContainText('Invalid share link');
  expect(new URL(page.url()).hash).toBe(invalid);
  await expect(page.locator('#pl-season')).toHaveValue('90');
  await page.evaluate(() => { location.hash = 'planet=1&a=mars&b=earth&ls=251&lat=-30'; });
  await expect(page.locator('#pl-card-a h2')).toHaveText('Mars');
  await expect(page.locator('#pl-season')).toHaveValue('251');
  const before = await page.locator('#pl-card-a').innerText();
  const link = await page.locator('#pl-url').inputValue();
  await page.locator('#pl-season').fill('360');
  await expect(page.locator('#pl-status')).toContainText('previous comparison');
  expect(await page.locator('#pl-card-a').innerText()).toBe(before);
  await expect(page.locator('#pl-url')).toHaveValue(link);
  await page.locator('#pl-season').fill('');
  expect(await page.locator('#pl-card-a').innerText()).toBe(before);
  await page.locator('#pl-season').fill('270');
  await expect(page.locator('#pl-status')).toHaveText('');
  await expect(page.locator('#pl-url')).toHaveValue(/ls=270/);
});

test('Planet Lab works without local storage', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', {
    get() { throw new DOMException('Blocked for test', 'SecurityError'); },
  }));
  await page.goto('/planet-lab.html');
  await expect(page.locator('#pl-card-b h2')).toHaveText('Mars');
  await page.locator('#pl-language').selectOption('ja');
  await expect(page.locator('[data-pl="title"]')).toContainText('天文比較');
});

test('Planet Lab desktop and Japanese Large mobile screenshots', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/planet-lab.html#planet=1&a=earth&b=mars&ls=270&lat=25');
  await expect(page.locator('#pl-card-b .pl-metrics')).toContainText('W/m²');
  await page.screenshot({ path: testInfo.outputPath('planet-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#pl-language').selectOption('ja');
  await page.locator('#pl-large').check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('planet-mobile-ja-large.png'), fullPage: true });
});


test('main Earth overlay panels can be hidden independently and persist on a laptop viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/index.html');
  await expect(page.locator('#controls-panel')).toBeVisible();
  await expect(page.locator('#location-panel')).toBeVisible();
  await page.locator('#toggle-controls-panel').click();
  await expect(page.locator('#controls-panel')).toBeHidden();
  await expect(page.locator('#location-panel')).toBeVisible();
  await page.locator('#toggle-location-panel').click();
  await expect(page.locator('#location-panel')).toBeHidden();
  await expect(page.locator('#earth-canvas')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('earth-panels-collapsed-1366.png') });
  await page.reload();
  await expect(page.locator('#controls-panel')).toBeHidden();
  await expect(page.locator('#location-panel')).toBeHidden();
  await page.locator('#toggle-controls-panel').click();
  await page.locator('#toggle-location-panel').click();
  await expect(page.locator('#controls-panel')).toBeVisible();
  await expect(page.locator('#location-panel')).toBeVisible();
});
