import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function chromePath(env=process.env){
  const candidates=[env.EXPLAINER_HTML_CHROME,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium','/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'];
  const found=candidates.find(p=>p&&fs.existsSync(p));if(!found)throw new Error('Chromium is required for MP4. Set EXPLAINER_HTML_CHROME to its executable.');return found;
}
export async function openBrowser(file,profile,{signal,env=process.env}={}){
  const child=spawn(chromePath(env),['--headless=new','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--hide-scrollbars','--autoplay-policy=no-user-gesture-required','--force-device-scale-factor=1','--window-size=1920,1080','about:blank'],{stdio:'ignore',env});
  let socket,closed=false;const requests=new Map();let serial=0,session;
  async function close(){if(closed)return;closed=true;for(const r of requests.values()){clearTimeout(r.timer);r.reject(new Error('Browser closed'));}requests.clear();socket?.close();if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),wait(1500)]);if(child.exitCode===null)child.kill('SIGKILL');}}
  signal?.addEventListener('abort',close,{once:true});child.on('error',()=>{});
  try{
    const portFile=path.join(profile,'DevToolsActivePort');let endpoint;
    for(let i=0;i<200;i++){if(signal?.aborted)throw new Error('Export cancelled');if(child.exitCode!==null)throw new Error('Chromium exited before startup');try{const [port,ws]=fs.readFileSync(portFile,'utf8').trim().split('\n');endpoint=`ws://127.0.0.1:${port}${ws}`;break;}catch{}await wait(100);}
    if(!endpoint)throw new Error('Chromium startup timed out');
    socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Browser connection timed out')),10000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Browser connection failed'));},{once:true});});
    socket.addEventListener('message',event=>{const value=JSON.parse(event.data),r=requests.get(value.id);if(!r)return;requests.delete(value.id);clearTimeout(r.timer);value.error?r.reject(new Error(value.error.message)):r.resolve(value.result);});
    socket.addEventListener('close',()=>{for(const r of requests.values()){clearTimeout(r.timer);r.reject(new Error('Browser disconnected'));}requests.clear();});
    function send(method,params={},target=session){return new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{requests.delete(id);reject(new Error(`${method} timed out`));},30000);requests.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(target?{sessionId:target}:{})}));});}
    const {targetId}=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId,flatten:true},null)).sessionId;
    await send('Page.enable');await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'},{name:'prefers-reduced-motion',value:'no-preference'}]});
    await send('Network.enable');await send('Network.setBlockedURLs',{urls:['http://*','https://*','ws://*','wss://*']});
    await send('Page.navigate',{url:pathToFileURL(file).href});
    async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error('Page runtime failed: '+(r.exceptionDetails.exception?.description||r.exceptionDetails.text));return r.result?.value;}
    let ready=false;
    for(let i=0;i<100;i++){if(await evaluate('Boolean(window.explainerHtml)')){ready=true;break;}await wait(100);}
    if(!ready)throw new Error('HTML player failed to initialize');
    await evaluate('window.explainerHtml.ready.then(()=>window.explainerHtml.setExport(true))');
    return {close,evaluate,async frame(time){await evaluate(`window.explainerHtml.renderAt(${Number(time)})`);const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});return Buffer.from(r.data,'base64');}};
  }catch(e){await close();throw e;}
}
