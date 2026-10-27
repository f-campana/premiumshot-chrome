import { cropBounds } from './lib/capture.js';
import { defaultRecipe,normalizeRecipe,looks,drawBackground } from './lib/renderer.js';
import { Inspector } from './lib/inspect.js';
import { initializeAppearance } from './lib/appearance.js';
import { CaptureStore,CAPTURE_SESSION_KEY } from './lib/capture-store.js';

const $=selector=>document.querySelector(selector);
const canvas=$('#preview'),well=$('#well'),status=$('#status');
const inspector=new Inspector($('#inspect-dialog'),$('#inspect'));
const shapeHints={fit:'The screenshot’s own shape','16:9':'Slides, X posts, video','4:5':'Portrait feed posts','1:1':'Square posts','1.91:1':'Link previews: Open Graph, LinkedIn'};
const extension=Boolean(globalThis.chrome?.runtime?.id);
const worker=new Worker(new URL('./render-worker.js',import.meta.url),{type:'module'});
let recipe={...defaultRecipe},session=null,revision=0,sourceGeneration=0,result=null,pending=null;
let exporting=false,sourceTabId=null,renderScheduled=false,statusTimer;

function say(text,error=false) {clearTimeout(statusTimer);status.textContent=text;status.classList.toggle('error',error);}
function controls() {
  for(const input of document.querySelectorAll('.looks input,.shape-grid input,input[type=range]'))input.disabled=!session;
  for(const id of ['copy','download','reset','remove','inspect'])$(`#${id}`).disabled=!session || exporting;
}
function syncRecipe() {
  for(const input of document.querySelectorAll('input[name=look]'))input.checked=input.value===recipe.look;
  for(const input of document.querySelectorAll('input[name=shape]'))input.checked=input.value===recipe.shape;
  $('#shape-hint').textContent=shapeHints[recipe.shape];
  for(const key of ['space','radius','shadow']) {
    $(`#${key}`).value=recipe[key];
    $(`#${key}`).style.setProperty('--range-fill',`${recipe[key]}%`);
    $(`#${key}-value`).textContent=recipe[key];
  }
}
function cancelPending() {
  pending?.reject(new Error('The screenshot or style changed. Try exporting again.'));pending=null;result=null;
}
function scheduleRender() {
  revision++;cancelPending();
  if(!session)return;
  let resolve,reject;
  const promise=new Promise((a,b)=>{resolve=a;reject=b;});promise.catch(()=>{});
  pending={promise,resolve,reject};
  if(renderScheduled)return;
  renderScheduled=true;
  requestAnimationFrame(()=>{
    renderScheduled=false;
    if(session)worker.postMessage({type:'render',session,revision,recipe:{...recipe}});
  });
}
function updateRecipe(change) {
  say('');recipe=normalizeRecipe({...recipe,...change});syncRecipe();scheduleRender();
  if(extension)chrome.storage.local.set({recipe}).catch(()=>say('Your style could not be remembered.',true));
}

for(const look of looks) {
  const label=document.createElement('label');label.className=`look ${look.id}`;
  const input=document.createElement('input');input.type='radio';input.name='look';input.value=look.id;input.setAttribute('aria-label',look.name);
  const swatch=document.createElement('canvas');swatch.width=64;swatch.height=64;swatch.setAttribute('aria-hidden','true');
  drawBackground(swatch.getContext('2d'),64,64,look);
  const name=document.createElement('span');name.textContent=look.name;
  label.append(input,swatch,name);$('#looks').append(label);
  input.addEventListener('change',()=>updateRecipe({look:look.id}));
}
for(const input of document.querySelectorAll('input[name=shape]'))input.addEventListener('change',()=>updateRecipe({shape:input.value}));
for(const key of ['space','radius','shadow'])$(`#${key}`).addEventListener('input',event=>updateRecipe({[key]:Number(event.target.value)}));
$('#reset').addEventListener('click',()=>{
  updateRecipe(defaultRecipe);say('Style reset.');statusTimer=setTimeout(()=>say(''),3500);
});

