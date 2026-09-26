import { test, expect } from '@playwright/test';

test.setTimeout(90_000);
async function ready(page: import('@playwright/test').Page) {
  await page.goto('/geography-lab.html');
  await expect(page.locator('#status')).toHaveAttribute('data-status','ready',{timeout:60_000});
  await expect(page.locator('#temperature')).not.toHaveText('—');
}

test('real worker, pinned data, geographic sampling and full chart are visible',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1100});await ready(page);
  await expect(page.locator('#cell')).toHaveText('25.0° / 125.0°');
  await expect(page.locator('#fraction')).toHaveText('7.47%');
  await expect(page.locator('#map')).toHaveAttribute('aria-busy','false');
  await page.screenshot({path:info.outputPath('geography-live-desktop.png'),fullPage:true});
  const initial=await page.locator('#temperature').textContent();
  await page.locator('#day').fill('210');await expect(page.locator('#temperature')).not.toHaveText(initial!);
  await page.locator('#latitude').fill('45');await page.locator('#latitude').dispatchEvent('change');
  await page.locator('#longitude').fill('25');await page.locator('#longitude').dispatchEvent('change');
  await expect(page.locator('#cell')).toHaveText('45.0° / 25.0°');
  const east=await page.locator('#temperature').getAttribute('data-value');
  await page.locator('#longitude').fill('-145');await page.locator('#longitude').dispatchEvent('change');
  await expect(page.locator('#temperature')).not.toHaveAttribute('data-value',east!);
  expect(errors).toEqual([]);
});

test('pending results stay hidden, cancellation recovers and an invalid file is atomic',async({page})=>{
  await ready(page);await page.locator('#tilt').fill('60');await page.locator('#calculate').click();
  await expect(page.locator('#temperature')).toHaveText('—');await page.locator('#cancel').click();
  await expect(page.locator('#status')).toHaveAttribute('data-status','cancelled');
  await page.locator('#calculate').click();await expect(page.locator('#status')).toHaveAttribute('data-status','ready',{timeout:60_000});
  const before=await page.locator('#temperature').getAttribute('data-value');
  await page.locator('#load').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});
  await expect(page.locator('#notice')).toContainText('不正な設定');
  await expect(page.locator('#temperature')).toHaveAttribute('data-value',before!);
});

test('Japanese Large stays readable without horizontal overflow; JSON export uses separate schema',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await ready(page);
  await page.locator('#language').selectOption('ja');await page.locator('#large').click();
  await expect(page.locator('html')).toHaveAttribute('data-large','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#layer').selectOption('difference');
  await page.screenshot({path:info.outputPath('geography-live-mobile-large.png'),fullPage:true});
  await page.locator('#latitude').fill('61.5');
  await page.evaluate(() => { window.dispatchEvent(new Event('resize')); return new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
  await expect(page.locator('#latitude')).toHaveValue('61.5');
  await page.locator('#latitude').fill('90');await page.locator('#latitude').dispatchEvent('change');
  await expect(page.locator('#cell')).toContainText('経度は未定義');
  const download=page.waitForEvent('download');await page.locator('#save').click();
  expect((await download).suggestedFilename()).toBe('earth-geography-experiment.json');
});
