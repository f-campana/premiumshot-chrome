import test from 'node:test';
import assert from 'node:assert/strict';
import {Zoom} from '../lib/zoom.js';

test('Actual size maps export pixels to backing pixels at fractional and Retina scales', () => {
  for (const backingScale of [1, 1.25, 1.5, 2, 3]) {
    const z = new Zoom();
    z.configure({width:2789, height:1269, viewportWidth:800, viewportHeight:500, backingScale});
    assert.ok(z.imageWidth*z.scale<=800+.001);
    assert.ok(z.imageHeight*z.scale<=500+.001);
    z.zoomTo(1);
    assert.equal(z.scale, 1);
    assert.equal(z.imageWidth*backingScale, 2789);
    assert.equal(z.imageHeight*backingScale, 1269);
  }
});

test('Zoom keeps an interior anchor under the pointer and bounds magnification', () => {
  const z = new Zoom();
  z.configure({width:2000, height:2000, viewportWidth:500, viewportHeight:500});
  z.zoomTo(.5);
  z.zoomTo(1, 40, -30);
  assert.deepEqual([z.x, z.y], [-40, 30]);
  z.zoomTo(20);
  assert.equal(z.scale, 4);
  z.zoomTo(.01);
  assert.equal(z.scale, z.floor);
  assert.ok(z.x === 0 && z.y === 0);
});

test('Pan cannot move past the image edges, including an axis that already fits', () => {
  const z = new Zoom();
  z.configure({width:2000, height:400, viewportWidth:800, viewportHeight:600, backingScale:2});
  z.zoomTo(1);
  z.pan(100000, -100000);
  assert.ok(z.x === 100 && z.y === 0);
  z.pan(-100000, 100000);
  assert.ok(z.x === -100 && z.y === 0);
});

test('Resize preserves actual-size zoom and clamps pan; Fit recenters and limits enlargement', () => {
  const z = new Zoom();
  z.configure({width:2000, height:1000, viewportWidth:800, viewportHeight:400});
  z.zoomTo(1);
  z.pan(500, 300);
  z.configure({width:2000, height:1000, viewportWidth:1800, viewportHeight:900, fit:false});
  assert.equal(z.scale, 1);
  assert.deepEqual([z.x, z.y], [100, 50]);
  z.configure({width:1, height:1, viewportWidth:800, viewportHeight:500});
  assert.equal(z.scale, 4);
  z.zoomTo(1);
  assert.equal(z.scale, 1);
  assert.deepEqual([z.x, z.y], [0, 0]);
});
