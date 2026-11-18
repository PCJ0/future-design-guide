import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../public/lab-ui.css',import.meta.url),'utf8');
const fixed=css.slice(css.indexOf('/* Fixed 9:16 width-fit canvas.'));
test('固定9:16画布按宽度显示，不随内容增高',()=>{
  assert.ok(fixed);assert.match(fixed,/\.lab-frame\{width:min\(100%,1400px\);aspect-ratio:9\/16/);
  assert.match(fixed,/\.lab-frame>\.artboard\{[^}]*height:177\.777778cqw!important[^}]*overflow:hidden/);
  assert.match(fixed,/grid-template-rows:7% 59% minmax\(0,1fr\) 9%/);
});
test('对话与资料使用可收缩定高父级和内部滚动，窄屏也不纵向撑页',()=>{
  assert.match(fixed,/\.artboard \.conversation\{[^}]*height:100%;min-height:0!important[^}]*overflow:hidden/);
  assert.match(fixed,/\.artboard \.messages\{height:0!important;min-height:0!important[^}]*overflow-y:auto/);
  assert.match(fixed,/\.artboard \.resources ul\{[^}]*flex:1 1 0%;overflow-y:auto/);
  assert.match(fixed,/\.artboard \.sources ol\{[^}]*flex:1 1 0%;overflow-y:auto/);
  assert.match(fixed,/\.artboard>\.lower-workspace\{display:grid;grid-template-columns:minmax\(0,1\.65fr\) minmax\(0,1fr\)/);
});
test('固定画布不改正圆图谱几何或思考与语音阶段',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(html,/viewBox="0 0 1400 1480" preserveAspectRatio="xMidYMid meet"/);
  assert.match(fixed,/\.artboard \.network\{[^}]*height:100%!important;width:100%!important/);
  assert.match(fixed,/\.artboard>\.composer\{height:100%!important/);
});
