import { expect, test, type Page } from '@playwright/test';

test.setTimeout(90_000);
async function ready(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#visual-status')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status', 'ready');
}
async function science(page: Page) {
  return page.locator('#tilt, #day, #rotation, #location-select, #metric-temp, #metric-solar, #metric-daylight').evaluateAll(elements =>
    elements.map(el => el instanceof HTMLInputElement || el instanceof HTMLSelectElement ? el.value : el.textContent));
}

test('local imagery loads with external network blocked and does not require remote fonts', async ({ page }) => {
  const remote: string[] = [], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /shader|WebGL|THREE/i.test(message.text())) errors.push(message.text()); });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') { remote.push(url.href); return route.abort(); }
    return route.continue();
  });
  await ready(page);
  expect(remote).toEqual([]); expect(errors).toEqual([]);
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-day-texture', 'ready');
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-night-texture', 'ready');
  await expect(page.locator('.appearance-controls')).toContainText('CC BY 4.0');
});

test('focus view clears the panels and returns by keyboard without changing the planet', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await ready(page);
  await page.locator('#noon-here').click(); await page.locator('#focus-location').click();
  const before = await science(page);
  await page.locator('#focus-view').click();
  await expect(page.locator('.controls')).toBeHidden(); await expect(page.locator('.location-panel')).toBeHidden();
  await expect(page.locator('#focus-view')).toHaveText('Show controls');
  await expect(page.locator('#focus-view')).toBeFocused();
  await page.screenshot({ path: info.outputPath('v07-focus-day.png') });
  expect(await science(page)).toEqual(before);
  await page.keyboard.press('Escape');
  await expect(page.locator('.controls')).toBeVisible(); await expect(page.locator('.location-panel')).toBeVisible();
  expect(await science(page)).toEqual(before);
  await expect(page.locator('#focus-view')).toBeFocused();
});

test('quality changes actual drawing resolution and persists, without changing physics', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  try {
    await ready(page); const before = await science(page);
    for (const [quality, expectedRatio] of [['eco', 1], ['balanced', 1.5], ['high', 2]] as const) {
      await page.locator('#visual-quality').selectOption(quality);
      await expect.poll(() => page.locator('#earth-canvas').evaluate((el: HTMLCanvasElement) => el.width / el.clientWidth)).toBeCloseTo(expectedRatio, 2);
      expect(await science(page)).toEqual(before);
    }
    await page.locator('#visual-quality').selectOption('eco'); await page.reload();
    await expect(page.locator('#visual-quality')).toHaveValue('eco');
    await expect(page.locator('#earth-canvas')).toHaveAttribute('data-quality', 'eco');
  } finally { await context.close(); }
});

test('fixed night lights are visible in the night view but absent from scientific maps', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await ready(page);
  await page.locator('#midnight-here').click(); await page.locator('#focus-location').click();
  const before = await science(page);
  await page.locator('#focus-view').click();
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-night-lights-visible', 'true');
  await page.screenshot({ path: info.outputPath('v07-focus-night.png') });
  // A real renderer capture, not just a DOM class. Same camera/time, lights only.
  const lit = await page.locator('#earth-canvas').screenshot();
  await page.locator('#focus-view').click(); await page.locator('#night-lights').uncheck();
  await page.locator('#focus-view').click();
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-night-lights-visible', 'false');
  const unlit = await page.locator('#earth-canvas').screenshot();
  expect(lit.equals(unlit)).toBe(false); expect(await science(page)).toEqual(before);
  await page.locator('#focus-view').click(); await page.locator('#night-lights').check();
  await page.locator('[data-mode="insolation"]').click();
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-night-lights-visible', 'false');
  expect(await science(page)).toEqual(before);
});

test('settled scene stops submitting identical WebGL frames and resumes on a change', async ({ page }) => {
  await ready(page);
  const canvas = page.locator('#earth-canvas');
  await expect(canvas).toHaveAttribute('data-render-count', /[1-9]/);
  await page.waitForTimeout(300); // Let initial resize/worker replies settle before measuring idle.
  const count = await canvas.getAttribute('data-render-count');
  await page.waitForTimeout(650);
  expect(await canvas.getAttribute('data-render-count')).toBe(count);
  await page.locator('[data-tilt="60"]').click();
  await expect.poll(() => canvas.getAttribute('data-render-count')).not.toBe(count);
});

test('failed decorative image is reported while science and the atlas remain usable', async ({ page }) => {
  await page.route('**/*earth-day-4096*', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#visual-status')).toContainText('Day map unavailable');
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status', 'ready');
  await page.locator('[data-mode="daylight"]').click();
  await expect(page.locator('#metric-daylight')).toContainText('h');
  await page.locator('#open-atlas').click(); await expect(page.locator('#season-atlas')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#season-atlas')).toBeHidden();
});

test('portrait focus keeps the return button readable and restores the large-text panels', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await ready(page); await page.locator('#text-size').selectOption('large');
    await page.locator('#focus-view').click();
    await expect(page.locator('#focus-view')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('#earth-canvas').evaluate(el => el.getBoundingClientRect().height)).toBeCloseTo(844, 0);
    await page.screenshot({ path: info.outputPath('v07-focus-mobile.png') });
    await page.locator('#focus-view').click();
    await expect(page.locator('#text-size')).toHaveValue('large');
    await expect(page.locator('.location-panel')).toBeVisible();
    await expect(page.locator('#metric-temp')).toHaveCSS('font-size', '24px');
  } finally { await context.close(); }
});
