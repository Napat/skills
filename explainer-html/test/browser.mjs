import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { chromium, webkit } from 'playwright';
import { ROOT, run } from '../src/util.mjs';

const dir=process.env.EXPLAINER_HTML_TEST_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'explainer-html-browser-'));fs.mkdirSync(dir,{recursive:true});
const env={...process.env,EXPLAINER_HTML_CACHE_DIR:path.join(dir,'cache')},files={};
for(const name of ['architecture','sequence','components','thai-video','cache-hit']){
  const out=await run(process.execPath,[path.join(ROOT,'scripts/render.mjs'),'render',path.join(ROOT,'examples',name+'.md'),'--voice','off','--json'],{env});files[name]=JSON.parse(out.stdout).html;
}
const morphSpec='---\ntitle: Continuity\nvideo: on\nvoice: off\n---\n'+['LR','TB'].map((direction,i)=>`## Scene ${i+1}\n\n\`\`\`architecture\ndirection: ${direction}\nnodes: {a: {label: Client}, b: {label: API}, c: {label: Store, kind: database}}\nedges: [{id: ab, from: a, to: b}, {id: bc, from: b, to: c}]\n\`\`\`\n\`\`\`beats\n- {narration: Follow the same objects., focus: [b], duration: 2}\n\`\`\`\n`).join('');
fs.writeFileSync(path.join(dir,'morph.md'),morphSpec);files.morph=JSON.parse((await run(process.execPath,[path.join(ROOT,'scripts/render.mjs'),'render',path.join(dir,'morph.md'),'--json'],{env})).stdout).html;
const results=[],screens=[];
for(const [name,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch(name==='chromium'?{executablePath:process.env.EXPLAINER_HTML_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}:{headless:true});
  try{
    for(const width of [390,768,1440]){
      // WebKit 26.6's offline flag rejects even a minimal local file on macOS.
      // Block every network request instead; the reopened document still has no network.
      const context=await browser.newContext({viewport:{width,height:1000},offline:name==='chromium',colorScheme:'light',reducedMotion:'no-preference'});
      await context.route(/^(https?|wss?):\/\//,route=>route.abort());
      const page=await context.newPage(),errors=[],requests=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
      for(const [fixture,file]of Object.entries(files)){
        await page.goto(pathToFileURL(file).href);await page.evaluate(()=>window.explainerHtml.ready);
        assert.deepEqual(errors,[],`${name} ${fixture}: runtime errors`);assert.equal(requests.length,0,'Offline document requested network');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} ${width} ${fixture} page overflow`);
        const base=await page.locator('#stage').boundingBox();
        for(const theme of ['shadcn','blueprint'])for(const mode of ['light','dark']){
          await page.selectOption('#theme',theme);await page.selectOption('#mode',mode);assert.equal(await page.getAttribute('html','data-color'),mode);
          const rect=await page.locator('#stage').boundingBox();assert.ok(Math.abs(rect.height-base.height)<1&&Math.abs(rect.width-base.width)<1,`${name} ${width} ${fixture} ${theme}/${mode}: theme changed geometry ${JSON.stringify({base,rect})}`);
        }
        await page.selectOption('#mode','auto');await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.color==='dark');await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.color==='light');
        await page.selectOption('#theme',fixture==='sequence'?'blueprint':'shadcn');await page.selectOption('#mode','light');
        if(fixture==='components'){
          const button=page.locator('[data-note]').first();await button.focus();await page.keyboard.press('Enter');assert.equal(await button.getAttribute('aria-expanded'),'true');assert.ok(await page.locator('#'+await button.getAttribute('aria-controls')).isVisible());
        }
        if(fixture==='architecture'){
          const scroll=page.locator('.diagram-scroll').first();const before=await scroll.evaluate(n=>n.scrollWidth);await page.locator('[data-zoom=in]').first().click();assert.ok((await scroll.evaluate(n=>n.scrollWidth))>before);await page.locator('[data-zoom=fit]').first().click();assert.ok((await scroll.evaluate(n=>n.scrollWidth-n.clientWidth))<2);
          await page.locator('[data-zoom=reset]').first().click();
        }
        if(fixture==='cache-hit'){
          await page.locator('[data-zoom=fit]').first().click();
          assert.ok(await page.evaluate(()=>{
            const figure=document.querySelector('.diagram'),frame=figure.querySelector('.diagram-scroll').getBoundingClientRect();
            return ['client','api','redis','db'].every(id=>{const b=figure.querySelector(`[data-node-id="${id}"]`).getBoundingClientRect();return b.left>=frame.left-1&&b.right<=frame.right+1&&b.top>=frame.top-1&&b.bottom<=frame.bottom+1;});
          }),'Cache-hit overview cropped a component');
        }
        if(fixture==='thai-video'){
          await page.evaluate(()=>window.explainerHtml.seek(window.explainerHtml.data.timeline.scenes[1].beats[0].start+.7));assert.equal((await page.evaluate(()=>window.explainerHtml.state())).scene,'scene-2');
          assert.ok(await page.evaluate(()=>{const scene=document.querySelector('#scene-2'),frame=scene.querySelector('.diagram-scroll').getBoundingClientRect();return ['api','cache','database'].every(id=>{const b=scene.querySelector(`[data-node-id="${id}"]`).getBoundingClientRect();return b.left>=frame.left-1&&b.right<=frame.right+1&&b.top>=frame.top-1&&b.bottom<=frame.bottom+1;});}),'Camera cropped a focused node');
          const view=await page.locator('#scene-2 svg').getAttribute('viewBox');await page.locator('#scene-2 [data-zoom=in]').click();assert.notEqual(await page.locator('#scene-2 svg').getAttribute('viewBox'),view);await page.locator('#scene-2 .diagram-scroll').focus();await page.keyboard.press('ArrowRight');assert.equal((await page.evaluate(()=>window.explainerHtml.state())).playing,false);await page.locator('#scene-2 [data-zoom=reset]').click();assert.equal(await page.locator('#scene-2 svg').getAttribute('viewBox'),view);await page.locator('#scene-2 [data-node-id=api]').focus();await page.keyboard.press('Space');assert.equal((await page.evaluate(()=>window.explainerHtml.state())).playing,false);
          await page.locator('#view-toggle').click();assert.equal(await page.locator('.scene:visible').count(),2);await page.locator('#view-toggle').click();
          await page.locator('#play').click();await page.waitForTimeout(200);await page.locator('#play').click();assert.equal((await page.evaluate(()=>window.explainerHtml.state())).playing,false);
        }
        if(fixture==='morph'){
          const positions=await page.evaluate(()=>{const api=window.explainerHtml,start=api.data.timeline.scenes[1].start,n=document.querySelector('#scene-2 [data-node-id=b]'),read=t=>{api.renderAt(t);return {transform:n.getAttribute('transform'),path:document.querySelector('#scene-2 path[data-composition-edge-id=ab]').getAttribute('d')};};return [read(start),read(start+.3),read(start+.6),read(start+.3)];});
          assert.ok(positions[0].transform&&positions[1].transform,'Shared nodes did not animate');assert.notEqual(positions[0].transform,positions[1].transform);assert.equal(positions[2].transform,null);assert.deepEqual(positions[1],positions[3],'Seeking is not deterministic');assert.notEqual(positions[0].path,positions[1].path,'Edges did not follow objects');
          await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);assert.equal(await page.evaluate(()=>{const a=window.explainerHtml;a.renderAt(a.data.timeline.scenes[1].start+.1);return document.querySelector('#scene-2 [data-node-id=b]').getAttribute('transform');}),null);await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>!matchMedia('(prefers-reduced-motion: reduce)').matches);
        }
        if(fixture!=='morph'){
          const screenshot=path.join(dir,`${name}-${fixture}-${width}.png`);await page.screenshot({path:screenshot,fullPage:true});screens.push(screenshot);
          if(width===1440){await page.selectOption('#mode','dark');await page.screenshot({path:path.join(dir,`${name}-${fixture}-${width}-dark.png`),fullPage:true});}
        }
        results.push({browser:name,width,fixture,offline:true,networkIsolation:name==='chromium'?'offline flag + blocked requests':'all network requests blocked (WebKit local-file offline flag defect)',themeGeometry:'passed',runtime:'passed'});
      }
      await context.close();
    }
  }finally{await browser.close();}
}
const report={results,screens,files,visualReview:'Screenshots generated; inspect before claiming visual acceptance.'};fs.writeFileSync(path.join(dir,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({dir,cases:results.length,report:path.join(dir,'browser-report.json')}));
