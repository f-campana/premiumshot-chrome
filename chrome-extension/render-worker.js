import { render } from './lib/renderer.js';

let source=null,session=null,pending=null,timer=null;
const backgroundCache={};
self.onmessage=({data})=>{
  if(data.type==='source') {
    source?.close();source=data.image;session=data.session;pending=null;
    backgroundCache.canvas=null;backgroundCache.key=null;
  }
  if(data.type==='clear') {
    source?.close();source=null;session=null;pending=null;
    backgroundCache.canvas=null;backgroundCache.key=null;
  }
  if(data.type==='render' && data.session===session) {
    pending=data;
    if(!timer)timer=setTimeout(flush,0);
  }
};

async function flush() {
  timer=null;
  const job=pending;pending=null;
  if(!job || !source || job.session!==session)return;
  try {
    const canvas=new OffscreenCanvas(1,1);
    const layout=render(source,job.recipe,canvas,backgroundCache);
    const blob=await canvas.convertToBlob({type:'image/png'});
    const image=canvas.transferToImageBitmap();
    self.postMessage({type:'rendered',session:job.session,revision:job.revision,layout,blob,image},[image]);
  } catch(error) {
    self.postMessage({type:'error',session:job.session,revision:job.revision,error:error.message||'The image could not be rendered.'});
  }
}
