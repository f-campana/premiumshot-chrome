// Browser port of PremiumShotCore's built-in looks and LayoutEngine.
// Recipe v2 names, geometry and the 4096px cap match the Mac app. Canvas's
// gradients, shadow kernels and image resampling are not pixel-identical to Quartz.
export const looks = [
  { id: 'dawn', name: 'Dawn', dark: false, base: '#f2d6cb', multiplier: .8, tint: [96, 44, 44], blobs: [[.10,.05,.85,'#ffb59e'],[.95,.10,.70,'#dcc4ff'],[.85,1,.90,'#ffd8a6'],[0,.95,.70,'#f7b6cc']] },
  { id: 'tide', name: 'Tide', dark: true, base: '#0b2a48', multiplier: 1.15, tint: [0,10,34], blobs: [[.10,.05,.90,'#1f72e6'],[.95,.95,.95,'#14b8a6'],[.55,.55,.70,'#0a1f3a'],[.95,.05,.50,'#7b93ff']] },
  { id: 'paper', name: 'Paper', dark: false, base: '#ecebe6', multiplier: .65, tint: [44,40,30], blobs: [[.20,.05,.90,'#ffffff'],[.95,1,.90,'#dad7cc']] },
  { id: 'graphite', name: 'Graphite', dark: true, base: '#121419', multiplier: 1.4, tint: [0,0,0], blobs: [[.15,0,.90,'#2b3342'],[.95,.95,.90,'#1b2230'],[.90,.10,.50,'#3a3150']] },
  { id: 'clear', name: 'Clear', dark: false, base: null, multiplier: 1, tint: [20,26,48], blobs: [] },
];

export const shapes = { fit: null, '16:9': [1920,1080], '4:5': [1080,1350], '1:1': [1080,1080], '1.91:1': [1200,630] };
export const defaultRecipe = Object.freeze({ version: 2, look: 'dawn', shape: 'fit', space: 50, radius: 50, shadow: 55 });
const lerp = (a,b,t) => a + (b-a)*t;

export function normalizeRecipe(value = {}) {
  const r = { ...defaultRecipe };
  if (looks.some(look => look.id === value.look)) r.look = value.look;
  if (Object.hasOwn(shapes, value.shape)) r.shape = value.shape;
  for (const key of ['space','radius','shadow']) {
    if (Number.isFinite(value[key])) r[key] = Math.round(Math.min(100, Math.max(0,value[key])));
  }
  return r;
}

export function resolveLayout(sourceWidth, sourceHeight, input) {
  if (![sourceWidth,sourceHeight].every(n => Number.isFinite(n) && n > 0)) throw new Error('The image has no usable dimensions.');
  const recipe = normalizeRecipe(input);
  const u = recipe.space / 100, k = lerp(.03,.19,u);
  let width, height, scale;
  const fixed = shapes[recipe.shape];
  if (fixed) {
    [width,height] = fixed;
    const short = Math.min(width,height), margin = k * short;
    const nativeFits = sourceWidth <= width - .06*short && sourceHeight <= height - .06*short;
    scale = nativeFits ? lerp(1,.7,u) : Math.min(1,(width-2*margin)/sourceWidth,(height-2*margin)/sourceHeight);
  } else {
    const margin = Math.max(k*Math.min(sourceWidth,sourceHeight),lerp(8,36,u));
    width = sourceWidth+2*margin; height = sourceHeight+2*margin; scale = 1;
  }
  const f = Math.min(1,4096/Math.max(width,height));
  let outW = Math.max(5,Math.round(width*f)), outH = Math.max(5,Math.round(height*f));
  if (!fixed) {
    outW = Math.min(4096,Math.max(outW,Math.max(1,Math.round(sourceWidth*scale*f))+4));
    outH = Math.min(4096,Math.max(outH,Math.max(1,Math.round(sourceHeight*scale*f))+4));
  }
  const s = Math.min(scale*f,(outW-4)/sourceWidth,(outH-4)/sourceHeight);
  const w = Math.min(outW-4,Math.max(1,Math.round(sourceWidth*s)));
  const h = Math.min(outH-4,Math.max(1,Math.round(sourceHeight*s)));
  const free = outH-h, lift = Math.min(Math.round(.008*outH),Math.floor(free/4),Math.max(0,Math.floor(free/2)-2));
  const x = Math.floor((outW-w)/2), y = Math.max(2,Math.min(outH-h-2,Math.round(free/2)-lift));
  const look = looks.find(l => l.id === recipe.look), t = recipe.shadow/100*look.multiplier;
  const l = Math.sqrt(w*h), ramp = Math.min(1,t/.1);
  function fitted(blur,offsetY,alpha) {
    if (!t) return {blur: 0,offsetY: 0,alpha: 0};
    const extent = 1.1*blur;
    const limits = [[x,extent],[outW-x-w,extent],[y,Math.max(0,extent-offsetY)],[outH-y-h,extent+offsetY]];
    const factor = limits.reduce((acc,[space,reach]) => reach > 0 ? Math.min(acc,Math.max(0,space-1)/reach) : acc,1);
    return factor*extent < .5 ? {blur: 0,offsetY: 0,alpha: 0} : {blur: factor*blur,offsetY: factor*offsetY,alpha};
  }
  return { width: outW,height: outH,capped: f<1,screenshotScale: s,window: {x,y,width:w,height:h},cornerRadius: lerp(0,64,recipe.radius/100)*s,
    keyShadow: fitted(l*.05*t,l*.032*t,ramp*Math.min(.6,.10+.26*t)),
    ambientShadow: fitted(l*.18*t,l*.05*t,ramp*Math.min(.4,.05+.14*t)) };
}

