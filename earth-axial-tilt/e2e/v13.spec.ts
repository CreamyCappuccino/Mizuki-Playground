import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_EXPERIMENT, decodeExperiment, encodeExperiment } from '../src/experiments/state';

test.setTimeout(90_000);
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on('pageerror', error => list.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) list.push(message.text());
  });
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

async function open(page: Page, state = DEFAULT_EXPERIMENT) {
  await page.goto('/' + encodeExperiment(state));
  await expect(page.locator('#experiment-notice')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status', 'ready');
}

test('idealized land and ocean expose a same-forcing amplitude and lag contrast', async ({ page }, info) => {
  await open(page);
  await page.locator('#climate-geography').selectOption('idealized-land');
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('#heat-storage')).toBeDisabled();
  await expect(page.locator('#heat-retained-note')).toContainText('Classic value retained, currently unused');
  await expect(page.locator('#heat-retained-note')).toContainText('land 2.5 m / ocean 50 m');
  await expect(page.locator('#profile-reference-control')).toBeHidden();
  await expect(page.locator('#profile-reference-note')).toBeVisible();
  await expect(page.locator('#temperature-model-note')).toContainText('not a real Earth map');
  await expect(page.locator('#profile-summary')).toContainText('Dashed: other idealized surface');
  await page.locator('#profile-reference-note').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('v13-idealized-reference-routing.png') });
  const land = await page.locator('#metric-temp').textContent();
  await page.locator('#climate-geography').selectOption('idealized-ocean');
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('#metric-temp')).not.toHaveText(land!);
  await page.locator('.thermal-controls').screenshot({ path: info.outputPath('v13-climate-geography-controls.png') });
  await page.locator('#temperature-model').selectOption('illustrative');
  await expect(page.locator('#climate-geography')).toHaveValue('classic');
  await expect(page.locator('#climate-geography')).toBeDisabled();
  await expect(page.locator('#heat-retained-note')).toBeHidden();
});

test('annual land/ocean counterpart curves are fully visible in browser evidence', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await open(page, { ...DEFAULT_EXPERIMENT, climateProfile: 'idealized-land' });
  await expect(page.locator('#profile-summary')).toContainText('Dashed: other idealized surface');
  await page.locator('#annual-chart').scrollIntoViewIfNeeded();
  await expect(page.locator('#annual-chart')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#annual-chart svg')).toBeVisible();
  await expect(page.locator('#annual-chart .chart-line')).toBeVisible();
  await expect(page.locator('#annual-chart .chart-reference')).toBeVisible();
  await page.screenshot({ path: info.outputPath('v13-annual-land-ocean-curves.png') });
});

test('desktop dual and single orbit retain the full presentation', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, { ...DEFAULT_EXPERIMENT, dual: true, sceneView: 'orbit' });
  await expect(page.locator('#compare-status')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-orbit-compact', 'false');
  await page.locator('#earth-canvas').screenshot({ path: info.outputPath('v13-desktop-dual-orbit.png') });
  await page.locator('#compare-toggle').click();
  await expect(page.locator('#earth-canvas')).not.toHaveAttribute('data-view-b', /.+/);
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-orbit-compact', 'false');
  await page.locator('#earth-canvas').screenshot({ path: info.outputPath('v13-desktop-single-orbit.png') });
});

test('schema 3 keeps geography while schema 2 migrates to Classic', async ({ page }) => {
  await open(page, { ...DEFAULT_EXPERIMENT, climateProfile: 'idealized-land' });
  const hash = await page.evaluate(() => location.hash);
  expect(decodeExperiment(hash)).toEqual({ status: 'ok', state: { ...DEFAULT_EXPERIMENT, climateProfile: 'idealized-land' } });
  await page.goto('/#lab=2&e=.1&model=energy-balance');
  await expect(page.locator('#experiment-notice')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('#climate-geography')).toHaveValue('classic');
});

test('schema restore changes retained Classic depth without reusing stale A or B provenance', async ({ page }) => {
  const first = { ...DEFAULT_EXPERIMENT, climateProfile: 'idealized-land' as const, heatDepth: 10 as const, dual: true };
  await open(page, first);
  await expect(page.locator('#compare-status')).toHaveAttribute('data-status', 'ready');
  const second = { ...first, heatDepth: 50 as const };
  await page.evaluate(hash => { location.hash = hash; }, encodeExperiment(second));
  await expect(page.locator('#experiment-notice')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('#compare-status')).toHaveAttribute('data-status', 'ready');
  expect(decodeExperiment(await page.evaluate(() => location.hash))).toEqual({ status: 'ok', state: second });
});

