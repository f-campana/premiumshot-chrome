import { initializeAppearance } from './lib/appearance.js';

initializeAppearance();

const status=document.querySelector('#popup-status');
const buttons=[...document.querySelectorAll('[data-mode]')];
for(const button of buttons) button.addEventListener('click',async()=>{
  buttons.forEach(b=>b.disabled=true);status.textContent='Preparing capture…';
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id)throw new Error('Open a webpage first.');
    const response=await chrome.runtime.sendMessage({type:'begin-capture',mode:button.dataset.mode,tabId:tab.id});
    if(!response.ok)throw new Error(response.error);
    window.close();
  } catch(error) {
    status.textContent=error.message||'Capture failed. Try another webpage.';
    buttons.forEach(b=>b.disabled=false);
  }
});
