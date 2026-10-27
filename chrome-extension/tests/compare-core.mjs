import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveLayout,defaultRecipe,shapes } from '../lib/renderer.js';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const cli=process.env.PSHOT_CLI??path.join(repo,'.build/release/pshot');
let count=0;
for(const file of ['wide-dashboard.png','tall-article.png','thin-strip.png','small-dialog.png']) {
  const input=path.join(repo,'fixtures',file),png=readFileSync(input);
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
  for(const shape of Object.keys(shapes))for(const space of [0,50,100]) {
    const args=['layout','--in',input,'--shape',shape,'--space',String(space),'--json'];
    const mac=JSON.parse(execFileSync(cli,args,{encoding:'utf8'}));
    const browser=resolveLayout(width,height,{...defaultRecipe,shape,space});
    for(const key of ['width','height','capped','screenshotScale','window'])assert.deepEqual(browser[key],mac[key],`${file} ${shape} ${space}: ${key}`);
    assert.ok(Math.abs(mac.keyShadowAlpha-browser.keyShadow.alpha)<1e-12);
    assert.ok(Math.abs(mac.ambientShadowAlpha-browser.ambientShadow.alpha)<1e-12);
    count++;
  }
}
console.log(`PASS ${count} native/browser layout comparisons`);
