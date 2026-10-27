import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLayout,defaultRecipe,normalizeRecipe,shapes,looks } from '../lib/renderer.js';
import { cropBounds,sameViewport } from '../lib/capture.js';

test('every shape preserves the source, stays inside the canvas and caps exports',()=>{
  for(const [width,height] of [[1440,900],[450,300],[200,20000],[20000,200],[1,1],[1,64000000],[7000,50]]) {
    for(const shape of Object.keys(shapes))for(const look of looks)for(const space of [0,25,50,100]) {
      const l=resolveLayout(width,height,{...defaultRecipe,shape,look:look.id,space});
      assert.ok(l.width<=4096 && l.height<=4096);
      assert.ok(l.screenshotScale<=1);
      assert.ok(l.window.x>=2 && l.window.y>=2);
      assert.ok(l.window.x+l.window.width<=l.width-2);
      assert.ok(l.window.y+l.window.height<=l.height-2);
      assert.ok(Math.abs(l.window.height-height*l.screenshotScale)<=1);
    }
  }
});
test('Fit keeps ordinary screenshot pixels at native size and matches Core layout',()=>{
  const l=resolveLayout(1440,900,defaultRecipe);
  assert.deepEqual([l.width,l.height,l.window.x,l.window.y,l.window.width,l.window.height],[1638,1098,99,90,1440,900]);
  assert.equal(l.screenshotScale,1);
});
test('zero shadow is actually zero and small values ramp up',()=>{
  for(const look of looks) {
    const zero=resolveLayout(1440,900,{...defaultRecipe,look:look.id,shadow:0});
    assert.deepEqual(zero.keyShadow,{blur:0,offsetY:0,alpha:0});
    assert.deepEqual(zero.ambientShadow,{blur:0,offsetY:0,alpha:0});
    const one=resolveLayout(1440,900,{...defaultRecipe,look:look.id,shadow:1});
    const ten=resolveLayout(1440,900,{...defaultRecipe,look:look.id,shadow:10});
    assert.ok(one.ambientShadow.alpha>0 && one.ambientShadow.alpha<ten.ambientShadow.alpha);
  }
});
test('saved recipes cannot introduce unknown looks, dimensions or non-finite values',()=>{
  assert.deepEqual(normalizeRecipe({look:'custom',shape:'oops',space:NaN,shadow:Infinity,radius:-99}),{...defaultRecipe,radius:0});
  assert.equal(normalizeRecipe({space:201.1}).space,100);
  assert.throws(()=>resolveLayout(0,300,defaultRecipe));
});
test('crop converts CSS bounds from bitmap dimensions rather than assuming DPR',()=>{
  assert.deepEqual(cropBounds({x:10.5,y:20.25,width:100.5,height:40.5},{width:1000,height:600},2500,1500),{x:26,y:50,width:252,height:102});
  assert.deepEqual(cropBounds(null,{width:1000,height:600},2500,1500),{x:0,y:0,width:2500,height:1500});
  assert.throws(()=>cropBounds({x:900,y:0,width:200,height:50},{width:1000,height:600},2000,1200));
  assert.throws(()=>cropBounds({x:0,y:0,width:NaN,height:50},{width:1000,height:600},2000,1200));
  assert.throws(()=>cropBounds({x:0,y:0,width:100,height:50},{width:1000,height:600},1000,500));
});
test('page movement and pinch zoom invalidate selection',()=>{
  const v={width:1000,height:600,scrollX:0,scrollY:20,scale:1,offsetX:0,offsetY:0};
  assert.ok(sameViewport(v,{...v}));
  assert.ok(!sameViewport(v,{...v,scrollY:22}));
  assert.ok(!sameViewport(v,{...v,scale:1.05}));
  assert.ok(!sameViewport(v,{...v,width:800}));
});
