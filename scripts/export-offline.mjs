import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
let html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
let css=fs.readFileSync(path.join(dist,'style.css'),'utf8');
const scriptNames=[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
const js=scriptNames.map(name=>fs.readFileSync(path.join(dist,name),'utf8')).join('\n');
const used=[...new Set((html+css+js).match(/assets\/[A-Za-z0-9_.-]+/g)||[])];
const mapping={},vars={};
const review=path.join(root,'review');
const reviewAssets=path.join(review,'assets');
fs.mkdirSync(reviewAssets,{recursive:true});
for(const name of used){
  const source=path.join(dist,name);
  if(name.endsWith('.mp4')){
    fs.copyFileSync(source,path.join(reviewAssets,path.basename(name)));
    continue;
  }
  const mime=name.endsWith('.png')?'image/png':name.endsWith('.svg')?'image/svg+xml':name.endsWith('.gif')?'image/gif':'image/jpeg';
  mapping[name]=`data:${mime};base64,${fs.readFileSync(source).toString('base64')}`;
  vars[name]='--offline-'+name.replace(/[^a-zA-Z0-9]/g,'-');
  css=css.replaceAll(`url('${name}')`,`url("${mapping[name]}")`);
}
html=html.replace('<link rel="stylesheet" href="style.css">',`<style>${css}</style>`)
  .replace(/<script src="[^"]+"><\/script>/g,'')
  .replace(/src="(assets\/(?![^"]+\.mp4)[^"]+)"/g,'data-offline-src="$1"');
const bootstrap=`window.OFFLINE_ASSETS=${JSON.stringify(mapping)};\nconst offlineVars=${JSON.stringify(vars)};\nfor(const [name,variable]of Object.entries(offlineVars)){document.documentElement.style.setProperty(variable,'url("'+OFFLINE_ASSETS[name]+'")')}\nfor(const el of document.querySelectorAll('[data-offline-src]')){el.src=OFFLINE_ASSETS[el.dataset.offlineSrc]}\n`;
html=html.replace('</body>',`<script>${bootstrap}${js}</script></body>`);
const output=path.join(review,'yuhuan-guide-v9.html');
fs.writeFileSync(output,html);
console.log(output);
