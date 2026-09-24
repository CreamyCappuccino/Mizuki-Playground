import { expect, test, type Page } from '@playwright/test';

test.setTimeout(90_000);
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const messages: string[] = []; errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) messages.push(message.text()); });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status', 'ready');
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });
async function point(page: Page, fractionX=.5, fractionY=.5) {
  await page.locator('#atlas-plot').scrollIntoViewIfNeeded();
  return page.locator('#atlas-overlay').evaluate((svg, [fx,fy]) => {
    const border=svg.querySelector('.atlas-border')!;
    const x=Number(border.getAttribute('x'))+fx*Number(border.getAttribute('width'));
    const y=Number(border.getAttribute('y'))+fy*Number(border.getAttribute('height'));
    const p=(svg as SVGSVGElement).createSVGPoint();p.x=x;p.y=y;
    const result=p.matrixTransform((svg as SVGSVGElement).getScreenCTM()!);
    return {x:result.x,y:result.y};
  },[fractionX,fractionY]);
}
async function ready(page: Page) { await expect(page.locator('#atlas-plot')).toHaveAttribute('aria-busy','false'); }

test('atlas opens paused, selects a latitude and day, and keeps longitude and rotation', async ({ page }, info) => {
  await page.setViewportSize({width:1440,height:1000});
  const rotation=await page.locator('#rotation').inputValue();
  await page.locator('#play-year').click();
  await page.locator('#open-atlas').click();
  await expect(page.locator('#season-atlas')).toBeVisible();
  await expect(page.locator('#play-year')).toHaveAttribute('aria-pressed','false');
  await page.locator('[data-atlas-tilt="90"]').click();
  await page.locator('#atlas-metric').selectOption('daylight'); await ready(page);
  const p=await point(page); await page.mouse.click(p.x,p.y);
  await expect(page.locator('#atlas-day-output')).toContainText('183');
  await expect(page.locator('#atlas-latitude-output')).toHaveText('Equator');
  await expect(page.locator('#atlas-selection')).toContainText('12.0 h');
  const shot=info.outputPath('v06-daylight-atlas.png'); await page.screenshot({path:shot});
  await info.attach('90-degree day-length atlas',{path:shot,contentType:'image/png'});
  await page.locator('#atlas-focus').click();
  await expect(page.locator('#season-atlas')).not.toBeVisible();
  await expect(page.locator('#day-readout')).toHaveText('183');
  await expect(page.locator('#location-coords')).toHaveText('0.00° N · 121.57° E');
  await expect(page.locator('#rotation')).toHaveValue(rotation);
});

test('Earth-minus-Earth is neutral; thermal differences use the same model and heat storage', async ({ page }, info) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#open-atlas').click();
  await page.locator('#atlas-metric').selectOption('temperature');
  await page.locator('#atlas-view').selectOption('difference'); await ready(page);
  await expect(page.locator('#atlas-selection')).toContainText('+0.0 °C difference');
  await expect(page.locator('#atlas-scale-note')).toContainText('Sampled range: 0.0 to 0.0');
  const pixel=await page.locator('#atlas-field').evaluate(element => {
    const c=element as HTMLCanvasElement;
    return Array.from(c.getContext('2d')!.getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data);
  });
  expect(pixel).toEqual([232,234,224,255]);
  await page.locator('[data-atlas-tilt="90"]').click();
  await page.locator('#atlas-heat').selectOption('50'); await ready(page);
  await expect(page.locator('#atlas-context')).toContainText('90° tilt · Thermal EBM · 50 m');
  await expect(page.locator('#atlas-selection')).not.toContainText('+0.0 °C difference');
  const selection=await page.locator('#atlas-selection').innerText();
  const current=selection.match(/selected ([-\d.]+);/)!;
  expect(current).not.toBeNull();
  const shot=info.outputPath('v06-thermal-difference.png');await page.screenshot({path:shot});
  await info.attach('Matching-model thermal difference atlas',{path:shot,contentType:'image/png'});
  await page.locator('#atlas-close').click();
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status','ready');
  await expect(page.locator('#metric-temp')).toHaveText(`${current[1]} °C`);
  await expect(page.locator('#heat-storage')).toHaveValue('50');
});

