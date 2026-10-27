import { CaptureStore,CAPTURE_DATABASE,MAX_CAPTURE_AGE,pngDataURLToBlob } from '../lib/capture-store.js';
import { cropBounds } from '../lib/capture.js';
import { defaultRecipe } from '../lib/renderer.js';

const status=document.querySelector('#status'),results=document.querySelector('#results'),checks=document.querySelector('#checks');
function assert(value,message){if(!value)throw new Error(message);}
function pass(name,detail={}){const item=document.createElement('li');item.textContent=`PASS · ${name}`;checks.append(item);return {name,...detail};}
const record=(change={})=>({id:crypto.randomUUID(),sessionId:'native-session',createdAt:Date.now(),sourceTabId:10,image:new Blob(['PNG bytes'],{type:'image/png'}),...change});
async function stored(store){const db=await store.open();return new Promise((resolve,reject)=>{const tx=db.transaction('captures'),request=tx.objectStore('captures').getAll();tx.oncomplete=()=>resolve(request.result);tx.onabort=()=>reject(tx.error);});}
async function digest(blob){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()));return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');}
async function cleanup(store){(await store.open()).close();await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(store.name);request.onsuccess=resolve;request.onerror=()=>reject(request.error);});}

async function run(work){
  for(const button of document.querySelectorAll('button'))button.disabled=true;
  status.textContent='Running…';checks.replaceChildren();results.textContent='';
  const store=new CaptureStore(indexedDB,`${CAPTURE_DATABASE}-qa-${crypto.randomUUID()}`);
  try{const report=await work(store);assert((await stored(store)).length===0,'A pending record was left behind.');await cleanup(store);report.pendingRecords=0;report.testDatabaseDeleted=true;results.textContent=JSON.stringify(report,null,2);status.textContent='PASS · All checks finished; no pending records or test database.';}
  catch(error){await cleanup(store).catch(()=>{});status.textContent=`FAIL · ${error.message}`;status.className='fail';results.textContent=error.stack;}
  finally{for(const button of document.querySelectorAll('button'))button.disabled=false;}
}

document.querySelector('#run').addEventListener('click',()=>run(async store=>{
  const report={environment:'Native Chrome IndexedDB over HTTP; no MV3 integration',checks:[]};
  const a=record();await store.put(a);
  const second=new CaptureStore(indexedDB,store.name),race=await Promise.all([store.take(a.id,a.sessionId),second.take(a.id,a.sessionId)]);
  assert(race.filter(Boolean).length===1,'Both editors consumed the capture.');
  assert((await stored(store)).length===0,'The consumed record remains.');(await second.open()).close();
  report.checks.push(pass('Atomic read-and-delete with two connections'));
  const b=record();await store.put(b);assert(await store.take(b.id,b.sessionId,b.createdAt+MAX_CAPTURE_AGE)===null,'Expired capture opened.');
  report.checks.push(pass('Expiry rejects and deletes the record'));
  const c=record();await store.put(c);assert(await store.take(c.id,'another-session')===null,'A previous-session capture opened.');
  report.checks.push(pass('Browser-session change rejects and deletes the record'));
  const now=Date.now(),d=record({createdAt:now}),old=record({createdAt:now-MAX_CAPTURE_AGE}),previous=record({sessionId:'previous'});
  await store.transaction(objectStore=>{for(const item of [d,old,previous])objectStore.put(item);});await store.prune(d.sessionId,now);
  assert((await stored(store)).length===1,'Pruning removed a fresh capture or retained a stale capture.');await store.remove(d.id);
  report.checks.push(pass('Cleanup preserves only fresh records in this session'));
  const e=record(),f=record({sourceTabId:11});await store.put(e);await store.put(f);await store.removeForTab(10);
  assert((await stored(store)).length===1&&(await stored(store))[0].id===f.id,'Source-tab cleanup crossed tab boundaries.');await store.remove(f.id);
  report.checks.push(pass('Source-tab cleanup and explicit cancellation leave no record'));
  try{await store.transaction(objectStore=>{objectStore.put(record());throw new Error('Injected failure');});throw new Error('Write falsely succeeded.');}catch(error){assert(error.message==='Injected failure',error.message);}
  assert((await stored(store)).length===0,'Aborted transaction left a record.');report.checks.push(pass('Aborted write leaves no record'));
  return report;
}));

document.querySelector('#large').addEventListener('click',()=>run(async store=>{
  const width=10240,height=5760,canvas=new OffscreenCanvas(width,height),context=canvas.getContext('2d');
  context.fillStyle='#e9e8e2';context.fillRect(0,0,width,height);
  // A deterministic noisy patch makes a valid PNG larger than the old 8 MB
  // handoff limit without allocating noise for all 59 million pixels.
  const noise=context.createImageData(2048,1536);let seed=0x13579bdf;
  for(let i=0;i<noise.data.length;i+=4){for(let c=0;c<3;c++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;noise.data[i+c]=seed&255;}noise.data[i+3]=255;}
  context.putImageData(noise,0,0);
  const original=await canvas.convertToBlob({type:'image/png'});
  assert(original.size>8*1024*1024,'Fixture did not exceed the former limit.');
  const dataURL=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(original);});
  const capture=record({image:pngDataURLToBlob(dataURL)});await store.put(capture);
  const recovered=await store.take(capture.id,capture.sessionId);
  const sha256=await digest(original);assert(await digest(recovered.image)===sha256,'Handoff changed PNG bytes.');
  pass('5K at 2× PNG exceeds 8 MB and survives the Blob handoff unchanged');
  const image=await createImageBitmap(recovered.image);assert(image.width===width&&image.height===height,'Decoded dimensions changed.');
  const crop=cropBounds({x:100,y:100,width:800,height:500},{width:5120,height:2880},width,height);
  assert(JSON.stringify(crop)===JSON.stringify({x:200,y:200,width:1600,height:1000}),'The 2× selection crop is wrong.');pass('5K viewport selection maps to 2× bitmap pixels');
  const worker=new Worker(new URL('../render-worker.js',import.meta.url),{type:'module'}),session='large-fixture';
  try{
    const rendered=new Promise((resolve,reject)=>{worker.onmessage=({data})=>data.type==='error'?reject(new Error(data.error)):resolve(data);worker.onerror=()=>reject(new Error('Renderer failed.'));});
    worker.postMessage({type:'source',session,image},[image]);worker.postMessage({type:'render',session,revision:1,recipe:defaultRecipe});
    const output=await rendered;output.image.close();
    assert(output.layout.capped&&output.layout.width===4096&&output.layout.height<=4096,'Large render did not obey the export cap.');
    const png=await createImageBitmap(output.blob);assert(png.width===output.layout.width&&png.height===output.layout.height,'Export PNG dimensions differ.');png.close();
    pass('Production renderer exports the large source as a valid capped PNG');
    return {environment:'Native Chrome component pipeline; synthetic image, no captureVisibleTab call',cssViewport:{width:5120,height:2880},bitmap:{width,height,megapixels:width*height/1000000},pngBytes:original.size,base64Characters:dataURL.length,sha256,selectionCrop:crop,export:{width:output.layout.width,height:output.layout.height,capped:output.layout.capped,bytes:output.blob.size}};
  }finally{worker.terminate();}
}));
