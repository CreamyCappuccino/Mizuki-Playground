import { expect, test } from '@playwright/test';

// Software-rendered WebGL on hosted CI is slower than a desktop GPU.
test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text());
  });
  // Store actual application / renderer failures, not optional external-texture HTTP errors.
  (page as typeof page & { appErrors: string[] }).appErrors = errors;
  await page.goto('/', { waitUntil: 'domcontentloaded' });
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

test('solar noon and midnight change the scene but not daily or annual averages', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const annualPath = await page.locator('.chart-line').getAttribute('d');
  const meanTemp = await page.locator('#metric-temp').textContent();
  const meanSolar = await page.locator('#metric-solar').textContent();
  await page.locator('[data-mode="instant"]').click();
  await page.locator('#noon-here').click();
  await expect(page.locator('#metric-solar-time')).toHaveText('12:00');
  await expect(page.locator('#illumination-state')).toHaveText('Daytime');
  await expect(page.locator('#surface-legend-title')).toContainText('Sun now');
  await page.locator('#focus-location').click();
  const before = await page.locator('#earth-canvas').screenshot();
  const noon = testInfo.outputPath('v03-taipei-noon.png');
  await page.screenshot({ path: noon });
  await testInfo.attach('Taipei solar noon', { path: noon, contentType: 'image/png' });
  await page.locator('#midnight-here').click();
  await expect(page.locator('#metric-solar-time')).toHaveText('00:00');
  await expect(page.locator('#illumination-state')).toHaveText('Night');
  await expect(page.locator('#metric-instant')).toHaveText('0 W/m²');
  await page.locator('#focus-location').click();
  const after = await page.locator('#earth-canvas').screenshot();
  expect(before.equals(after)).toBe(false);
  expect(await page.locator('.chart-line').getAttribute('d')).toBe(annualPath);
  await expect(page.locator('#metric-temp')).toHaveText(meanTemp!);
  await expect(page.locator('#metric-solar')).toHaveText(meanSolar!);
  const midnight = testInfo.outputPath('v03-taipei-midnight.png');
  await page.screenshot({ path: midnight });
  await testInfo.attach('Taipei solar midnight', { path: midnight, contentType: 'image/png' });
});

test('day graph uses a daily mean reference and keeps its curve while spinning', async ({ page }) => {
  await page.locator('#compare-earth').check();
  await page.locator('[data-period="day"]').click();
  await expect(page.locator('#chart-title')).toHaveText('Instantaneous solar (TOA)');
  // A horizontal SVG line has a zero-height bounding box even with a painted stroke.
  // Check the visible chart plus the reference's paint and in-chart geometry instead.
  await expect(page.locator('#annual-chart svg')).toBeVisible();
  const meanLine = page.locator('.day-chart-mean');
  await expect(meanLine).toHaveCount(1);
  await expect(meanLine).toHaveCSS('stroke', 'rgb(255, 220, 125)');
  await expect(meanLine).toHaveCSS('stroke-width', '1px');
  await expect(meanLine).toHaveCSS('visibility', 'visible');
  const meanY = Number(await meanLine.getAttribute('y1'));
  const gridY = await page.locator('#annual-chart .chart-grid').evaluateAll(lines => lines.map(line => Number(line.getAttribute('y1'))));
  expect(meanY).toBeGreaterThan(Math.min(...gridY));
  expect(meanY).toBeLessThan(Math.max(...gridY));
  await expect(meanLine).toHaveAttribute('y2', String(meanY));
  await page.locator('#noon-here').click();
  const path = await page.locator('.day-chart-line').getAttribute('d');
  const cursor = await page.locator('.day-chart-active').getAttribute('x1');
  await page.locator('.day-chart-line').evaluate(el => el.setAttribute('data-retained', 'yes'));
  const day = await page.locator('#day-readout').textContent();
  await page.locator('#play-day').click();
  await expect.poll(() => page.locator('.day-chart-active').getAttribute('x1')).not.toBe(cursor);
  await page.locator('#play-day').click();
  await expect(page.locator('#day-readout')).toHaveText(day!);
  expect(await page.locator('.day-chart-line').getAttribute('d')).toBe(path);
  await expect(page.locator('.day-chart-line')).toHaveAttribute('data-retained', 'yes');
  await page.locator('[data-period="year"]').click();
  await expect(page.locator('.chart-reference')).toBeVisible();
});

test('year and day transport are mutually exclusive and slider edits pause', async ({ page }) => {
  await page.locator('#play-year').click();
  await page.locator('#play-day').click();
  await expect(page.locator('#play-year')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#play-day')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#rotation').evaluate((el: HTMLInputElement) => {
    el.value = '90'; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#rotation-readout')).toHaveText('90.0°');
  await expect(page.locator('#play-day')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#play-day').click();
  await page.locator('#play-year').click();
  await expect(page.locator('#play-day')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#play-year')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#play-year').click();
});

test('polar day remains illuminated throughout a rotation and winter becomes night', async ({ page }, testInfo) => {
  await page.locator('[data-tilt="90"]').click();
  await page.locator('#location-select').selectOption('north-pole');
  await page.locator('[data-period="day"]').click();
  await page.locator('[data-mode="instant"]').click();
  await expect(page.locator('#metric-solar-time')).toHaveText('Undefined');
  await expect(page.locator('#noon-here')).toBeDisabled();
  await expect(page.locator('#illumination-state')).toHaveText('Daytime');
  const flux = await page.locator('#metric-instant').textContent();
  for (const rotation of [90, 180, 270]) {
    await page.locator('#rotation').evaluate((el: HTMLInputElement, value) => {
      el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true }));
    }, rotation);
    await expect(page.locator('#metric-instant')).toHaveText(flux!);
  }
  await page.locator('#day').evaluate((el: HTMLInputElement) => {
    el.value = '355'; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#illumination-state')).toHaveText('Night');
  await expect(page.locator('#metric-instant')).toHaveText('0 W/m²');
  const polar = testInfo.outputPath('v03-polar-night.png');
  await page.screenshot({ path: polar });
  await testInfo.attach('90 degree polar winter', { path: polar, contentType: 'image/png' });
});

test('location picking in a rotated frame still returns the geographic point', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#location-select').selectOption('singapore');
  await page.locator('#rotation').evaluate((el: HTMLInputElement) => {
    el.value = '137'; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#focus-location').click();
  await page.mouse.click(720, 500);
  await expect(page.locator('#location-name')).toHaveText('Custom point');
  await expect(page.locator('#location-coords')).toHaveText('1.35° N · 103.82° E');
});