worker.onmessage=({data})=>{
  if(data.session!==session || data.revision!==revision) {data.image?.close();return;}
  if(data.type==='error') {
    pending?.reject(new Error(data.error));pending=null;result=null;say(data.error,true);return;
  }
  canvas.width=data.layout.width;canvas.height=data.layout.height;
  canvas.getContext('2d',{colorSpace:'srgb'}).drawImage(data.image,0,0);data.image.close();
  result={blob:data.blob,layout:data.layout,session,revision};
  canvas.hidden=false;$('#empty').hidden=true;well.classList.add('has-image');
  document.body.classList.add('has-image');
  well.classList.toggle('transparent',recipe.look==='clear');
  $('#dimensions').textContent=`${data.layout.width.toLocaleString()} × ${data.layout.height.toLocaleString()} px${data.layout.capped?' · capped':''}`;
  canvas.setAttribute('aria-label',`Polished screenshot preview · ${looks.find(look=>look.id===recipe.look).name}`);
  if(status.textContent==='Opening your screenshot…')say('');
  pending?.resolve(result);pending=null;
};
worker.onerror=()=>{pending?.reject(new Error('The renderer stopped. Reload the editor and capture again.'));pending=null;say('The renderer stopped. Reload the editor and capture again.',true);};

function empty() {
  inspector.close();document.body.classList.remove('has-image');
  sourceGeneration++;session=null;revision++;cancelPending();
  worker.postMessage({type:'clear'});canvas.width=1;canvas.height=1;canvas.hidden=true;
  $('#empty').hidden=false;well.classList.remove('has-image','transparent');$('#dimensions').textContent='';say('');
  $('#source-label').textContent='Your screenshot';sourceTabId=null;$('#back').hidden=true;controls();
}
$('#remove').addEventListener('click',()=>{empty();say('Screenshot removed. Your style is kept.');well.focus();});

async function decode(url) {
  const image=new Image();image.src=url;await image.decode();
  if(!image.naturalWidth || image.naturalWidth*image.naturalHeight>64000000)throw new Error('Choose an image up to 64 megapixels.');
  return image;
}
async function loadSource(url,{selection=null,label='Imported image',tabId=null}={}) {
  empty();const generation=sourceGeneration;
  say('Opening your screenshot…');
  let bitmap;
  try {
    const image=await decode(url);
    if(generation!==sourceGeneration)return;
    const bounds=cropBounds(selection?.rect,selection?.viewport??{width:image.naturalWidth,height:image.naturalHeight},image.naturalWidth,image.naturalHeight);
    bitmap=await createImageBitmap(image,bounds.x,bounds.y,bounds.width,bounds.height);
    if(generation!==sourceGeneration){bitmap.close();return;}
    session=crypto.randomUUID();sourceTabId=tabId;
    $('#source-label').textContent=label;$('#back').hidden=tabId===null;
    worker.postMessage({type:'source',session,image:bitmap},[bitmap]);bitmap=null;
    controls();scheduleRender();
  } catch(error) {bitmap?.close();if(generation===sourceGeneration)say(error.message||'The image could not be opened.',true);}
}
async function importFile(file) {
  if(!file || !['image/png','image/jpeg','image/webp'].includes(file.type)){say('Choose a PNG, JPEG, or WebP image.',true);return;}
  if(file.size>32*1024*1024){say('Choose an image file smaller than 32 MB.',true);return;}
  const url=URL.createObjectURL(file);
  try{await loadSource(url,{label:file.name});}finally{URL.revokeObjectURL(url);}
}
$('#file').addEventListener('change',event=>{importFile(event.target.files[0]);event.target.value='';});
$('#choose').addEventListener('click',()=>$('#file').click());
$('#example').addEventListener('click',()=>loadSource(new URL('./assets/example.png',import.meta.url).href,{label:'Example · Meridian dashboard'}));
document.addEventListener('paste',event=>{
  if($('#inspect-dialog').open)return;
  const image=[...event.clipboardData.items].find(item=>item.kind==='file' && item.type.startsWith('image/'));
  if(image){event.preventDefault();importFile(image.getAsFile());}
});
well.addEventListener('dragover',event=>{event.preventDefault();well.classList.add('drag-over');});
well.addEventListener('dragleave',()=>well.classList.remove('drag-over'));
well.addEventListener('drop',event=>{event.preventDefault();well.classList.remove('drag-over');importFile(event.dataTransfer.files[0]);});
document.addEventListener('dragover',event=>event.preventDefault());
document.addEventListener('drop',event=>event.preventDefault());
well.addEventListener('keydown',event=>{
  if(event.target!==well)return;
  if(event.key==='Delete' || event.key==='Backspace'){event.preventDefault();if(session&&!exporting)$('#remove').click();}
  if(event.key===' ' && session){event.preventDefault();$('#inspect').click();}
});

