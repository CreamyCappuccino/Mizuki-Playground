import { expect, test, type Page } from '@playwright/test';

test.setTimeout(90_000);
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const messages: string[] = [];
  errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) messages.push(message.text());
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#metric-temp')).not.toHaveText('—');
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status', 'ready');
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

async function pointOnPlot(page: Page, fraction: number) {
  await page.locator('#annual-chart').scrollIntoViewIfNeeded();
  return page.locator('#annual-chart svg').evaluate((element, f) => {
    const svg = element as SVGSVGElement;
    const lines = Array.from(svg.querySelectorAll('.chart-grid'));
    const x1 = Number(lines[0].getAttribute('x1'));
    const x2 = Number(lines[0].getAttribute('x2'));
    const ys = lines.map(line => Number(line.getAttribute('y1')));
    const point = svg.createSVGPoint();
    point.x = x1 + f * (x2 - x1); point.y = (Math.min(...ys) + Math.max(...ys)) / 2;
    const client = point.matrixTransform(svg.getScreenCTM()!);
    return { x: client.x, y: client.y };
  }, fraction);
}

async function effectiveChartFont(page: Page) {
  return page.locator('#annual-chart .chart-axis').first().evaluate(element => {
    const matrix = (element as SVGGraphicsElement).getScreenCTM()!;
    return parseFloat(getComputedStyle(element).fontSize) * Math.hypot(matrix.a, matrix.b);
  });
}

test('right panel is readable by default and the SVG uses real-size labels', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [selector, min] of [['.metrics span', 14], ['.metrics strong', 22], ['.moment-metrics strong', 22], ['.model-note', 14], ['.profile-summary', 15]] as const) {
    expect(await page.locator(selector).first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(min);
  }
  await expect.poll(() => effectiveChartFont(page)).toBeGreaterThanOrEqual(13.9);
  await expect(page.locator('#metric-solar')).toHaveCSS('text-overflow', 'clip');
  const screenshot = info.outputPath('v04-readable-overview.png');
  await page.screenshot({ path: screenshot });
  await info.attach('Readable overview with real WebGL', { path: screenshot, contentType: 'image/png' });
  await page.locator('#jump-chart').click();
  const chartShot = info.outputPath('v04-readable-chart.png');
  await page.screenshot({ path: chartShot });
  await info.attach('Readable interactive annual chart', { path: chartShot, contentType: 'image/png' });
});

