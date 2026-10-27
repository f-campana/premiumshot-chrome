// Real MV3 integration, unchanged manifest and permissions, fresh temporary profile.
// Requires Playwright plus a current Chromium with Extensions.triggerAction.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp,rm,readFile,mkdir,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';
import { resolveLayout,defaultRecipe } from '../lib/renderer.js';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const evidence=path.resolve(root,'../reports/chrome-prototype');await mkdir(evidence,{recursive:true});
const fixture=await readFile(new URL('./fixture.html',import.meta.url));
const server=http.createServer((request,response)=>{response.setHeader('Content-Type','text/html');response.end(fixture);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/`;
const profile=await mkdtemp(path.join(tmpdir(),'premiumshot-chrome-test-'));
const checks=[],errors=[];let context;
const pass=(name,details={})=>{checks.push({name,status:'pass',...details});console.log(`PASS ${name}`);};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,message,timeout=10000) {
  const start=Date.now();
  while(Date.now()-start<timeout){const value=await fn();if(value)return value;await wait(30);}
  throw new Error(message);
}

try {
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,
    args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`,'--enable-unsafe-extension-debugging','--window-size=1280,988','--force-device-scale-factor=2'],
    viewport:null,acceptDownloads:true});
  context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>{
    globalThis.testMessages=[];
    chrome.runtime.onMessage.addListener(message=>{globalThis.testMessages.push({type:message.type,mode:message.mode,tabId:message.tabId});});
    const original=chrome.tabs.captureVisibleTab.bind(chrome.tabs);
    chrome.tabs.captureVisibleTab=async(...args)=>{const image=await original(...args);globalThis.testLastCapture=image;return image;};
  });
  const id=worker.url().split('/')[2],browserCDP=await context.browser().newBrowserCDPSession();
  const source=context.pages()[0];await source.goto(url);
  const sourceViewport=await source.evaluate(()=>({width:innerWidth,height:innerHeight}));
  const versions=await browserCDP.send('Browser.getVersion');

  async function openPopup() {
    await source.bringToFront();
    // Headless Target.activateTarget can leave Chrome's tab strip on a recently
    // closed editor. Synchronize its actual active tab before the native action.
    await worker.evaluate(async url=>{
      const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url===url);
      if(tab){await chrome.tabs.update(tab.id,{active:true});await chrome.windows.update(tab.windowId,{focused:true});}
    },source.url());
    const tabs=await browserCDP.send('Target.getTargets',{filter:[{type:'tab',exclude:false}]});
    const target=tabs.targetInfos.find(t=>t.url===source.url());assert.ok(target,'Source tab target exists');
    await browserCDP.send('Extensions.triggerAction',{id,targetId:target.targetId});
    const popup=await until(async()=>{
      const targets=await browserCDP.send('Target.getTargets');
      return targets.targetInfos.find(t=>t.type==='other');
    },'Extension popup did not open');
    const {sessionId}=await browserCDP.send('Target.attachToTarget',{targetId:popup.targetId,flatten:false});
    let nextId=0;const replies=new Map();
    const listener=event=>{
      if(event.sessionId!==sessionId)return;
      const message=JSON.parse(event.message),pending=replies.get(message.id);
      if(pending){replies.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);}
    };
    browserCDP.on('Target.receivedMessageFromTarget',listener);
    async function rpc(method,params={}) {
      const n=++nextId;
      const promise=new Promise((resolve,reject)=>replies.set(n,{resolve,reject}));
      await browserCDP.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:n,method,params})});
      return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(`Popup RPC timeout: ${method}`)),2000))]);
    }
    const evaluate=async expression=>{
      const response=await rpc('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
      if(response.exceptionDetails)throw new Error(response.exceptionDetails.text);
      return response.result.value;
    };
    await rpc('Runtime.runIfWaitingForDebugger');
    await until(()=>evaluate("document.querySelectorAll('[data-mode]').length===3"),'Popup controls did not load');
    return {evaluate,rpc,targetId:popup.targetId,cleanup:()=>browserCDP.off('Target.receivedMessageFromTarget',listener)};
  }
  async function begin(mode) {
    const popup=await openPopup();
    await popup.evaluate(`document.querySelector('[data-mode="${mode}"]').click()`);
    return popup;
  }
  async function pickerReady(popup) {
    try {await source.waitForSelector('premiumshot-picker',{timeout:5000});}
    catch(error) {
      console.log('PICKER_FAILURE',await worker.evaluate(async()=>({messages:globalThis.testMessages,tabs:await chrome.tabs.query({})})));
      try{console.log('POPUP_STATUS',await popup.evaluate("document.querySelector('#popup-status').textContent"));}catch{}
      throw error;
    }
  }
  async function editorFrom(action) {
    const created=context.waitForEvent('page',{predicate:page=>page.url().includes('/editor.html')});
    await action();const editor=await created;
    await editor.waitForFunction(()=>!document.querySelector('#preview').hidden && document.querySelector('#dimensions').textContent.includes('px'));
    return editor;
  }
  async function state(editor) {
    return editor.evaluate(()=>({width:document.querySelector('#preview').width,height:document.querySelector('#preview').height,
      look:document.querySelector('input[name=look]:checked').value,shape:document.querySelector('input[name=shape]:checked').value,
      caption:document.querySelector('#dimensions').textContent,status:document.querySelector('#status').textContent}));
  }

  const cardBounds=await source.locator('#revenue').boundingBox();
  let popup;
  const visible=await editorFrom(async()=>{popup=await begin('viewport');});popup.cleanup();
  const captured=await state(visible);
  const screenshot=await worker.evaluate(()=>globalThis.testLastCapture);
  const raw=Buffer.from(screenshot.split(',')[1],'base64'),captureWidth=raw.readUInt32BE(16),captureHeight=raw.readUInt32BE(20);
  const sx=captureWidth/sourceViewport.width,sy=captureHeight/sourceViewport.height;
  const native=resolveLayout(captureWidth,captureHeight,defaultRecipe);
  assert.deepEqual([captured.width,captured.height],[native.width,native.height]);
  pass('Visible-tab capture through actual activeTab invocation at native DPR 2',{width:captured.width,height:captured.height,bitmapWidth:captureWidth,bitmapHeight:captureHeight});
  const memory=await worker.evaluate(()=>chrome.storage.session.get(null));
  assert.ok(!Object.keys(memory).some(k=>k.startsWith('capture:')));
  const stored=await worker.evaluate(async()=>{
    const {CaptureStore}=await import('./lib/capture-store.js');
    const database=await new CaptureStore().open();
    return new Promise((resolve,reject)=>{const tx=database.transaction('captures'),request=tx.objectStore('captures').count();tx.oncomplete=()=>resolve(request.result);tx.onabort=()=>reject(tx.error);});
  });
  assert.equal(stored,0);
  pass('Screenshot removed from IndexedDB after editor import; no pixels in session storage');
  await visible.screenshot({path:path.join(evidence,'editor-visible-light.png')});
  await visible.getByRole('button',{name:'Appearance',exact:true}).click();
  await visible.getByRole('radio',{name:'Dark',exact:true}).click();
  await visible.screenshot({path:path.join(evidence,'editor-visible-dark.png')});

  const start=performance.now();
  for(const look of ['tide','paper','graphite','clear','dawn']) {
    await visible.getByRole('radio',{name:look[0].toUpperCase()+look.slice(1),exact:true}).check();
    await visible.waitForFunction(expected=>document.querySelector('#preview').getAttribute('aria-label').toLowerCase().endsWith(expected),look);
  }
  pass('All five looks render in the offscreen worker',{milliseconds:Math.round(performance.now()-start)});
  await visible.getByRole('radio',{name:'1:1',exact:true}).check();
  await visible.waitForFunction(()=>document.querySelector('#preview').width===1080 && document.querySelector('#preview').height===1080);
  pass('Fixed-shape composition');
  const downloadPromise=visible.waitForEvent('download');
  await visible.getByRole('button',{name:'Download PNG'}).click();
  const download=await downloadPromise;await download.saveAs(path.join(evidence,'export-square.png'));
  const png=await readFile(path.join(evidence,'export-square.png'));
  assert.equal(png.subarray(1,4).toString(),'PNG');assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1080,1080]);
  pass('Download exports a valid PNG at the displayed dimensions');
  await visible.getByRole('button',{name:'Copy image'}).click();
  await visible.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Copied'));
  // Read access exists only in this test profile; the shipped extension requests write access.
  await context.grantPermissions(['clipboard-read'],{origin:url});
  await source.bringToFront();
  const clipboard=await source.evaluate(async()=>{
    const items=await navigator.clipboard.read();const blob=await items[0].getType('image/png');
    const image=await createImageBitmap(blob);return {width:image.width,height:image.height,type:blob.type};
  });
  assert.deepEqual(clipboard,{width:1080,height:1080,type:'image/png'});
  await context.clearPermissions();
  await visible.bringToFront();
  pass('Actual PNG clipboard write and read-back');
  await visible.getByRole('button',{name:'Reset',exact:true}).click();
  await visible.waitForFunction(()=>document.querySelector('#preview').width!==1080);
  await visible.close();

  await source.bringToFront();
  popup=await begin('element');
  await pickerReady(popup);
  const buttonBox=await source.locator('#page-button').boundingBox();
  await source.mouse.move(buttonBox.x+20,buttonBox.y+10);
  await source.keyboard.press('ArrowUp');
  const element=await editorFrom(()=>source.keyboard.press('Enter'));popup.cleanup();
  assert.equal(await source.evaluate(()=>window.pageClicks),0);
  assert.equal(await source.locator('premiumshot-picker').count(),0);
  const cardWidth=Math.round(cardBounds.width*sx),cardHeight=Math.round(cardBounds.height*sy);
  const expected=resolveLayout(cardWidth,cardHeight,defaultRecipe),elementState=await state(element);
  assert.deepEqual([elementState.width,elementState.height],[expected.width,expected.height]);
  const exact=await element.evaluate(async({baseline,layout,crop})=>{
    const image=new Image();image.src=baseline;await image.decode();
    const reference=document.createElement('canvas');reference.width=image.width;reference.height=image.height;
    reference.getContext('2d').drawImage(image,0,0);
    const original=reference.getContext('2d').getImageData(crop.x,crop.y,crop.width,crop.height).data;
    const rendered=document.querySelector('#preview').getContext('2d').getImageData(layout.window.x,layout.window.y,crop.width,crop.height).data;
    let mismatches=0;
    // Ignore corners, edge hairlines and potential focus affordances. Interior
    // pixels must match Chrome's real screenshot, including text and SVG.
    for(let y=40;y<crop.height-40;y++)for(let x=40;x<crop.width-40;x++)for(let c=0;c<4;c++)if(original[(y*crop.width+x)*4+c]!==rendered[(y*crop.width+x)*4+c])mismatches++;
    return mismatches;
  },{baseline:screenshot,layout:expected,crop:{x:Math.floor(cardBounds.x*sx),y:Math.floor(cardBounds.y*sy),width:cardWidth,height:cardHeight}});
  assert.equal(exact,0);
  pass('Parent-element selection, bitmap-scale crop and pixel-exact screenshot interior');
  await element.screenshot({path:path.join(evidence,'editor-element.png')});
  await element.setViewportSize({width:390,height:844});
  await element.screenshot({path:path.join(evidence,'editor-mobile.png'),fullPage:true});
  assert.ok(await element.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  pass('Narrow editor layout has no horizontal overflow');
  await element.close();
  const sourceCDP=await context.newCDPSession(source);await sourceCDP.send('Emulation.clearDeviceMetricsOverride');
  const {windowId}=await sourceCDP.send('Browser.getWindowForTarget');
  await browserCDP.send('Browser.setWindowBounds',{windowId,bounds:{width:1280,height:988}});
  await source.bringToFront();

  popup=await begin('area');await source.waitForSelector('premiumshot-picker');
  const area=await editorFrom(async()=>{await source.mouse.move(560,190);await source.mouse.down();await source.mouse.move(960,450,{steps:8});await source.mouse.up();});popup.cleanup();
  const areaExpected=resolveLayout(Math.round(400*sx),Math.round(260*sy),defaultRecipe),areaState=await state(area);
  assert.deepEqual([areaState.width,areaState.height],[areaExpected.width,areaExpected.height]);
  pass('Manual rectangle capture');await area.close();

  popup=await begin('element');await source.waitForSelector('premiumshot-picker');
  const tall=await source.locator('#tall').boundingBox();
  await source.mouse.move(tall.x+20,tall.y+20);await source.mouse.click(tall.x+20,tall.y+20);await wait(150);
  assert.equal(await source.locator('premiumshot-picker').count(),1);
  await source.keyboard.press('Escape');assert.equal(await source.locator('premiumshot-picker').count(),0);
  popup.cleanup();pass('Offscreen elements are rejected; Escape cancels without capture');

  popup=await begin('area');await source.waitForSelector('premiumshot-picker');
  // Toolbar's right-hand Cancel button in a closed shadow root; click its
  // actual screen position to verify it remains reachable in rectangle mode.
  const ax=await sourceCDP.send('Accessibility.getFullAXTree');
  const cancel=ax.nodes.find(n=>n.role?.value==='button' && n.name?.value==='Cancel · Esc');
  assert.ok(cancel,'Cancel button exists in the accessibility tree');
  const {model}=await sourceCDP.send('DOM.getBoxModel',{backendNodeId:cancel.backendDOMNodeId});
  await source.mouse.click((model.content[0]+model.content[4])/2,(model.content[1]+model.content[5])/2);
  await until(async()=>await source.locator('premiumshot-picker').count()===0,'Area Cancel button did not work');
  popup.cleanup();pass('Area picker Cancel button');

  popup=await begin('element');await source.waitForSelector('premiumshot-picker');
  const currentButton=await source.locator('#page-button').boundingBox();
  await source.mouse.move(currentButton.x+20,currentButton.y+10);await source.keyboard.press('ArrowUp');
  const mouseCapture=await editorFrom(()=>source.mouse.click(currentButton.x+20,currentButton.y+10));popup.cleanup();
  assert.equal(await source.evaluate(()=>window.pageClicks),0);
  const mouseState=await state(mouseCapture);
  assert.deepEqual([mouseState.width,mouseState.height],[expected.width,expected.height]);
  pass('Mouse capture preserves parent selection and suppresses webpage clicks');await mouseCapture.close();

  popup=await begin('element');await source.waitForSelector('premiumshot-picker');
  const shadowBounds=await source.locator('#shadow-card').boundingBox();
  await source.mouse.move(shadowBounds.x+5,shadowBounds.y+5);
  const shadowCapture=await editorFrom(()=>source.keyboard.press('Enter'));popup.cleanup();
  const shadowExpected=resolveLayout(Math.round(shadowBounds.width*sx),Math.round(shadowBounds.height*sy),defaultRecipe);
  const shadowState=await state(shadowCapture);
  assert.deepEqual([shadowState.width,shadowState.height],[shadowExpected.width,shadowExpected.height]);
  pass('Open shadow-root element selection');await shadowCapture.close();

  const empty=context.newPage();const editor=await empty;await editor.goto(`chrome-extension://${id}/editor.html`);
  await editor.getByRole('button',{name:'Try an example'}).click();
  await editor.waitForFunction(()=>!document.querySelector('#preview').hidden);
  const before=await state(editor);
  await editor.evaluate(()=>{
    const range=document.querySelector('#space');range.value=80;range.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('input[name=look][value=tide]').click();document.querySelector('#download').click();
  });
  const latestDownload=await editor.waitForEvent('download');await latestDownload.saveAs(path.join(evidence,'export-latest.png'));
  const latest=await readFile(path.join(evidence,'export-latest.png'));const after=await state(editor);
  assert.equal(after.look,'tide');assert.notEqual(after.width,before.width);
  assert.deepEqual([latest.readUInt32BE(16),latest.readUInt32BE(20)],[after.width,after.height]);
  pass('Immediate export waits for the latest recipe');
  await editor.getByRole('button',{name:'Remove screenshot',exact:true}).click();
  assert.ok(await editor.getByRole('button',{name:'Copy image'}).isDisabled());
  assert.equal(await editor.locator('#empty').isVisible(),true);
  await editor.reload();assert.equal(await editor.locator('#empty').isVisible(),true);
  pass('Remove releases the source; reload opens an empty editor');
  assert.deepEqual(errors,[]);
  pass('No editor JavaScript errors');
  await writeFile(path.join(evidence,'browser-results.json'),JSON.stringify({browser:versions.product,checks},null,2));
  console.log(`Evidence: ${evidence}`);
} catch(error) {
  console.error(error);
  await writeFile(path.join(evidence,'browser-results.json'),JSON.stringify({checks,failure:error.message,errors},null,2));
  process.exitCode=1;
} finally {
  await context?.close();server.close();await rm(profile,{recursive:true,force:true});
}
