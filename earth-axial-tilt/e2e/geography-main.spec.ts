import { expect, test } from '@playwright/test';
import { DEFAULT_EXPERIMENT, encodeExperiment } from '../src/experiments/state';
import { writeFile } from 'node:fs/promises';
test.setTimeout(120_000);
test.beforeEach(async ({page}) => {
  await page.addInitScript(() => {
    const metrics = { active:0, maximumActive:0, solves:[] as {tilt:number;milliseconds:number;fieldBytes:number}[] };
    (window as unknown as {geographyMetrics:typeof metrics}).geographyMetrics = metrics;
    const Native = window.Worker;
    window.Worker = class extends Native {
      private geographyWorker = false;
      private counted = false;
      private started = 0;
      private tilt = 0;
      constructor(url:string|URL,options?:WorkerOptions) {
        super(url,options); this.geographyWorker=String(url).includes('geography.worker');
        if(this.geographyWorker){this.counted=true;metrics.active++;metrics.maximumActive=Math.max(metrics.maximumActive,metrics.active);}
        this.addEventListener('message',event=>{
          if(!this.geographyWorker||event.data?.status!=='ready')return;
          const solution=event.data.solution;
          const arrays=[solution.temperatures,solution.landFraction,...Object.values(solution.grid)];
          const bytes=arrays.reduce((n:number,value)=>n+(ArrayBuffer.isView(value)?value.byteLength:0),0);
          metrics.solves.push({tilt:this.tilt,milliseconds:performance.now()-this.started,fieldBytes:bytes});
        });
      }
      postMessage(message:unknown,options:Transferable[]|StructuredSerializeOptions=[]):void {
        this.started=performance.now();this.tilt=(message as {tilt:number}).tilt;
        if(Array.isArray(options))super.postMessage(message,options);else super.postMessage(message,options);
      }
      terminate():void {if(this.counted){this.counted=false;metrics.active--;}super.terminate();}
    };
  });
});
test.afterEach(async ({page},info) => {
  if(page.isClosed())return;
  const metrics=await page.evaluate(()=> (window as unknown as {geographyMetrics:unknown}).geographyMetrics);
  const path=info.outputPath('worker-latency-and-payload-not-peak-heap.json');
  await writeFile(path,JSON.stringify({metrics,scope:'Worker postMessage→ready wall time and returned typed-array bytes, NOT peak heap or process memory.'},null,2));
  await info.attach('worker-latency-and-payload-not-peak-heap',{path,contentType:'application/json'});
});
test('real geography main globe, point, annual, comparison and longitude atlas', async ({page}, info) => {
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/shader|THREE|WebGL/i.test(m.text()))errors.push(m.text());});
  await page.goto('/'+encodeExperiment({...DEFAULT_EXPERIMENT,climateProfile:'earth-geography',surfaceMode:'temperature',latitude:45,longitude:105}));
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status','ready',{timeout:90_000});
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-temperature-layer','earth-geography');
  await expect(page.locator('#metric-temp')).toContainText('°C');
  await expect(page.locator('#location-coords')).toContainText('land 100.0%');
  await expect(page.locator('#annual-chart svg')).toBeVisible();
  await expect(page.locator('#profile-summary')).toContainText('Warmest:');
  await page.locator('#earth-canvas').screenshot({path:info.outputPath('geography-main-globe.png')});
  await page.locator('#compare-toggle').click();
  await expect(page.locator('#compare-status')).toHaveAttribute('data-status','ready',{timeout:90_000});
  await page.locator('#earth-canvas').screenshot({path:info.outputPath('geography-main-dual.png')});
  await page.locator('#open-atlas').click();
  await expect(page.locator('#season-atlas')).toBeVisible();
  await page.locator('#atlas-metric').selectOption('temperature');
  await expect(page.locator('#atlas-status')).toBeHidden();
  await expect(page.locator('#atlas-context')).toContainText('selected longitude 105.00');
  await page.locator('#season-atlas').screenshot({path:info.outputPath('geography-main-atlas.png')});
  expect(await page.evaluate(()=> (window as unknown as {geographyMetrics:{maximumActive:number}}).geographyMetrics.maximumActive)).toBe(1);
  expect(errors).toEqual([]);
});

test('same-latitude longitude switch, cancel/resume, identical A/B, and Japanese mobile', async ({page},info) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/'+encodeExperiment({...DEFAULT_EXPERIMENT,climateProfile:'earth-geography',surfaceMode:'temperature',latitude:45,longitude:105,tiltB:23.44,dual:true}));
  await expect(page.locator('#compare-status')).toHaveAttribute('data-status','ready',{timeout:90_000});
  await expect(page.locator('#compare-temperature [data-column="diff"]')).toHaveAttribute('data-value','0');
  const land = await page.locator('#metric-temp').textContent();
  await page.locator('#location-select').selectOption('geography-ocean');
  await expect(page.locator('#metric-temp')).not.toHaveText(land!);
  await expect(page.locator('#location-coords')).toContainText('land 0.0%');
  await page.locator('#language').selectOption('ja');
  await page.locator('#text-size').selectOption('large');
  await page.locator('#open-atlas').click();
  await page.locator('#atlas-metric').selectOption('temperature');
  await expect(page.locator('#atlas-context')).toContainText('選択経度-135.00');
  await page.locator('#season-atlas').screenshot({path:info.outputPath('geography-ja-mobile-atlas.png')});
  await page.locator('#atlas-close').click();
  // Location/view changes and identical A/B share the same one annual field.
  expect(await page.evaluate(()=> (window as unknown as {geographyMetrics:{solves:unknown[]}}).geographyMetrics.solves.length)).toBe(1);
  // Changing tilt starts a genuinely new solve. Cancel does not render-loop restart.
  // Commit and cancel in the same event turn, avoiding scroll/actionability
  // delay racing a fast cached/finished solve on different browser engines.
  await page.evaluate(()=>{
    const tilt=document.querySelector<HTMLInputElement>('#tilt-number')!;
    tilt.value='60';tilt.dispatchEvent(new Event('change',{bubbles:true}));
    const cancel=document.querySelector<HTMLButtonElement>('#cancel-geography')!;
    if(cancel.hidden)throw new Error('New geography calculation did not expose cancel');
    cancel.click();
  });
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status','canceled');
  await page.waitForTimeout(300);
  await expect(page.locator('#metric-temp')).not.toContainText('°C');
  await page.locator('#retry-climate').click();
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status','ready',{timeout:90_000});
  await page.locator('#focus-view').click();
  await page.locator('#earth-canvas').screenshot({path:info.outputPath('geography-ja-mobile-focus.png')});
  expect(errors).toEqual([]);
});

