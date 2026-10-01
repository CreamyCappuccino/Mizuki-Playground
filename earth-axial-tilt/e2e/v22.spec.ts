import { test,expect } from '@playwright/test';
import { DEFAULT_EXPLORER,explorerHash } from '../src/planet/explorerState';
test('Uranus and Earth90 render from one geometry with exact polar day/night',async({page},info)=>{
  await page.goto('/planet-explorer.html');
  await page.locator('[data-recipe="sideways"]').click();
  await expect(page.locator('#px-tilt-a')).toHaveValue('90');
  await expect(page.locator('#px-world-b [data-metric="tilt"]')).toContainText('97.77');
  await expect(page.locator('#px-world-b [data-metric="fraction"]')).toContainText('100%');
  expect(Number(await page.locator('#px-canvas-b').getAttribute('data-pole-z'))).toBeLessThan(0);
  await page.locator('[data-ls="270"]').click();
  await expect(page.locator('#px-world-b [data-metric="fraction"]')).toContainText('0%');
  await page.locator('#px-world-a').scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('uranus-earth90.png')});
});
test('clocks, native controls, invalid drafts and hash restore preserve accepted worlds',async({page})=>{
  await page.goto('/planet-explorer.html');
  await page.locator('#px-clock').selectOption('elapsed');await page.locator('#px-days').fill('365');await page.locator('#px-days').press('Tab');
  const accepted=await page.locator('#px-world-b .px-metrics').innerText();
  await page.locator('#px-latitude').fill('91');await page.locator('#px-latitude').press('Tab');
  await expect(page.locator('#px-notice')).toContainText('Invalid');
  expect(await page.locator('#px-world-b .px-metrics').innerText()).toBe(accepted);
  await page.evaluate(hash=>{location.hash=hash;},explorerHash({...DEFAULT_EXPLORER,a:{id:'mars',tilt:null},b:{id:'earth',tilt:null}}));
  await expect(page.locator('#px-a')).toHaveValue('mars');await expect(page.locator('#px-play')).toHaveAttribute('aria-pressed','false');
});
test('Japanese Large narrow layout and blocked storage still work',async({page},info)=>{
  await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
  await page.setViewportSize({width:390,height:844});await page.goto('/planet-explorer.html');
  await page.locator('#px-language').selectOption('ja');await page.locator('#px-large').check();
  await page.locator('#px-controls summary').click();await expect(page.locator('#px-a')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator('#px-world-a').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('uranus-mobile-ja.png')});
});
