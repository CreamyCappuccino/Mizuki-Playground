import { test, expect, type Page } from '@playwright/test';
import { DEFAULT_EXPERIMENT, encodeExperiment } from '../src/experiments/state';

const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const list: string[] = []; errors.set(page, list);
  page.on('pageerror', e => list.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) list.push(m.text()); });
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

for (const mobile of [false, true]) {
  test(`radiant Sun compiles in actual orbit and close-up views ${mobile ? 'Japanese mobile' : 'desktop'}`, async ({ page }, info) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    if (mobile) await page.addInitScript(() => {
      localStorage.setItem('earth-lab:language', 'ja'); localStorage.setItem('earth-lab:text-size', 'large');
    });
    await page.goto('/' + encodeExperiment({ ...DEFAULT_EXPERIMENT, sceneView: 'orbit', surfaceMode: 'normal', day: 172 }));
    const canvas = page.locator('#earth-canvas');
    await expect(page.locator('#experiment-notice')).toHaveAttribute('data-status', 'ready');
    await expect(canvas).toHaveAttribute('data-sun-appearance', 'radiant-granulation-v2');
    await expect(canvas).toHaveAttribute('data-scene-view', 'orbit');
    await expect.poll(async () => Number(await canvas.getAttribute('data-render-count'))).toBeGreaterThan(1);
    const solar = await page.locator('#metric-solar').textContent();
    await canvas.screenshot({ path: info.outputPath(mobile ? 'sun-orbit-mobile-ja.png' : 'sun-orbit-desktop.png') });
    await page.locator('#scene-view').selectOption('earth');
    await expect(canvas).toHaveAttribute('data-scene-view', 'earth');
    await expect(page.locator('#metric-solar')).toHaveText(solar!);
    await page.locator('#scene-view').selectOption('orbit');
    await expect(canvas).toHaveAttribute('data-scene-view', 'orbit');
    await expect(page.locator('#metric-solar')).toHaveText(solar!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}
