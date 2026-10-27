(() => {
  // Injected only on demand, in Chrome's isolated world. Reusing the listener
  // prevents duplicate pickers when the extension is invoked twice.
  if (globalThis.__premiumshotPickerInstalled) return;
  globalThis.__premiumshotPickerInstalled=true;
  let stopCurrent;

  chrome.runtime.onMessage.addListener(message => {
    if (message.type!=='start-picker') return;
    stopCurrent?.();
    start(message);
  });

  function start({mode,token}) {
    const host=document.createElement('premiumshot-picker');
    host.style.cssText='all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;';
    const root=host.attachShadow({mode:'closed'});
    root.innerHTML=`<style>
      :host{color-scheme:light}*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .surface{position:fixed;inset:0;pointer-events:none}.area{pointer-events:auto;cursor:crosshair}
      .outline{position:fixed;border:2px solid #fff;outline:1px solid #202320;border-radius:3px;background:rgba(255,255,255,.06);pointer-events:none;display:none}
      .outline.invalid{outline-color:#a12727;border-color:#ffdddd;background:rgba(190,40,40,.06)}
      .label{position:fixed;max-width:min(500px,90vw);padding:6px 9px;color:#fff;background:#252823;border-radius:6px;font-size:11px;line-height:1.4;pointer-events:none;display:none}
      .toolbar{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);max-width:calc(100vw - 32px);display:flex;align-items:center;gap:16px;padding:13px 15px 13px 18px;border:1px solid #ffffff30;border-radius:13px;background:#252823;color:#fff;box-shadow:0 8px 30px #0003;pointer-events:auto;font-size:12px;line-height:1.5}
      .toolbar strong{font-size:13px;font-weight:600;display:block}.hint{color:#dedfd8;white-space:normal}
      button{flex-shrink:0;border:1px solid #ffffff50;background:#ffffff12;border-radius:7px;color:white;padding:7px 10px;font-size:12px;cursor:pointer}button:focus-visible{outline:2px solid white;outline-offset:3px}
    </style><div class="surface ${mode==='area'?'area':''}"></div><div class="outline"></div><div class="label"></div>
    <div class="toolbar" role="dialog" aria-label="PremiumShot selection"><div><strong></strong><div class="hint" role="status" aria-live="polite"></div></div><button type="button">Cancel · Esc</button></div>`;
    const outline=root.querySelector('.outline'),label=root.querySelector('.label'),hint=root.querySelector('.hint');
    root.querySelector('strong').textContent=mode==='area'?'Select an area':'Select an element';
    const help=mode==='area'?'Drag over the area you want to capture.':'Click to capture · ↑ parent · ↓ child · Enter capture';
    hint.textContent=help;
    document.documentElement.append(host);
    const abort=new AbortController(),options={capture:true,signal:abort.signal};
    let element=null,anchor=null,rect=null,children=[],finishing=false,lastPointer=null;
    const viewport=() => ({width:innerWidth,height:innerHeight,scrollX,scrollY,scale:visualViewport?.scale??1,offsetX:visualViewport?.offsetLeft??0,offsetY:visualViewport?.offsetTop??0});
    const inside=event => event.composedPath().includes(host);
    const onToolbar=event => {
      const r=root.querySelector('.toolbar').getBoundingClientRect();
      return event.clientX>=r.left && event.clientX<=r.right && event.clientY>=r.top && event.clientY<=r.bottom;
    };
    const swallow=event => {event.preventDefault();event.stopImmediatePropagation();};
    function cleanup() { abort.abort();host.remove();if(stopCurrent===cleanup) stopCurrent=undefined; }
    stopCurrent=cleanup;
    function notify(message) {
      return chrome.runtime.sendMessage(message).catch(() => ({ok:false,error:'The extension was reloaded. Start a new capture.'}));
    }
    async function cancel() { cleanup();await notify({type:'selection-cancel',token}); }
    root.querySelector('button').addEventListener('click',cancel);

    function isVisible(r) { return r && r.width>=1 && r.height>=1 && r.x>=0 && r.y>=0 && r.x+r.width<=innerWidth+1 && r.y+r.height<=innerHeight+1; }
    function measure() {
      if (element) {
        const r=element.getBoundingClientRect(); rect={x:r.x,y:r.y,width:r.width,height:r.height};
      }
      if (!rect) return;
      const valid=isVisible(rect),x=Math.max(0,rect.x),y=Math.max(0,rect.y);
      Object.assign(outline.style,{display:'block',left:`${x}px`,top:`${y}px`,width:`${Math.max(0,Math.min(rect.width,innerWidth-x))}px`,height:`${Math.max(0,Math.min(rect.height,innerHeight-y))}px`});
      outline.classList.toggle('invalid',!valid);
      label.style.display='block';label.style.left=`${Math.max(8,Math.min(innerWidth-280,x))}px`;
      label.style.top=`${Math.max(8,Math.min(innerHeight-85,y>38?y-32:y+rect.height+8))}px`;
      const name=element ? `${element.tagName.toLowerCase()}${element.id?' #'+element.id:''}` : 'Area';
      label.textContent=`${name.slice(0,80)} · ${Math.round(rect.width)} × ${Math.round(rect.height)}`;
      hint.textContent=valid?help:'Part of this element is outside the viewport. Choose a smaller element or an area.';
    }
    function hit(x,y) {
      let target=document.elementFromPoint(x,y),next;
      while (target?.shadowRoot && (next=target.shadowRoot.elementFromPoint(x,y)) && next!==target) target=next;
      return target;
    }
    async function finish() {
      if (finishing) return;
      measure();
      if (!isVisible(rect)) { hint.textContent='Select an area fully visible in the page.';return; }
      const v=viewport();
      if (v.scale!==1 || v.offsetX!==0 || v.offsetY!==0) { hint.textContent='Reset pinch zoom before capturing. Browser zoom is supported.';return; }
      finishing=true;
      const selection={rect:{...rect},viewport:v};
      cleanup();
      // Wait until the highlight and picker toolbar have actually left the compositor.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise(resolve => setTimeout(resolve,80));
      const response=await notify({type:'selection-complete',token,selection});
      if (!response.ok) showError(response.error);
    }
    function move(event) {
      if (onToolbar(event)) return;
      if (mode==='area') {
        if (!anchor) return;
        const x=Math.max(0,Math.min(innerWidth,event.clientX)),y=Math.max(0,Math.min(innerHeight,event.clientY));
        rect={x:Math.min(anchor.x,x),y:Math.min(anchor.y,y),width:Math.abs(anchor.x-x),height:Math.abs(anchor.y-y)};
      } else {
        // A click may emit a pointermove at the same coordinates. Keep an
        // explicitly selected parent until the pointer actually moves away.
        if(lastPointer && element && Math.hypot(event.clientX-lastPointer.x,event.clientY-lastPointer.y)<(children.length?2:0.1))return;
        lastPointer={x:event.clientX,y:event.clientY};
        const next=hit(event.clientX,event.clientY);
        if (!next || next===host) return;
        element=next;children=[];
      }
      measure();
    }
    window.addEventListener('pointermove',move,options);
    window.addEventListener('pointerdown',event => {
      if (onToolbar(event)) return;
      swallow(event);
      if (mode==='area') { anchor={x:event.clientX,y:event.clientY};rect={...anchor,width:0,height:0};measure(); }
      else if(!element)move(event);
    },options);
    window.addEventListener('pointerup',event => {
      if (!anchor || mode!=='area') return;
      swallow(event);move(event);anchor=null;
      if (rect.width<4 || rect.height<4) { hint.textContent='Drag a larger area to capture.';return; }
      // Removing an area overlay on pointerup must not click the webpage underneath it.
      window.addEventListener('click',swallow,{capture:true,once:true});
      setTimeout(()=>window.removeEventListener('click',swallow,true),250);
      finish();
    },options);
    window.addEventListener('click',event => { if(inside(event))return;swallow(event);if(mode==='element')finish(); },options);
    window.addEventListener('keydown',event => {
      if(event.key==='Escape'){swallow(event);cancel();}
      if(event.key==='Enter'){swallow(event);if(inside(event))cancel();else finish();}
      if(mode!=='element' || !element)return;
      if(event.key==='ArrowUp') {
        swallow(event);const parent=element.parentElement??element.getRootNode().host;
        if(parent && parent!==host){children.push(element);element=parent;measure();}
      }
      if(event.key==='ArrowDown') {swallow(event);if(children.length){element=children.pop();measure();}}
    },options);
    window.addEventListener('scroll',measure,options);
    window.addEventListener('resize',measure,options);
    window.addEventListener('pagehide',cleanup,{once:true,signal:abort.signal});
  }

  function showError(text) {
    const host=document.createElement('premiumshot-error');
    host.style.cssText='all:initial!important;position:fixed!important;bottom:24px!important;left:50%!important;transform:translateX(-50%)!important;z-index:2147483647!important;display:block!important;';
    const root=host.attachShadow({mode:'closed'}),box=document.createElement('div'),button=document.createElement('button');
    box.style.cssText='padding:16px 20px;border-radius:12px;background:#252823;color:white;box-shadow:0 8px 30px #0003;font:13px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;max-width:500px;';
    box.setAttribute('role','alert');box.textContent=text+' ';
    button.textContent='Dismiss';button.style.cssText='margin-left:12px;color:white;border:1px solid #ffffff50;border-radius:5px;background:transparent;padding:5px 8px;cursor:pointer;';
    button.addEventListener('click',()=>host.remove());box.append(button);root.append(box);document.documentElement.append(host);
    setTimeout(()=>host.remove(),15000);
  }
})();
