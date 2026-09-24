import { expect, test, type Page } from '@playwright/test';
import { solveSeasonalClimate, sampleThermalTemperature } from '../src/physics/energyBalance';
import { temperatureEstimateC } from '../src/physics/climate';

test.setTimeout(120_000);
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const messages: string[] = []; errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) messages.push(message.text());
  });
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });
async function ready(page: Page) {
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });
}

test('thermal model drives the map, readout and profile; legacy is explicitly recoverable', async ({ page }, info) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' }); await ready(page);
  const solution = solveSeasonalClimate(23.44, 10);
  const value = `${sampleThermalTemperature(solution, 25.033, 172).toFixed(1)} °C`;
  await expect(page.locator('#temperature-model')).toHaveValue('energy-balance');
  await expect(page.locator('#metric-temp')).toHaveText(value);
  await expect(page.locator('#chart-selection')).toContainText(value);
  await expect(page.locator('#profile-summary')).toContainText('Thermal EBM / 10 m');
  await page.locator('[data-mode="temperature"]').click();
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-temperature-layer', 'energy-balance');
  await page.locator('#compare-earth').check(); await ready(page);
  expect(await page.locator('.chart-reference').getAttribute('d')).toBe(await page.locator('.chart-line').getAttribute('d'));
  const capture = info.outputPath('v05-thermal-overview.png'); await page.screenshot({ path: capture });
  await info.attach('Thermal EBM with real WebGL', { path: capture, contentType: 'image/png' });
  await page.locator('#temperature-model').selectOption('illustrative'); await ready(page);
  await expect(page.locator('#metric-temp')).toHaveText(`${temperatureEstimateC(25.033, 172, 23.44).toFixed(1)} °C`);
  await expect(page.locator('#heat-storage')).toBeDisabled();
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-temperature-layer', 'illustrative');
});

test('heat storage changes temperature curves, not astronomy or selected day', async ({ page }, info) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' }); await ready(page);
  const solar = await page.locator('#metric-solar').textContent(), daylight = await page.locator('#metric-daylight').textContent();
  await page.locator('#heat-storage').selectOption('2.5'); await ready(page);
  const fast = await page.locator('.chart-line').getAttribute('d');
  await page.locator('#heat-storage').selectOption('50'); await ready(page);
  expect(await page.locator('.chart-line').getAttribute('d')).not.toBe(fast);
  await expect(page.locator('#profile-summary')).toContainText('Thermal EBM / 50 m');
  await expect(page.locator('#metric-solar')).toHaveText(solar!); await expect(page.locator('#metric-daylight')).toHaveText(daylight!);
  await expect(page.locator('#day-readout')).toHaveText('172');
  const mean = await page.locator('#metric-temp').textContent();
  await page.locator('#noon-here').click(); await page.locator('#midnight-here').click();
  await expect(page.locator('#metric-temp')).toHaveText(mean!);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#text-size').selectOption('large');
  await expect(page.locator('#metric-temp')).toHaveCSS('font-size', '24px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const capture = info.outputPath('v05-thermal-mobile.png'); await page.screenshot({ path: capture, fullPage: true });
  await info.attach('Thermal controls and large mobile type', { path: capture, contentType: 'image/png' });
});

test('only the last rapid thermal request is applied and pending temperatures are not fabricated', async ({ page }) => {
  await page.route('**/*climate.worker*', async route => { await new Promise(resolve => setTimeout(resolve, 800)); await route.continue(); });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // Dispatch synchronously to ensure all three edits arrive before any worker result.
  await page.evaluate(() => {
    for (const tilt of ['45', '60', '90']) (document.querySelector(`[data-tilt="${tilt}"]`) as HTMLButtonElement).click();
    const storage = document.querySelector('#heat-storage') as HTMLSelectElement;
    storage.value = '50'; storage.dispatchEvent(new Event('change'));
    (document.querySelector('[data-mode="temperature"]') as HTMLButtonElement).click();
  });
  await ready(page);
  const solution = solveSeasonalClimate(90, 50);
  await expect(page.locator('#metric-temp')).toHaveText(`${sampleThermalTemperature(solution, 25.033, 172).toFixed(1)} °C`);
  await expect(page.locator('#profile-summary')).toContainText('Thermal EBM / 50 m');
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-temperature-layer', 'energy-balance');
  await expect(page.locator('#annual-chart')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#tilt-readout')).toHaveText('90°');
});

test('failed worker leaves astronomy usable and offers explicit recovery', async ({ page }) => {
  await page.route('**/*climate.worker*', route => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status', 'error');
  await expect(page.locator('#metric-temp')).toHaveText('Unavailable');
  await expect(page.locator('.chart-line')).toHaveCount(0);
  await expect(page.locator('#retry-climate')).toBeVisible();
  await page.locator('[data-mode="insolation"]').click();
  await expect(page.locator('#metric-solar')).not.toHaveText('—');
  await page.locator('#temperature-model').selectOption('illustrative'); await ready(page);
  await expect(page.locator('.chart-line')).toHaveCount(1);
  await page.unroute('**/*climate.worker*');
  await page.locator('#temperature-model').selectOption('energy-balance'); await ready(page);
  await expect(page.locator('#metric-temp')).toHaveAttribute('data-model', 'energy-balance');
});

test('extreme-model temperatures are labelled as extrapolation, not silently clipped', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' }); await ready(page);
  await page.locator('[data-tilt="90"]').click();
  await page.locator('#heat-storage').selectOption('2.5');
  await page.locator('#location-select').selectOption('north-pole');
  await page.locator('#day').evaluate((input: HTMLInputElement) => { input.value = '200'; input.dispatchEvent(new Event('input')); });
  await ready(page);
  expect(parseFloat((await page.locator('#metric-temp').textContent())!)).toBeGreaterThan(100);
  await expect(page.locator('#climate-warning')).toContainText('not predictions');
  await page.locator('[data-mode="temperature"]').click();
  await expect(page.locator('#surface-legend-ticks')).toContainText('180');
  await expect(page.locator('#chart-selection')).toContainText('thermal EBM');
});