test('large typography persists and reflows without shrinking graph labels', async ({ page }, info) => {
  await page.locator('#text-size').selectOption('large');
  await expect(page.locator('#metric-temp')).toHaveCSS('font-size', '24px');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#text-size')).toHaveValue('large');
  await expect(page.locator('#metric-temp')).not.toHaveText('—');
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status', 'ready');
  for (const width of [1024, 760, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect.poll(() => effectiveChartFont(page)).toBeGreaterThanOrEqual(15.9);
    const panels = await page.locator('.controls, .location-panel').evaluateAll(elements => elements.map(el => {
      const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
    }));
    expect(panels[0].right <= panels[1].left || panels[0].bottom <= panels[1].top).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const screenshot = info.outputPath('v04-large-mobile.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await info.attach('Large text mobile layout', { path: screenshot, contentType: 'image/png' });
});

test('annual graph click and captured drag set the date and pause playback', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#compare-earth').check();
  const path = await page.locator('.chart-line').getAttribute('d');
  await page.locator('.chart-line').evaluate(el => el.setAttribute('data-retained', 'yes'));
  await page.locator('#play-year').click();
  for (const [fraction, day] of [[0, 1], [.5, 183], [1, 365]]) {
    const point = await pointOnPlot(page, fraction);
    await page.mouse.click(point.x, point.y);
    await expect(page.locator('#day-readout')).toHaveText(String(day));
    await expect(page.locator('#play-year')).toHaveAttribute('aria-pressed', 'false');
  }
  const start = await pointOnPlot(page, .25), end = await pointOnPlot(page, .75);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await expect(page.locator('#day-readout')).toHaveText('274');
  // Leave the plot and panel while dragging. Pointer capture must retain ownership.
  await page.mouse.move(start.x - 250, end.y, { steps: 5 }); await page.mouse.up();
  await expect(page.locator('#day-readout')).toHaveText('1');
  await expect(page.locator('#location-name')).toHaveText('Taipei');
  await expect(page.locator('.chart-line')).toHaveAttribute('data-retained', 'yes');
  expect(await page.locator('.chart-line').getAttribute('d')).toBe(path);
  await expect(page.locator('.chart-reference')).toHaveCount(1);
});

test('daily graph keyboard selects solar time without changing averages or the curve', async ({ page }) => {
  await page.locator('[data-period="day"]').click();
  const chart = page.locator('#annual-chart');
  await chart.scrollIntoViewIfNeeded();
  const mean = await page.locator('#metric-solar').textContent();
  const temperature = await page.locator('#metric-temp').textContent();
  const day = await page.locator('#day-readout').textContent();
  await page.locator('.day-chart-line').evaluate(el => el.setAttribute('data-retained', 'yes'));
  const path = await page.locator('.day-chart-line').getAttribute('d');
  await page.locator('#play-day').click();
  await chart.press('Home');
  await expect(page.locator('#metric-solar-time')).toHaveText('00:00');
  await expect(page.locator('#play-day')).toHaveAttribute('aria-pressed', 'false');
  await chart.press('ArrowRight');
  await expect(page.locator('#metric-solar-time')).toHaveText('00:15');
  await chart.press('PageUp');
  await expect(page.locator('#metric-solar-time')).toHaveText('01:15');
  await chart.press('End');
  await expect(page.locator('#metric-solar-time')).toHaveText('23:59');
  const noon = await pointOnPlot(page, .5); await page.mouse.click(noon.x, noon.y);
  await expect(page.locator('#metric-solar-time')).toHaveText('12:00');
  await expect(chart).toHaveAttribute('aria-valuetext', /12:00.*local solar time/);
  await expect(page.locator('#metric-solar')).toHaveText(mean!);
  await expect(page.locator('#metric-temp')).toHaveText(temperature!);
  await expect(page.locator('#day-readout')).toHaveText(day!);
  expect(await page.locator('.day-chart-line').getAttribute('d')).toBe(path);
  await expect(page.locator('.day-chart-line')).toHaveAttribute('data-retained', 'yes');
});

test('a resized annual graph maps keyboard and pointer to the same day', async ({ page }) => {
  const chart = page.locator('#annual-chart');
  await chart.press('Home'); await chart.press('PageUp'); await chart.press('ArrowRight');
  await expect(page.locator('#day-readout')).toHaveText('32');
  await expect(page.locator('#chart-selection')).toContainText('Feb 1');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => effectiveChartFont(page)).toBeGreaterThanOrEqual(13.9);
  const point = await pointOnPlot(page, .5); await page.mouse.click(point.x, point.y);
  await expect(page.locator('#day-readout')).toHaveText('183');
  await expect(chart).toHaveAttribute('aria-valuenow', '183');
});

test('polar graph selection is nominal time, not a fabricated solar meridian', async ({ page }) => {
  await page.locator('#location-select').selectOption('north-pole');
  await page.locator('[data-period="day"]').click();
  const flux = await page.locator('#metric-instant').textContent();
  const chart = page.locator('#annual-chart');
  await chart.press('Home'); await chart.press('PageUp');
  await expect(page.locator('#rotation-readout')).toHaveText('15.0°');
  await expect(page.locator('#metric-solar-time')).toHaveText('Undefined');
  await expect(page.locator('#chart-selection')).toContainText('01:00 · nominal rotation time');
  await expect(page.locator('#metric-instant')).toHaveText(flux!);
  await expect(chart).toHaveAttribute('aria-label', /nominal rotation time/);
});

test.describe('mobile chart touch gestures', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('tap selects solar noon and vertical swipes scroll without changing time', async ({ page }) => {
    await page.locator('[data-period="day"]').click();
    const point = await pointOnPlot(page, .5);
    await page.touchscreen.tap(point.x, point.y);
    await expect(page.locator('#metric-solar-time')).toHaveText('12:00');
    const before = await page.evaluate(() => scrollY);
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, id: 1 }] });
    for (const distance of [12, 30, 60, 90]) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y + distance, id: 1 }] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(before);
    await expect(page.locator('#metric-solar-time')).toHaveText('12:00');
    await session.detach();
  });
});
