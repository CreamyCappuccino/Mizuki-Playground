import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text());
  });
  // Store actual application / renderer failures, not optional external-texture HTTP errors.
  (page as typeof page & { appErrors: string[] }).appErrors = errors;
  await page.goto('/');
  await expect(page.locator('#metric-temp')).not.toHaveText('—');
});

test.afterEach(async ({ page }) => {
  expect((page as typeof page & { appErrors: string[] }).appErrors).toEqual([]);
});

test('precise input, presets and slider remain synchronized', async ({ page }) => {
  const angle = page.getByLabel('Exact angle');
  await expect(angle).toHaveValue('23.44');
  await angle.fill('37.5'); await angle.press('Enter');
  await expect(page.locator('#tilt')).toHaveValue('37.5');
  await expect(page.locator('#tilt-readout')).toHaveText('37.50°');
  await angle.fill('120'); await angle.press('Enter');
  await expect(angle).toHaveValue('37.5');
  await angle.fill(''); await angle.press('Tab');
  await expect(angle).toHaveValue('37.5');
  await angle.fill('50.25'); await angle.press('Tab');
  await expect(page.locator('#tilt')).toHaveValue('50.25');
  await angle.fill('40'); await angle.press('Escape');
  await expect(angle).toHaveValue('50.25');
  await page.getByRole('button', { name: '90°', exact: true }).click();
  await expect(angle).toHaveValue('90');
  await page.locator('#tilt').evaluate((element: HTMLInputElement) => {
    element.value = '45'; element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(angle).toHaveValue('45');
});

test('science layers, polar seasons and reference graph respond', async ({ page }, testInfo) => {
  await page.locator('#compare-earth').check();
  await expect(page.locator('.chart-reference')).toBeVisible();
  const original = await page.locator('.chart-line').getAttribute('d');
  await page.locator('[data-tilt="90"]').click();
  expect(await page.locator('.chart-line').getAttribute('d')).not.toBe(original);
  await page.locator('#location-select').selectOption('north-pole');
  await expect(page.locator('#metric-daylight')).toHaveText('24.0 h');
  await page.locator('[data-mode="insolation"]').click();
  await expect(page.locator('#surface-legend-ticks')).toContainText('1361');
  await page.locator('#show-guides').uncheck(); await page.locator('#show-guides').check();
  await expect(page.locator('#subsolar-readout')).not.toHaveText('—');
  const desktop = testInfo.outputPath('extreme-tilt.png');
  await page.screenshot({ path: desktop });
  await testInfo.attach('90 degree science layers', { path: desktop, contentType: 'image/png' });
  await page.locator('#day').evaluate((element: HTMLInputElement) => {
    element.value = '355'; element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#metric-daylight')).toHaveText('0.0 h');
  await page.locator('[data-mode="temperature"]').click();
  await expect(page.locator('#surface-legend-title')).toContainText('Daily-mean');
  await expect(page.locator('#profile-summary')).toContainText('Annual mean');
  await page.locator('.model-details summary').click();
  await expect(page.locator('.model-details')).toContainText('not calibrated to Taipei or Singapore');
});

test('drag rotates without choosing a location; click still selects', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const canvas = await page.locator('#earth-canvas').boundingBox();
  if (!canvas) throw new Error('Canvas was not laid out.');
  const x = canvas.width / 2;
  const y = canvas.height * 0.40;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 70, y + 20, { steps: 10 }); await page.mouse.up();
  await expect(page.locator('#location-name')).toHaveText('Taipei');
  await page.mouse.click(x, y);
  await expect(page.locator('#location-name')).toHaveText('Custom point');
});

test('year playback moves the existing chart cursor, not its annual path', async ({ page }) => {
  const original = await page.locator('.chart-line').getAttribute('d');
  const x = await page.locator('.chart-active').getAttribute('x1');
  await page.locator('#play-year').click();
  await expect.poll(() => page.locator('.chart-active').getAttribute('x1')).not.toBe(x);
  await page.locator('#play-year').click();
  expect(await page.locator('.chart-line').getAttribute('d')).toBe(original);
});

test('mobile viewport supports precise entry without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Exact angle').fill('41.75');
  await page.getByLabel('Exact angle').press('Enter');
  await expect(page.locator('#tilt')).toHaveValue('41.75');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const mobile = testInfo.outputPath('mobile-layout.png');
  await page.screenshot({ path: mobile, fullPage: true });
  await testInfo.attach('Mobile viewport', { path: mobile, contentType: 'image/png' });
});