test('malformed worker reply fails closed, explicit retry recovers, and old schema rejects atomically', async ({page}) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    const Native=window.Worker;let failed=false;
    window.Worker=class extends Native {
      private geographyWorker:boolean;
      constructor(url:string|URL,options?:WorkerOptions){super(url,options);this.geographyWorker=String(url).includes('geography.worker');}
      postMessage(message:unknown,options:Transferable[]|StructuredSerializeOptions=[]):void {
        if(this.geographyWorker&&!failed){failed=true;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:null})));}
        else if(Array.isArray(options))super.postMessage(message,options);else super.postMessage(message,options);
      }
    };
  });
  await page.goto('/'+encodeExperiment({...DEFAULT_EXPERIMENT,climateProfile:'earth-geography',surfaceMode:'temperature'}));
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status','error');
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-temperature-layer','pending');
  await expect(page.locator('#metric-temp')).not.toContainText('°C');
  await page.locator('#retry-climate').click();
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status','ready',{timeout:90_000});
  const temperature=await page.locator('#metric-temp').textContent();
  await page.evaluate(()=>{location.hash='#lab=3&geo=earth-geography&a=60';});
  await expect(page.locator('#experiment-notice')).toHaveAttribute('data-status','error');
  await expect(page.locator('#tilt-number')).toHaveValue('23.44');
  await expect(page.locator('#metric-temp')).toHaveText(temperature!);
  expect(errors).toEqual([]);
});

test('extreme forcing, polar cap sector and orbit rendering stay finite', async ({page},info) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/'+encodeExperiment({...DEFAULT_EXPERIMENT,climateProfile:'earth-geography',surfaceMode:'temperature',tilt:90,eccentricity:.3,perihelion:90,latitude:90,longitude:180,sceneView:'orbit'}));
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status','ready',{timeout:90_000});
  await expect(page.locator('#metric-temp')).toContainText('°C');
  await expect(page.locator('#metric-temp')).not.toContainText('NaN');
  await expect(page.locator('#climate-warning')).toBeVisible();
  await page.locator('#earth-canvas').screenshot({path:info.outputPath('geography-extreme-polar-orbit.png')});
  expect(errors).toEqual([]);
});


test('reference-only failure is visible and retries without losing the accepted A field', async ({page}) => {
  await page.addInitScript(() => {
    const Native = window.Worker; let failed = false;
    window.Worker = class extends Native {
      private geo: boolean;
      constructor(url:string|URL, options?:WorkerOptions) { super(url,options); this.geo=String(url).includes('geography.worker'); }
      postMessage(message:unknown, options:Transferable[]|StructuredSerializeOptions=[]):void {
        if (this.geo && !failed && (message as {tilt:number}).tilt===23.44) {
          failed=true; queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:null})));
        } else if(Array.isArray(options)) super.postMessage(message,options); else super.postMessage(message,options);
      }
    };
  });
  await page.goto('/'+encodeExperiment({...DEFAULT_EXPERIMENT,climateProfile:'earth-geography',tilt:60,reference:true,surfaceMode:'temperature'}));
  await expect(page.locator('#climate-reference-status')).toBeVisible({timeout:90_000});
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status','ready');
  await expect(page.locator('#metric-temp')).toContainText('°C');
  await expect(page.locator('#chart-title')).toHaveText('Temperature unavailable');
  await expect(page.locator('#retry-climate')).toBeVisible();
  await page.locator('#open-atlas').click();
  await page.locator('#atlas-metric').selectOption('temperature');
  await page.locator('#atlas-view').selectOption('difference');
  await expect(page.locator('#atlas-status')).toContainText('Temperature unavailable');
  await page.locator('#atlas-close').click();
  await page.locator('#retry-climate').click();
  await expect(page.locator('#annual-chart svg')).toBeVisible({timeout:90_000});
  await expect(page.locator('#climate-reference-status')).toBeHidden();
  const metrics=await page.evaluate(()=>(window as unknown as {geographyMetrics:{solves:{tilt:number}[]}}).geographyMetrics);
  expect(metrics.solves.filter(s=>s.tilt===60)).toHaveLength(1);
  expect(metrics.solves.filter(s=>s.tilt===23.44)).toHaveLength(1);
});