async function output() {
  const token={session,revision};
  if(!session)throw new Error('Capture or open an image first.');
  const ready=result??await pending?.promise;
  if(!ready || token.session!==session || token.revision!==revision)throw new Error('The screenshot or style changed. Try exporting again.');
  return ready;
}
$('#inspect').addEventListener('click',async()=>{
  try{await output();inspector.open(canvas,recipe.look==='clear');}
  catch(error){say(error.message||'The image could not be inspected.',true);}
});
function confirm(ready,verb) {
  say(`${verb} · ${ready.layout.width.toLocaleString()} × ${ready.layout.height.toLocaleString()} px`);
  statusTimer=setTimeout(()=>say(''),3500);
}
$('#copy').addEventListener('click',async()=>{
  exporting=true;controls();say('Preparing your image…');
  try {
    let ready;
    // A promise-valued ClipboardItem keeps the original click's activation while
    // the current render finishes. Never substitute the previous style's PNG.
    const item=new ClipboardItem({'image/png':output().then(value=>{ready=value;return value.blob;})});
    await navigator.clipboard.write([item]);confirm(ready,'Copied');
  }catch(error){say(error.name==='NotAllowedError'?'Clipboard access was denied. Download the PNG instead.':error.message||'The image could not be copied.',true);}
  finally{exporting=false;controls();}
});
$('#download').addEventListener('click',async()=>{
  exporting=true;controls();say('Preparing your image…');
  try {
    const ready=await output(),url=URL.createObjectURL(ready.blob),link=document.createElement('a');
    link.href=url;link.download=`PremiumShot-${recipe.look}-${ready.layout.width}x${ready.layout.height}.png`;
    link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);confirm(ready,'Download started');
  }catch(error){say(error.message||'The image could not be downloaded.',true);}
  finally{exporting=false;controls();}
});
$('#back').addEventListener('click',async()=>{
  try{await chrome.tabs.update(sourceTabId,{active:true});}catch{say('The source tab is closed. Capture another page with the extension.',true);}
});

initializeAppearance({choices:document.querySelectorAll('input[name=theme]'),button:$('#appearance')});
function closeAppearance() {
  $('#appearance-menu').hidePopover();$('#appearance').focus();
}
$('#appearance-menu').addEventListener('change',closeAppearance);
$('#appearance-menu').addEventListener('click',event=>{
  if(event.target.matches('input[name=theme]'))closeAppearance();
});

syncRecipe();controls();
async function initialize() {
  if(!extension)return;
  const startupGeneration=sourceGeneration;
  const id=new URL(location.href).searchParams.get('capture');
  if(id)history.replaceState(null,'','editor.html');
  try {
    const saved=await chrome.storage.local.get('recipe');
    if(sourceGeneration===startupGeneration){recipe=normalizeRecipe(saved.recipe);syncRecipe();}
    if(!id)return;
    const values=await chrome.storage.session.get(CAPTURE_SESSION_KEY);
    // Reading and deleting share one transaction, including expired captures.
    const capture=await new CaptureStore().take(id,values[CAPTURE_SESSION_KEY]);
    if(sourceGeneration!==startupGeneration)return;
    if(!capture){say('This capture expired. Return to the page and capture again.',true);return;}
    const mode=capture.selection?.mode==='element'?'Element':capture.selection?.mode==='area'?'Area':'Visible tab';
    const url=URL.createObjectURL(capture.image);
    try{await loadSource(url,{selection:capture.selection,label:`${mode}${capture.hostname?' · '+capture.hostname:''}`,tabId:capture.sourceTabId});}
    finally{URL.revokeObjectURL(url);}
  }catch(error){if(sourceGeneration===startupGeneration)say(error.message||'The capture could not be opened.',true);}
}
initialize();
window.addEventListener('pagehide',()=>worker.terminate());
