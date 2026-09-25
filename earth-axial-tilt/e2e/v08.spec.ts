import { expect, test } from '@playwright/test';
test.setTimeout(90_000);
async function science(page: import('@playwright/test').Page) {
  return page.locator('#tilt, #day, #rotation, #location-select, #heat-storage').evaluateAll(elements=>elements.map(e=>(e as HTMLInputElement).value));
}
test.beforeEach(async ({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status','ready');
});
test('Japanese labels, dynamic values and atlas persist, with English recoverable',async({page},info)=>{
  const before=await science(page), temp=await page.locator('#metric-temp').textContent();
  await page.locator('#language').selectOption('ja');
  await expect(page.locator('html')).toHaveAttribute('lang','ja');
  await expect(page.locator('h1')).toHaveText('地球の傾きラボ');
  await expect(page.locator('#location-name')).toHaveText('台北');
  await expect(page.locator('#profile-summary')).toContainText('年間平均');
  await expect(page.locator('#climate-status')).toContainText('計算完了');
  expect(await science(page)).toEqual(before); await expect(page.locator('#metric-temp')).toHaveText(temp!);
  await page.locator('#open-atlas').click();
  await expect(page.locator('#atlas-title')).toHaveText('季節マップ');
  await expect(page.locator('#atlas-scale-note')).toContainText('サンプルの範囲');
  await page.locator('#atlas-close').click();
  await page.reload(); await expect(page.locator('#language')).toHaveValue('ja');
  await page.screenshot({path:info.outputPath('v08-japanese-desktop.png')});
  await page.locator('#language').selectOption('en');
  await expect(page.locator('h1')).toHaveText('Earth Axial Tilt');
  await expect(page.locator('#profile-summary')).toContainText('Annual mean');
});
test('help previews on hover and opens a keyboard-dismissable Japanese explanation without altering science',async({page})=>{
  const before=await science(page); await page.locator('#language').selectOption('ja');
  const button=page.locator('[data-help-topic="tilt"]'); await button.hover();
  await expect(page.locator('#help-tooltip')).toBeVisible(); await expect(page.locator('#help-tooltip')).toContainText('公転面');
  await page.keyboard.press('Escape'); await expect(page.locator('#help-tooltip')).toBeHidden();
  await button.click(); await expect(page.locator('#context-help')).toBeVisible();
  await expect(page.locator('#help-body')).toContainText('ここに注目');
  await expect(page.locator('#help-body')).toContainText('90°');
  await page.keyboard.press('Escape'); await expect(page.locator('#context-help')).toBeHidden();
  await expect(button).toBeFocused(); expect(await science(page)).toEqual(before);
});
test('Sun-centred overview moves Earth, keeps the inertial axis and restores close-up science',async({page},info)=>{
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|THREE/.test(m.text()))errors.push(m.text());});
  const before=await science(page), temp=await page.locator('#metric-temp').textContent();
  await page.locator('#scene-view').selectOption('orbit');
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-scene-view','orbit');
  expect(await science(page)).toEqual(before); await expect(page.locator('#metric-temp')).toHaveText(temp!);
  const axis=await page.locator('#earth-canvas').getAttribute('data-axis-direction');
  const start=await page.locator('#earth-canvas').getAttribute('data-earth-position');
  const frame=await page.locator('#earth-canvas').screenshot();
  await page.locator('[data-season-day="353.75"]').click();
  await expect(page.locator('#earth-canvas')).not.toHaveAttribute('data-earth-position',start!);
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-axis-direction',axis!);
  expect(frame.equals(await page.locator('#earth-canvas').screenshot())).toBe(false);
  await page.screenshot({path:info.outputPath('v08-orbit-desktop.png')});
  await page.locator('#play-year').click();
  const running=await page.locator('#earth-canvas').getAttribute('data-earth-position');
  await expect(page.locator('#earth-canvas')).not.toHaveAttribute('data-earth-position',running!);
  await page.locator('#play-year').click();
  const same=await science(page); await page.locator('#scene-view').selectOption('earth');
  expect(await science(page)).toEqual(same);
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-earth-position','[0,0,0]');
  expect(errors).toEqual([]);
});
test('overview can focus an actual selected point and returns to close-up',async({page})=>{
  await page.locator('#scene-view').selectOption('orbit');
  await page.locator('#focus-location').click();
  await expect(page.locator('#scene-view')).toHaveValue('earth');
  await expect(page.locator('#location-name')).toHaveText('Taipei');
});
test('Japanese overview and help stay usable on a portrait screen with large text',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await page.locator('#language').selectOption('ja');
  await page.locator('#text-size').selectOption('large');
  await page.locator('#scene-view').selectOption('orbit');
  await page.locator('#fit-orbit').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('v08-orbit-mobile.png')});
  await page.locator('[data-help-topic="view"]').first().click();
  await expect(page.locator('#help-body')).toContainText('実寸比');
  const close=await page.locator('#help-close').boundingBox();
  expect(close).not.toBeNull(); expect(close!.x+close!.width).toBeLessThanOrEqual(390);
  await page.locator('#help-close').click();
  await page.locator('#scene-view').selectOption('earth');
  await expect(page.locator('#text-size')).toHaveValue('large');
});
test('Japanese calculations report worker errors without losing astronomical controls',async({page})=>{
  await page.locator('#language').selectOption('ja');
  await page.route('**/*climate.worker*',route=>route.abort()); await page.reload();
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status','error');
  await expect(page.locator('#climate-status')).toContainText('再試行');
  await page.locator('[data-mode="daylight"]').click();
  await expect(page.locator('#metric-daylight')).not.toHaveText('—');
});
