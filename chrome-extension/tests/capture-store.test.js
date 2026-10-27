import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { CaptureStore,MAX_CAPTURE_AGE,pngDataURLToBlob } from '../lib/capture-store.js';

const record = (change = {}) => ({id:crypto.randomUUID(),sessionId:'session-a',createdAt:Date.now(),sourceTabId:10,
  image:new Blob(['PNG bytes'],{type:'image/png'}),selection:null,hostname:'example.test',...change});
const repository = () => new CaptureStore(new IDBFactory());
async function records(store) {
  const database=await store.open();
  return new Promise((resolve,reject)=>{
    const transaction=database.transaction('captures');
    const request=transaction.objectStore('captures').getAll();
    transaction.oncomplete=()=>resolve(request.result);
    transaction.onabort=()=>reject(transaction.error);
  });
}

test('PNG handoff preserves more than 8 MB of original bytes without base64 storage',async()=>{
  const input=Buffer.alloc(8*1024*1024+17,173);
  input[0]=137;input[input.length-1]=42;
  const blob=pngDataURLToBlob(`data:image/png;base64,${input.toString('base64')}`);
  assert.equal(blob.type,'image/png');
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()),input);
  const store=repository(),capture=record({image:blob});
  await store.put(capture);
  const restored=await store.take(capture.id,capture.sessionId);
  assert.deepEqual(Buffer.from(await restored.image.arrayBuffer()),input);
  assert.equal((await records(store)).length,0);
});

test('two editors racing for an id consume the record only once',async()=>{
  const store=repository(),capture=record();await store.put(capture);
  const otherEditor=new CaptureStore(store.factory);
  const results=await Promise.all([store.take(capture.id,capture.sessionId),otherEditor.take(capture.id,capture.sessionId)]);
  assert.equal(results.filter(Boolean).length,1);
  assert.equal((await records(store)).length,0);
});

test('expired and previous-session captures are deleted even when opened directly',async()=>{
  const store=repository(),a=record(),b=record();await store.put(a);await store.put(b);
  assert.equal(await store.take(a.id,a.sessionId,a.createdAt+MAX_CAPTURE_AGE),null);
  assert.equal(await store.take(b.id,'session-b'),null);
  assert.equal((await records(store)).length,0);
});

test('cleanup removes expired, future-dated and previous-session records while preserving a fresh capture',async()=>{
  const store=repository(),now=Date.now();
  const fresh=record({createdAt:now}),old=record({createdAt:now-MAX_CAPTURE_AGE}),future=record({createdAt:now+10000}),previous=record({sessionId:'previous'});
  await store.transaction(objectStore=>{for(const item of [fresh,old,future,previous])objectStore.put(item);});
  await store.prune(fresh.sessionId,now);
  assert.deepEqual((await records(store)).map(item=>item.id),[fresh.id]);
});

test('closing one source tab removes all of its captures and leaves other tabs alone',async()=>{
  const store=repository(),a=record(),b=record(),c=record({sourceTabId:11});
  for(const item of [a,b,c])await store.put(item);
  await store.removeForTab(10);
  assert.deepEqual((await records(store)).map(item=>item.id),[c.id]);
  await store.remove(c.id);assert.equal((await records(store)).length,0);
});

test('a restarted service worker can reopen the same pending capture',async()=>{
  const store=repository(),capture=record();await store.put(capture);
  const restarted=new CaptureStore(store.factory);
  assert.equal((await restarted.take(capture.id,capture.sessionId)).hostname,'example.test');
});

test('an aborted write never reports success and never leaves an orphan',async()=>{
  const store=repository();
  await assert.rejects(store.transaction(objectStore=>{objectStore.put(record());throw new Error('Injected write failure');}),/Injected write failure/);
  assert.equal((await records(store)).length,0);
});

test('invalid or empty capture data is rejected before storage',async()=>{
  assert.throws(()=>pngDataURLToBlob('data:image/jpeg;base64,YQ=='),/PNG/);
  assert.throws(()=>pngDataURLToBlob('data:image/png;base64,'),/empty/);
  assert.throws(()=>pngDataURLToBlob('data:image/png;base64,???'));
  const store=repository();
  await assert.rejects(store.put(record({createdAt:Date.now()-MAX_CAPTURE_AGE})),/expired/);
  assert.equal((await records(store)).length,0);
});