test('Atlas geography difference uses the other surface, not Earth B or 23.44 degrees', async ({ page }, info) => {
  await open(page, { ...DEFAULT_EXPERIMENT, climateProfile: 'idealized-land' });
  await page.locator('#open-atlas').click();
  await expect(page.locator('#season-atlas')).toBeVisible();
  await expect(page.locator('#atlas-reference-note')).toContainText('other idealized surface');
  await expect(page.locator('#atlas-difference-option')).toHaveText('Difference between idealized surfaces');
  await page.locator('#atlas-metric').selectOption('temperature');
  await page.locator('#atlas-view').selectOption('difference');
  await expect(page.locator('#atlas-plot')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#atlas-scale-note')).toContainText('Selected surface');
  await page.screenshot({ path: info.outputPath('v13-land-ocean-atlas.png'), fullPage: true });
});

test('Atlas repaints astronomy differences when the reference meaning changes', async ({ page }) => {
  await open(page, { ...DEFAULT_EXPERIMENT, tilt: 60 });
  await page.locator('#open-atlas').click();
  await page.locator('#atlas-metric').selectOption('insolation');
  await page.locator('#atlas-view').selectOption('difference');
  const canvas = page.locator('#atlas-field');
  const classicRevision = Number(await canvas.getAttribute('data-field-revision'));
  const classicScale = await page.locator('#atlas-scale-labels').textContent();
  expect(classicScale).not.toBe('-1 W/m²0 W/m²1 W/m²');
  await page.locator('#atlas-close').click();
  await page.locator('#climate-geography').selectOption('idealized-land');
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status', 'ready');
  await page.locator('#open-atlas').click();
  await expect(canvas).toHaveAttribute('data-field-revision', String(classicRevision + 1));
  await expect(page.locator('#atlas-scale-labels')).toHaveText('-1 W/m²0 W/m²1 W/m²');
  await page.locator('#atlas-close').click();
  await page.locator('#climate-geography').selectOption('classic');
  await page.locator('#open-atlas').click();
  await expect(canvas).toHaveAttribute('data-field-revision', String(classicRevision + 2));
  await expect(page.locator('#atlas-scale-labels')).not.toHaveText('-1 W/m²0 W/m²1 W/m²');
});

test('Japanese Large mobile, Compare, Orbit and Focus preserve the selected material', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('earth-lab:language', 'ja');
    localStorage.setItem('earth-lab:text-size', 'large');
  });
  await open(page, { ...DEFAULT_EXPERIMENT, climateProfile: 'idealized-ocean', dual: true, sceneView: 'orbit' });
  await expect(page.locator('#compare-status')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('#climate-geography')).toHaveValue('idealized-ocean');
  await expect(page.locator('#temperature-model-note')).toContainText('実際の地球地図ではありません');
  await expect(page.locator('#heat-retained-note')).toContainText('Classic用の保持値で、現在は未使用');
  await page.locator('#focus-view').click();
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-scene-view', 'orbit');
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-orbit-compact', 'true');
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-orbit-label-font', '20');
  await page.screenshot({ path: info.outputPath('v13-ocean-compare-focus-ja.png') });
  await page.keyboard.press('Escape');
  await expect(page.locator('#climate-geography')).toHaveValue('idealized-ocean');
  await page.locator('[data-help-topic="geography"]').click();
  await expect(page.locator('#help-title')).toHaveText('気候の地理');
});


test('real geography preview runs the reviewed worker and changes with longitude', async ({ page }, info) => {
  await page.goto('/geography-lab.html');
  const status = page.locator('#status');
  await expect(status).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  await expect(page.locator('#cell')).toContainText('25.0° / 125.0°');
  await expect(page.locator('#fraction')).toHaveText('7.47%');
  await expect(page.locator('#map')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#atlas')).toHaveAttribute('aria-busy', 'false');
  const first = Number(await page.locator('#temperature').getAttribute('data-value'));
  await page.locator('#longitude').fill('-145');
  await page.locator('#longitude').press('Tab');
  await expect(page.locator('#cell')).toContainText('25.0° / -145.0°');
  const second = Number(await page.locator('#temperature').getAttribute('data-value'));
  expect(Number.isFinite(first)).toBe(true);
  expect(Number.isFinite(second)).toBe(true);
  expect(second).not.toBe(first);
  await page.locator('#layer').selectOption('land');
  await expect(page.locator('#map-scale')).toContainText('0–100%');
  await page.screenshot({ path: info.outputPath('v13-real-geography-preview.png'), fullPage: true });
});

test('real geography preview cancels stale work and remains readable on Japanese Large mobile', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('earth-geography:language', 'ja');
    localStorage.setItem('earth-geography:large', 'true');
  });
  await page.goto('/geography-lab.html');
  await expect(page.locator('#status')).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  await expect(page.locator('h1')).toHaveText('同じ太陽、違う地表。');
  await expect(page.locator('html')).toHaveAttribute('data-large', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.locator('#tilt').fill('60');
  await page.locator('#calculate').click();
  await expect(page.locator('#temperature')).toHaveText('—');
  await page.locator('#cancel').click();
  await expect(page.locator('#status')).toHaveAttribute('data-status', 'canceled');
  await page.locator('#calculate').click();
  await expect(page.locator('#status')).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  await expect(page.locator('#temperature')).not.toHaveText('—');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('v13-real-geography-mobile-ja.png'), fullPage: true });
});
