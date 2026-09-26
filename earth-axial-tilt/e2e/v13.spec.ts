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
  await expect(page.locator('#temperature-model-note')).toContainText('not a real Earth map');
  await expect(page.locator('#profile-summary')).toContainText('Dashed: other idealized surface');
  const land = await page.locator('#metric-temp').textContent();
  await page.locator('#climate-geography').selectOption('idealized-ocean');
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('#metric-temp')).not.toHaveText(land!);
  await page.locator('.thermal-controls').screenshot({ path: info.outputPath('v13-climate-geography-controls.png') });
  await page.locator('#temperature-model').selectOption('illustrative');
  await expect(page.locator('#climate-geography')).toHaveValue('classic');
  await expect(page.locator('#climate-geography')).toBeDisabled();
});

test('schema 3 keeps geography while schema 2 migrates to Classic', async ({ page }) => {
  await open(page, { ...DEFAULT_EXPERIMENT, climateProfile: 'idealized-land' });
  const hash = await page.evaluate(() => location.hash);
  expect(decodeExperiment(hash)).toEqual({ status: 'ok', state: { ...DEFAULT_EXPERIMENT, climateProfile: 'idealized-land' } });
  await page.goto('/#lab=2&e=.1&model=energy-balance');
  await expect(page.locator('#experiment-notice')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('#climate-geography')).toHaveValue('classic');
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
  await page.locator('#focus-view').click();
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-scene-view', 'orbit');
  await page.screenshot({ path: info.outputPath('v13-ocean-compare-focus-ja.png') });
  await page.keyboard.press('Escape');
  await expect(page.locator('#climate-geography')).toHaveValue('idealized-ocean');
  await page.locator('[data-help-topic="geography"]').click();
  await expect(page.locator('#help-title')).toHaveText('気候の地理');
});
