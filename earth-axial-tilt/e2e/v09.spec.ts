import {test,expect,type Page} from '@playwright/test';
test.setTimeout(90_000);
const errors = new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{
  const list:string[]=[];errors.set(page,list);
  page.on('pageerror',error=>list.push(error.message));
  page.on('console',message=>{ if(message.type()==='error' && /THREE|WebGL|shader/i.test(message.text()))list.push(message.text()); });
});
test.afterEach(({page})=>{ expect(errors.get(page)).toEqual([]); });
async function ready(page:Page){
  await page.goto('/');
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status','ready');
  await expect(page.locator('#visual-status')).toHaveAttribute('data-status','ready');
}
async function compare(page:Page){await page.locator('#compare-toggle').click();await expect(page.locator('#compare-status')).toHaveAttribute('data-status','ready');}
const readView=(page:Page,side:'A'|'B')=>page.locator('#earth-canvas').evaluate((el,s)=>JSON.parse((el as HTMLElement).dataset[`view${s}`]!),side);
async function angle(page:Page,id:string,value:string){await page.locator(id).fill(value);await page.locator(id).press('Enter');}

test('independent tilts share time/location and equal worlds have zero difference and matching pixels',async({page},info)=>{
 await page.setViewportSize({width:1440,height:1000});await ready(page);await compare(page);
 await angle(page,'#compare-tilt-b','23.44');
 await expect(page.locator('#compare-temperature [data-column="diff"]')).toHaveAttribute('data-value','0');
 for(const key of ['daylight','solar'])await expect(page.locator(`#compare-${key} [data-column="diff"]`)).toHaveAttribute('data-value','0');
 await expect.poll(async()=>[ (await readView(page,'A')).tilt,(await readView(page,'B')).tilt]).toEqual([23.44,23.44]);
 const canvas=await page.locator('#earth-canvas').evaluate((el:HTMLCanvasElement)=>{const r=el.getBoundingClientRect();return {x:r.x+el.clientLeft,y:r.y+el.clientTop,width:el.clientWidth,height:el.clientHeight};});
 // Actual WebGL pixels, excluding the overlaid A/B badges. Same camera, equal state.
 const left=await page.screenshot({clip:{x:canvas.x+100,y:canvas.y+60,width:500,height:440}});
 const right=await page.screenshot({clip:{x:canvas.x+canvas.width/2+100,y:canvas.y+60,width:500,height:440}});
 await info.attach('equal-world-A',{body:left,contentType:'image/png'});
 await info.attach('equal-world-B',{body:right,contentType:'image/png'});
 expect(left.equals(right)).toBe(true);
 await angle(page,'#compare-tilt-b','90');
 await expect(page.locator('#compare-status')).toHaveAttribute('data-status','ready');
 await expect(page.locator('#compare-tilt-a')).toHaveValue('23.44');
 expect(Number(await page.locator('#compare-solar [data-column="diff"]').getAttribute('data-value'))).not.toBe(0);
 await expect(page.locator('.chart-reference')).toBeVisible();
 await page.screenshot({path:info.outputPath('v09-comparison-desktop.png'),fullPage:true});
 await page.locator('#compare-exit').click();await expect(page.locator('#earth-canvas')).toHaveAttribute('data-comparison','false');
 await expect(page.locator('#tilt')).toHaveValue('23.44');
});

test('coupled playback advances one shared model clock in both actual render passes',async({page})=>{
 await ready(page);await compare(page);const before=await readView(page,'A');
 await page.locator('#compare-play-coupled').click();
 await expect.poll(async()=>(await readView(page,'A')).day).toBeGreaterThan(before.day+.03);
 await page.locator('#compare-play-coupled').click();
 const a=await readView(page,'A'),b=await readView(page,'B');
 expect(a.day).toBe(b.day);expect(a.rotation).toBe(b.rotation);
 expect(a.rotation).not.toBe(before.rotation);
 await expect(page.locator('#play-day')).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('#play-year')).toHaveAttribute('aria-pressed','false');
});

