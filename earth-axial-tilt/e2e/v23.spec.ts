import {test,expect} from '@playwright/test';
import {mercuryHash,DEFAULT_MERCURY} from '../src/planet/mercury';
test('Mercury is coupled, reverses only near perihelion, and closes after two orbits',async({page},info)=>{
  await page.goto('/mercury-lab.html');await expect(page.locator('#mc-direction')).toHaveAttribute('data-reversing','true');
  await page.locator('[data-cycle="0.5"]').click();await expect(page.locator('#mc-direction')).toHaveAttribute('data-reversing','false');
  await page.locator('[data-cycle="2"]').click();await expect(page.locator('#mc-canvas')).toHaveAttribute('data-turns','3');
  await page.locator('#mc-circle').click();await expect(page.locator('#mc-direction')).toHaveAttribute('data-reversing','false');
  await page.locator('#mc-horizon').click();await expect(page.locator('#mc-motion')).toHaveAttribute('data-window','perihelion');await page.locator('[data-cycle="1"]').click();await expect(page.locator('#mc-direction')).toHaveAttribute('data-reversing','true');
  await page.screenshot({path:info.outputPath('mercury-resonance-desktop.png'),fullPage:true});
});
test('Mercury state, invalid drafts, paused restore and CSV are truthful',async({page})=>{
  await page.goto('/mercury-lab.html'+mercuryHash({...DEFAULT_MERCURY,longitude:90,cycles:1}));
  await expect(page.locator('#mc-play')).toHaveAttribute('aria-pressed','false');
  const before=await page.locator('#mc-metrics').textContent();await page.locator('#mc-latitude').fill('100');await page.locator('#mc-latitude').press('Tab');
  await expect(page.locator('#mc-error')).toContainText('Invalid');expect(await page.locator('#mc-metrics').textContent()).toBe(before);
  await page.locator('#mc-latitude').fill('0');await page.locator('#mc-latitude').press('Tab');
  await page.locator('summary').click();await page.locator('#mc-share').click();await expect(page.locator('#mc-url')).toHaveValue(/mercury=1/);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#mc-csv').click()]);expect(download.suggestedFilename()).toBe('mercury-two-orbits.csv');
  await page.evaluate(()=>{location.hash='mercury=2&state={}';});await expect(page.locator('#mc-error')).toContainText('Invalid');
});
test('Mercury Japanese Large phone works with blocked storage and no overflow',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
  await page.goto('/mercury-lab.html');await page.locator('#mc-language').selectOption('ja');await page.locator('#mc-large').check();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator('#mc-play').click();await expect(page.locator('#mc-play')).toHaveAttribute('aria-pressed','true');await page.locator('#mc-play').click();
  await expect(page.locator('#mc-play')).toHaveAttribute('aria-pressed','false');expect(Number(await page.locator('#mc-cycles').inputValue())).toBe(Number(await page.locator('#mc-canvas').getAttribute('data-cycles')));await page.screenshot({path:info.outputPath('mercury-mobile-ja-large.png'),fullPage:true});
});