export function drawBackground(ctx,width,height,look) {
  if (!look.base) return;
  ctx.fillStyle = look.base; ctx.fillRect(0,0,width,height);
  for (const [bx,by,br,color] of look.blobs) {
    const gradient = ctx.createRadialGradient(bx*width,by*height,0,bx*width,by*height,br*Math.max(width,height));
    gradient.addColorStop(0,color); gradient.addColorStop(1,`${color}00`);
    ctx.fillStyle = gradient; ctx.fillRect(0,0,width,height);
  }
}

function applyGrain(ctx,width,height) {
  const image = ctx.getImageData(0,0,width,height), data = image.data;
  const table = new Uint8Array(121*256);
  for (let noise=68;noise<=188;noise++) for (let base=0;base<256;base++) {
    const overlay = base<128 ? Math.floor((2*base*noise+127)/255) : 255-Math.floor((2*(255-base)*(255-noise)+127)/255);
    table[(noise-68)*256+base] = Math.floor((base*8700+overlay*1300+5000)/10000);
  }
  for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
    let h = (Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(0x5eed0001,2246822519))>>>0;
    h = Math.imul(h^(h>>>13),1274126177)>>>0; h ^= h>>>16;
    h = Math.imul(h^(h>>>15),2654435761)>>>0; h ^= h>>>13;
    const noiseIndex = Math.floor((h&0xffff)*120/65535)*256, i=(y*width+x)*4;
    for (let c=0;c<3;c++) data[i+c] = table[noiseIndex+data[i+c]];
  }
  ctx.putImageData(image,0,0);
}

export function render(source,recipe,canvas,backgroundCache = {}) {
  const layout = resolveLayout(source.width,source.height,recipe), look = looks.find(l => l.id===recipe.look);
  canvas.width = layout.width; canvas.height = layout.height;
  const ctx = canvas.getContext('2d',{colorSpace:'srgb'});
  if (!ctx) throw new Error('The image canvas could not be created.');
  const key = `${look.id}:${layout.width}:${layout.height}`;
  if (look.base) {
    if (backgroundCache.key !== key) {
      const bg = typeof document==='undefined' ? new OffscreenCanvas(layout.width,layout.height) : document.createElement('canvas');
      bg.width=layout.width; bg.height=layout.height;
      const bgCtx=bg.getContext('2d',{colorSpace:'srgb'});
      drawBackground(bgCtx,bg.width,bg.height,look); applyGrain(bgCtx,bg.width,bg.height);
      backgroundCache.canvas=bg; backgroundCache.key=key;
    }
    ctx.drawImage(backgroundCache.canvas,0,0);
  }
  const win=layout.window, radius=Math.min(layout.cornerRadius,Math.min(win.width,win.height)/2);
  const path = new Path2D(); path.roundRect(win.x,win.y,win.width,win.height,radius);
  for (const shadow of [layout.ambientShadow,layout.keyShadow]) {
    if (!shadow.alpha) continue;
    const away=layout.width*4+win.width;
    ctx.save(); ctx.shadowColor=`rgba(${look.tint.join(',')},${shadow.alpha})`;
    ctx.shadowBlur=shadow.blur; ctx.shadowOffsetX=away; ctx.shadowOffsetY=shadow.offsetY;
    ctx.fillStyle='#000'; ctx.beginPath(); ctx.roundRect(win.x-away,win.y,win.width,win.height,radius); ctx.fill(); ctx.restore();
  }
  ctx.save(); ctx.clip(path); ctx.imageSmoothingEnabled=layout.screenshotScale!==1; ctx.imageSmoothingQuality='high';
  ctx.drawImage(source,win.x,win.y,win.width,win.height); ctx.restore();
  ctx.strokeStyle=look.dark ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.11)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.roundRect(win.x+.5,win.y+.5,win.width-1,win.height-1,Math.max(0,radius-.5)); ctx.stroke();
  return layout;
}
