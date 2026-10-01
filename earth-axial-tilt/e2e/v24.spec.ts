import {test,expect} from '@playwright/test';
import {explorerHash,DEFAULT_EXPLORER} from '../src/planet/explorerState';
test('four-world gallery selects either side, presets remain meaningful, and exports both CSVs',async({page},info)=>{
  await page.setViewportSize({width:1366,height:768});await page.goto('/planet-explorer.html');
  await page.locator('#px-gallery-section summary').click();await expect(page.locator('#px-gallery article')).toHaveCount(4);
  await page.locator('[data-planet="mercury"] [data-choose="b"]').click();await expect(page.locator('#px-b')).toHaveValue('mercury');
  const [native]=await Promise.all([page.waitForEvent('download'),page.locator('#px-gallery-csv').click()]);expect(native.suggestedFilename()).toBe('planet-native-comparison.csv');
  await page.locator('[data-recipe="equal"]').click();const a=await page.locator('#px-world-a .px-metrics').innerText(),b=await page.locator('#px-world-b .px-metrics').innerText();expect(a).toBe(b);
  await page.locator('[data-recipe="clocks"]').click();await expect(page.locator('#px-clock')).toHaveValue('elapsed');await expect(page.locator('#px-days')).toHaveValue('365');
  await page.locator('details').last().locator('summary').click();
  const [csv]=await Promise.all([page.waitForEvent('download'),page.locator('#px-csv').click()]);expect(csv.suggestedFilename()).toBe('planet-season-comparison.csv');
  await page.locator('#px-share').click();await page.locator('[data-recipe="sideways"]').click();await expect(page.locator('#px-share-status')).toContainText('earlier settings');
  await page.locator('#px-controls summary').click();await page.screenshot({path:info.outputPath('planet-synthesis-desktop.png'),fullPage:true});
});
test('all four planet choices restore independently and settings cannot masquerade as another schema',async({page})=>{
  await page.goto('/planet-explorer.html'+explorerHash({...DEFAULT_EXPLORER,a:{id:'mercury',tilt:0},b:{id:'uranus',tilt:180},clock:'elapsed',days:100}));
  await expect(page.locator('#px-world-a h2')).toContainText('Mercury');await expect(page.locator('#px-tilt-b')).toHaveValue('180');await expect(page.locator('#px-play')).toHaveAttribute('aria-pressed','false');
  const old=await page.locator('#px-world-b .px-metrics').innerText();await page.evaluate(()=>{location.hash='explorer=999&state={}';});await expect(page.locator('#px-notice')).toContainText('Invalid');expect(await page.locator('#px-world-b .px-metrics').innerText()).toBe(old);
  await page.locator('#px-play').click();await expect(page.locator('#px-play')).toHaveAttribute('aria-pressed','true');await page.locator('#px-play').click();
  await page.reload();await expect(page.locator('#px-play')).toHaveAttribute('aria-pressed','false');
});
test('Japanese Large phone gallery scrolls inside its table without hiding the world',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/planet-explorer.html');await page.locator('#px-language').selectOption('ja');await page.locator('#px-large').check();
  await page.locator('#px-gallery-section summary').click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator('#px-gallery-section summary').click();await page.locator('#px-controls summary').click();
  await page.screenshot({path:info.outputPath('planet-synthesis-mobile-ja-large.png'),fullPage:true});
  await page.locator('#open-mercury').click();await expect(page).toHaveURL(/mercury-lab/);await expect(page.locator('#mc-play')).toHaveAttribute('aria-pressed','false');
});
