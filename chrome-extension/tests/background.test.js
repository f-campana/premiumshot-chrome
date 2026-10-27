import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { CaptureStore,CAPTURE_SESSION_KEY,CAPTURE_DATABASE,MAX_CAPTURE_AGE } from '../lib/capture-store.js';

// Test Chrome API failures and worker lifecycle independently of real MV3
// acceptance. The repository uses fake-indexeddb here; native Chrome is checked
// separately by capture-store.html.
async function worker({data={},factory=new IDBFactory(),failCreate=false,changeAfterCapture=false}={}) {
  const events={message:[],removed:[],startup:[],installed:[]};
  const event=name=>({addListener:callback=>events[name].push(callback)});
  const tab={id:10,windowId:1,url:'https://example.test/dashboard'};
  const viewport={width:1000,height:600,scrollX:0,scrollY:0,scale:1,offsetX:0,offsetY:0};
  let active=tab.id,calls=0;
  const created=[];
  globalThis.indexedDB=factory;
  globalThis.chrome={runtime:{id:'test',getURL:path=>`chrome-extension://test/${path}`,onMessage:event('message'),onStartup:event('startup'),onInstalled:event('installed')},
    storage:{session:{async get(key){return key===null?{...data}:Object.fromEntries([].concat(key).filter(k=>k in data).map(k=>[k,data[k]]));},
      async set(values){Object.assign(data,values);},async remove(keys){for(const key of [].concat(keys))delete data[key];}}},
    tabs:{async get(){return tab;},async query(){return active===tab.id?[tab]:[];},async captureVisibleTab(){calls++;if(changeAfterCapture)active=11;return 'data:image/png;base64,iVBORw0KGgo=';},
      async create(options){if(failCreate)throw new Error('Could not open editor');created.push(options);},async sendMessage(){},onRemoved:event('removed')},
    scripting:{async executeScript(options){return [{result:options.func?viewport:undefined}];}}};
  await import(`../background.js?test=${crypto.randomUUID()}`);
  const send=(message,sender={id:'test',url:'chrome-extension://test/popup.html'})=>new Promise(resolve=>events.message[0](message,sender,resolve));
  const store=new CaptureStore(factory,CAPTURE_DATABASE);
  const records=async()=>{
    const db=await store.open();return new Promise((resolve,reject)=>{const tx=db.transaction('captures'),request=tx.objectStore('captures').getAll();tx.oncomplete=()=>resolve(request.result);tx.onabort=()=>reject(tx.error);});
  };
  return {send,events,data,created,records,store,factory,viewport,tab,get captureCalls(){return calls;}};
}

test('background stores a Blob, opens an id-only editor URL, then cleans up on source-tab close',async()=>{
  const state=await worker();
  assert.deepEqual(await state.send({type:'begin-capture',mode:'viewport',tabId:10}),{ok:true});
  const [capture]=await state.records();
  assert.ok(capture.image instanceof Blob);
  assert.equal(capture.sessionId,state.data[CAPTURE_SESSION_KEY]);
  assert.equal(state.created[0].url,`chrome-extension://test/editor.html?capture=${capture.id}`);
  assert.ok(!Object.keys(state.data).some(key=>key.startsWith('capture:')));
  await state.events.removed[0](10);
  assert.equal((await state.records()).length,0);
});

test('failed editor creation deletes the committed handoff record',async()=>{
  const state=await worker({failCreate:true});
  assert.equal((await state.send({type:'begin-capture',mode:'viewport',tabId:10})).error,'Could not open editor');
  assert.equal((await state.records()).length,0);
});

test('an active-tab change during capture produces no stored screenshot or editor',async()=>{
  const state=await worker({changeAfterCapture:true});
  assert.match((await state.send({type:'begin-capture',mode:'viewport',tabId:10})).error,/active tab changed/);
  assert.equal((await state.records()).length,0);assert.equal(state.created.length,0);
});

test('cancelled selection discards the token without creating any image record',async()=>{
  const state=await worker();
  await state.send({type:'begin-capture',mode:'element',tabId:10});
  const token=state.data['selection:10'].token;
  assert.deepEqual(await state.send({type:'selection-cancel',token},{id:'test',tab:state.tab,frameId:0}),{ok:true});
  assert.equal(state.data['selection:10'],undefined);
  assert.equal(state.captureCalls,0);assert.equal((await state.records()).length,0);
});

test('expired tokens and legacy pixel records are removed on the next capture',async()=>{
  const data={'selection:20':{createdAt:Date.now()-MAX_CAPTURE_AGE,token:'old'},'capture:legacy':{image:'base64 pixels'}};
  const state=await worker({data});await state.send({type:'begin-capture',mode:'element',tabId:10});
  assert.equal(data['selection:20'],undefined);assert.equal(data['capture:legacy'],undefined);
});

test('worker wake preserves this session; a new browser session deletes stale disk records',async()=>{
  const first=await worker();await first.send({type:'begin-capture',mode:'viewport',tabId:10});
  const id=first.data[CAPTURE_SESSION_KEY];
  const resumed=await worker({data:first.data,factory:first.factory});await resumed.events.startup[0]();
  assert.equal(resumed.data[CAPTURE_SESSION_KEY],id);assert.equal((await resumed.records()).length,1);
  const restarted=await worker({factory:first.factory});await restarted.events.startup[0]();
  // Event callbacks return immediately in Chrome. A request waits for initialization.
  await restarted.send({type:'begin-capture',mode:'element',tabId:10});
  assert.notEqual(restarted.data[CAPTURE_SESSION_KEY],id);assert.equal((await restarted.records()).length,0);
});

test('quota failure gives a useful message and leaves no pending record',async()=>{
  const original=CaptureStore.prototype.put;
  CaptureStore.prototype.put=async()=>{throw new DOMException('Disk quota exceeded','QuotaExceededError');};
  try {
    const state=await worker();
    assert.match((await state.send({type:'begin-capture',mode:'viewport',tabId:10})).error,/Free disk space/);
    assert.equal((await state.records()).length,0);assert.equal(state.created.length,0);
  }finally{CaptureStore.prototype.put=original;}
});
