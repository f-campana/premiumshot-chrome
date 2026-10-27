import { sameViewport } from './lib/capture.js';
import { CaptureStore,CAPTURE_SESSION_KEY,MAX_CAPTURE_AGE,pngDataURLToBlob } from './lib/capture-store.js';

const selectionKey = tabId => `selection:${tabId}`;
const captures = new CaptureStore();
let capturing = false;
let lastCaptureAt = 0;

async function startSession() {
  const values = await chrome.storage.session.get(CAPTURE_SESSION_KEY);
  const id = values[CAPTURE_SESSION_KEY] || crypto.randomUUID();
  if (!values[CAPTURE_SESSION_KEY]) await chrome.storage.session.set({[CAPTURE_SESSION_KEY]:id});
  await captures.prune(id);
  return id;
}
// Register listeners synchronously below. A worker restart reuses the small
// session id; a browser/extension restart invalidates any remaining disk records.
const sessionReady = startSession();
sessionReady.catch(() => {}); // Requests report storage failures to the user.

async function tidyPending() {
  const sessionId = await sessionReady;
  const values = await chrome.storage.session.get(null);
  const expired = Object.keys(values).filter(key => key.startsWith('capture:')
    || (key.startsWith('selection:') && Date.now() - values[key].createdAt >= MAX_CAPTURE_AGE));
  if (expired.length) await chrome.storage.session.remove(expired);
  await captures.prune(sessionId);
  return sessionId;
}

function pageViewport() {
  return { width: innerWidth,height: innerHeight,scrollX,scrollY,
    scale: visualViewport?.scale ?? 1,offsetX: visualViewport?.offsetLeft ?? 0,offsetY: visualViewport?.offsetTop ?? 0 };
}

async function assertActive(tabId,windowId) {
  const [active] = await chrome.tabs.query({active:true,windowId});
  if (active?.id!==tabId) throw new Error('The active tab changed. Return to your page and capture again.');
}

async function capture(tab,selection = null) {
  if (capturing) throw new Error('A capture is already in progress. Try again in a moment.');
  capturing=true;
  let id;
  try {
    const sessionId = await tidyPending();
    // Chrome limits captureVisibleTab to two calls per second.
    const delay=Math.max(0,550-(Date.now()-lastCaptureAt));
    if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    await assertActive(tab.id,tab.windowId);
    if (selection) {
      const [{result}] = await chrome.scripting.executeScript({target:{tabId:tab.id},func:pageViewport});
      if (!sameViewport(result,selection.viewport)) throw new Error('The page moved during capture. Select it again.');
    }
    lastCaptureAt=Date.now();
    const image = await chrome.tabs.captureVisibleTab(tab.windowId,{format:'png'});
    await assertActive(tab.id,tab.windowId);
    if (selection) {
      const [{result}] = await chrome.scripting.executeScript({target:{tabId:tab.id},func:pageViewport});
      if (!sameViewport(result,selection.viewport)) throw new Error('The page moved during capture. Select it again.');
    }
    id=crypto.randomUUID();
    let hostname='';
    try { hostname=new URL(tab.url).hostname; } catch { /* Internal pages have no useful hostname. */ }
    await captures.put({id,image:pngDataURLToBlob(image),selection,hostname,sourceTabId:tab.id,createdAt:Date.now(),sessionId});
    await assertActive(tab.id,tab.windowId);
    await chrome.tabs.create({windowId:tab.windowId,url:chrome.runtime.getURL(`editor.html?capture=${id}`)});
    return {ok:true};
  } catch (error) {
    if (id) await captures.remove(id).catch(() => {});
    throw error;
  } finally { capturing=false; }
}

async function begin(mode,tabId) {
  const tab=Number.isInteger(tabId)?await chrome.tabs.get(tabId):null;
  if (!tab?.id) throw new Error('Open a webpage first.');
  await assertActive(tab.id,tab.windowId);
  if (mode==='viewport') return capture(tab);
  if (!['element','area'].includes(mode)) throw new Error('Choose a capture mode.');
  if (!/^https?:\/\//.test(tab.url??'')) throw new Error('Element and area selection work on webpages. Use visible-tab capture for this page.');
  await tidyPending();
  const token=crypto.randomUUID();
  try {
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['picker.js']});
  } catch {
    throw new Error('Chrome blocks selection on this page. Try visible-tab capture or another webpage.');
  }
  await chrome.storage.session.set({[selectionKey(tab.id)]:{token,mode,createdAt:Date.now()}});
  try {
    await chrome.tabs.sendMessage(tab.id,{type:'start-picker',mode,token});
  } catch (error) {
    await chrome.storage.session.remove(selectionKey(tab.id));
    throw error;
  }
  return {ok:true,picking:true};
}

async function handle(message,sender) {
  if (sender.id!==chrome.runtime.id) throw new Error('Unknown sender.');
  const fromExtension = sender.url===chrome.runtime.getURL('popup.html');
  if (message?.type==='begin-capture' && fromExtension) return begin(message.mode,message.tabId);
  if (!['selection-complete','selection-cancel'].includes(message?.type) || !sender.tab || sender.frameId!==0) {
    throw new Error('Unknown capture request.');
  }
  const key=selectionKey(sender.tab.id), pending=(await chrome.storage.session.get(key))[key];
  if (!pending || pending.token!==message.token || Date.now()-pending.createdAt>=MAX_CAPTURE_AGE) throw new Error('This selection expired. Click the extension to start again.');
  await chrome.storage.session.remove(key);
  if (message.type==='selection-cancel') return {ok:true};
  const {rect,viewport}=message.selection??{};
  if (!rect || !viewport || ![rect.x,rect.y,rect.width,rect.height,viewport.width,viewport.height].every(Number.isFinite)
    || rect.width<1 || rect.height<1 || rect.x<0 || rect.y<0 || rect.x+rect.width>viewport.width+1 || rect.y+rect.height>viewport.height+1
    || viewport.scale!==1 || viewport.offsetX!==0 || viewport.offsetY!==0) {
    throw new Error('Select an area fully visible in the page. Reset pinch zoom if needed.');
  }
  return capture(sender.tab,{rect,viewport,mode:pending.mode});
}

chrome.runtime.onMessage.addListener((message,sender,respond) => {
  handle(message,sender).then(respond,error => respond({ok:false,error:/quota/i.test(error.message)||error.name==='QuotaExceededError'?'Chrome could not store this capture. Free disk space or close pending captures and try again.':error.message || 'Capture failed. Try another webpage.'}));
  return true;
});

chrome.tabs.onRemoved.addListener(async tabId => {
  await chrome.storage.session.remove(selectionKey(tabId));
  await captures.removeForTab(tabId).catch(() => {});
});

chrome.runtime.onStartup.addListener(() => { tidyPending().catch(() => {}); });
chrome.runtime.onInstalled.addListener(() => { tidyPending().catch(() => {}); });