test('native keyboard controls, exact angles and Escape retain a usable focus path', async ({ page }) => {
  await page.locator('#open-atlas').click();
  const angle=page.locator('#atlas-tilt');
  await angle.fill('41.75');await angle.press('Enter');
  await expect(page.locator('#tilt')).toHaveValue('41.75');
  await angle.fill('120');await angle.press('Enter');
  await expect(angle).toHaveValue('41.75');
  await page.locator('#atlas-day').press('End');
  await expect(page.locator('#atlas-day-output')).toContainText('365');
  await expect(page.locator('#location-name')).toHaveText('Taipei');
  await page.locator('#atlas-latitude').press('Home');
  await expect(page.locator('#atlas-latitude-output')).toHaveText('90.0° S');
  await page.keyboard.press('Escape');
  await expect(page.locator('#season-atlas')).not.toBeVisible();
  await expect(page.locator('#open-atlas')).toBeFocused();
  await expect(page.locator('#location-coords')).toHaveText('90.00° S · 121.57° E');
});

test('navigation moves the crosshair without regenerating the field; hover and drags do not seek', async ({ page }) => {
  await page.locator('#open-atlas').click();await ready(page);
  const p=await point(page);
  const revision=await page.locator('#atlas-field').getAttribute('data-field-revision');
  const date=await page.locator('#atlas-day').inputValue();
  await page.mouse.move(p.x,p.y);
  await expect(page.locator('#atlas-day')).toHaveValue(date);
  await page.mouse.down();await page.mouse.move(p.x+50,p.y+50,{steps:8});await page.mouse.move(p.x,p.y,{steps:8});await page.mouse.up();
  await expect(page.locator('#atlas-day')).toHaveValue(date);
  await page.locator('#atlas-day').press('Home');
  await page.locator('#atlas-latitude').press('End');
  await expect(page.locator('#atlas-day')).toHaveValue('1');
  await expect(page.locator('#atlas-latitude')).toHaveValue('90');
  await expect(page.locator('#atlas-field')).toHaveAttribute('data-field-revision',revision!);
  await page.locator('#atlas-trace').uncheck();
  await expect(page.locator('.atlas-trace')).toBeHidden();
  await expect(page.locator('#atlas-field')).toHaveAttribute('data-field-revision',revision!);
});

test('unavailable thermal worker leaves the astronomy atlas usable and clears temperature colors', async ({ page }) => {
  await page.addInitScript(() => {
    window.Worker=class {constructor(){throw new Error('Test: thermal worker unavailable');}} as unknown as typeof Worker;
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status','error');
  await page.locator('#open-atlas').click(); await ready(page);
  await page.locator('#atlas-metric').selectOption('temperature');
  await expect(page.locator('#atlas-plot')).toHaveAttribute('aria-busy','true');
  await expect(page.locator('#atlas-status')).toContainText('unavailable');
  await expect(page.locator('#atlas-legend')).toBeHidden();
  await expect(page.locator('#atlas-selection')).toContainText('temperature not available');
  await page.locator('#atlas-metric').selectOption('daylight'); await ready(page);
  await expect(page.locator('#atlas-selection')).toContainText('h');
  await expect(page.locator('#atlas-legend')).toBeVisible();
});

test.describe('mobile atlas', () => {
  test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
  test('large text stays readable, taps select, vertical swipes only scroll', async ({ page }, info) => {
    await page.locator('#text-size').selectOption('large');
    await page.locator('#open-atlas').click();
    const p=await point(page);await page.touchscreen.tap(p.x,p.y);
    await expect(page.locator('#atlas-day')).toHaveValue('183');
    await expect(page.locator('#atlas-latitude')).toHaveValue('0');
    const overflow=await page.locator('#season-atlas').evaluate(e=>e.scrollWidth>e.clientWidth);
    expect(overflow).toBe(false);
    const font=await page.locator('.atlas-axis').first().evaluate(e=>{
      const m=(e as SVGGraphicsElement).getScreenCTM()!;
      return parseFloat(getComputedStyle(e).fontSize)*Math.hypot(m.a,m.b);
    });
    expect(font).toBeGreaterThanOrEqual(15.9);
    const before=await page.locator('#season-atlas').evaluate(e=>e.scrollTop);
    const session=await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1}]});
    for (const distance of [12,30,60,90]) await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x,y:p.y+distance,id:1}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(()=>page.locator('#season-atlas').evaluate(e=>e.scrollTop)).toBeLessThan(before);
    await expect(page.locator('#atlas-day')).toHaveValue('183');
    await expect(page.locator('#atlas-latitude')).toHaveValue('0');
    await session.detach();
    await page.locator('#atlas-plot').scrollIntoViewIfNeeded();
    const shot=info.outputPath('v06-atlas-large-mobile.png');await page.screenshot({path:shot});
    await info.attach('Large-type mobile atlas with touch selection',{path:shot,contentType:'image/png'});
  });
});