test('dual orbit has separate scenes with coincident orbital phase and independent fixed axes',async({page},info)=>{
 await ready(page);await compare(page);await page.locator('#scene-view').selectOption('orbit');
 const beforeA=await readView(page,'A'),beforeB=await readView(page,'B');
 await page.locator('[data-season-day="353.75"]').click();
 await expect.poll(async()=>(await readView(page,'A')).day).toBe(353.75);
 const a=await readView(page,'A'),b=await readView(page,'B');
 expect(a.position).toEqual(b.position);expect(a.position).not.toEqual(beforeA.position);
 a.axis.forEach((n:number,i:number)=>expect(n).toBeCloseTo(beforeA.axis[i],8));
 b.axis.forEach((n:number,i:number)=>expect(n).toBeCloseTo(beforeB.axis[i],8));
 expect(a.axis).not.toEqual(b.axis);
 await page.locator('#language').selectOption('ja');
 await page.screenshot({path:info.outputPath('v09-dual-orbit-ja.png'),fullPage:true});
});

test('Japanese large mobile comparison stacks worlds without shrinking controls or overflowing',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await ready(page);
 await page.locator('#language').selectOption('ja');await page.locator('#text-size').selectOption('large');await compare(page);
 const a=await readView(page,'A'),b=await readView(page,'B');
 const gap=await page.evaluate(()=>{const c=document.getElementById('earth-canvas')!.getBoundingClientRect();const p=document.getElementById('compare-controls')!.getBoundingClientRect();return c.top-p.bottom;});
 expect(gap).toBeLessThan(40);
 expect(a.viewport.x).toBe(b.viewport.x);expect(b.viewport.y).toBe(a.viewport.height);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('#compare-tilt-b')).toHaveCSS('font-size','16px');
 await page.screenshot({path:info.outputPath('v09-mobile-ja.png'),fullPage:true});
 await page.locator('#compare-exit').click();await expect(page.locator('#language')).toHaveValue('ja');
});

test('B worker failure reports missing temperature but retains geometric differences and retry',async({page})=>{
 await ready(page);
 await page.route('**/*climate.worker*',route=>route.abort());
 await page.locator('#compare-toggle').click();
 await expect(page.locator('#compare-status')).toHaveAttribute('data-status','error');
 await expect(page.locator('#compare-temperature [data-column="b"]')).toHaveAttribute('data-value','pending');
 await expect(page.locator('#compare-temperature [data-column="diff"]')).toHaveText('—');
 expect(await page.locator('#compare-solar [data-column="diff"]').getAttribute('data-value')).not.toBe('pending');
 await page.unroute('**/*climate.worker*');await page.locator('#compare-retry').click();
 await expect(page.locator('#compare-status')).toHaveAttribute('data-status','ready');
});

test('reopening comparison retains one canvas and an idle view does not redraw forever',async({page})=>{
 await ready(page);
 for(let i=0;i<3;i++){await compare(page);await page.locator('#compare-exit').click();}
 await compare(page);await expect(page.locator('#earth-canvas')).toHaveCount(1);
 await page.waitForTimeout(400);const count=await page.locator('#earth-canvas').getAttribute('data-render-count');
 await page.waitForTimeout(400);expect(await page.locator('#earth-canvas').getAttribute('data-render-count')).toBe(count);
});


test('picking the B viewport uses its own projection and retains the shared location',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await ready(page);
 await page.locator('#location-select').selectOption('singapore');await compare(page);await angle(page,'#compare-tilt-b','23.44');
 await page.locator('#focus-location').click();
 const point=await page.locator('#earth-canvas').evaluate((el:HTMLCanvasElement)=>{
   const r=el.getBoundingClientRect(),b=JSON.parse(el.dataset.viewB!).viewport;
   return {x:r.left+el.clientLeft+b.x+b.width/2,y:r.top+el.clientTop+b.y+b.height/2};
 });
 await page.mouse.click(point.x,point.y);await expect(page.locator('#location-name')).toHaveText('Custom point');
 await expect(page.locator('#location-coords')).toHaveText('1.35° N · 103.82° E');
});
