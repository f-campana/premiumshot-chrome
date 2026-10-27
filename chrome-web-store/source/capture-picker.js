// Artwork/QA adapter only, excluded from the extension upload. It runs the
// unchanged shipped picker over the real DOM of our synthetic fixture page.
// This does not grant activeTab or pretend to call captureVisibleTab.
const frame=document.querySelector('#page'),button=document.querySelector('#start');
button.addEventListener('click',async()=>{
  button.disabled=true;
  const page=frame.contentWindow;let startPicker;
  page.chrome.runtime={onMessage:{addListener:listener=>{startPicker=listener;}},sendMessage:async message=>{document.body.dataset.lastRequest=message.type;document.body.dataset.lastSelection=JSON.stringify(message.selection??null);return {ok:true};}};
  const script=page.document.createElement('script');script.src=new URL('../../chrome-extension/picker.js',import.meta.url).href;
  await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=reject;page.document.head.append(script);});
  startPicker({type:'start-picker',mode:'element',token:'artwork-preview'});
  const card=page.document.querySelector('#revenue').getBoundingClientRect();
  page.dispatchEvent(new page.PointerEvent('pointermove',{clientX:card.x+8,clientY:card.y+8}));
  button.hidden=true;document.querySelector('#status').hidden=true;
  document.body.dataset.preview='ready';
});
