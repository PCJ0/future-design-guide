import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../public/lab-ui.css',import.meta.url),'utf8');
const marker='/* Reference navy theme: visual surfaces only; geometry and motion stay unchanged. */';
const theme=css.slice(css.indexOf(marker));

test('深蓝主题使用原生渐变，未用参考截图覆盖真实界面',()=>{
  assert.ok(css.includes(marker));
  assert.match(theme,/--bg:#051123/);
  assert.match(theme,/body\{background:#051123/);
  assert.match(theme,/background-image:[\s\S]*radial-gradient[\s\S]*linear-gradient/);
  assert.doesNotMatch(theme,/url\(|@import/);
});
test('背景装饰不接收点击，也没有额外动态效果',()=>{
  assert.match(theme,/\.artboard::before,\.artboard::after\{[^}]*position:absolute[^}]*z-index:-1[^}]*pointer-events:none/);
  assert.doesNotMatch(theme,/animation|transition|filter|transform/);
});
test('非装饰规则只修改视觉属性，保留布局字体及滚动几何',()=>{
  const rules=[...theme.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const allowed=/^(--[\w-]+|color-scheme|color|background(?:-color|-image)?|border(?:-top|-bottom|-left|-right)?-color|box-shadow|scrollbar-color)$/;
  for(const [,selector,body] of rules){
    if(selector.includes('::before')||selector.includes('::after'))continue;
    for(const declaration of body.split(';').map(v=>v.trim()).filter(Boolean)){
      const property=declaration.slice(0,declaration.indexOf(':')).trim();
      assert.match(property,allowed,`越出背景改动范围：${selector.trim()} / ${property}`);
    }
  }
});
test('对话、资料、输入区和弹窗采用协调的深蓝表面',()=>{
  for(const selector of ['.artboard .bubble{','.artboard .bubble.user{','.artboard .resource-card{','.artboard .composer{','dialog{'])assert.ok(theme.includes(selector),selector);
  assert.match(theme,/\.artboard>\.lower-workspace\{background:transparent/);
  assert.match(theme,/\.artboard \.primary,\.primary\{background:var\(--cyan\)/);
});
test('删除对话栏上方左弧形，保留右上和底部背景',()=>{
  assert.doesNotMatch(theme,/\.network-stage::before|circle 52\.5cqw/);
  const lowerArc=theme.match(/^\.artboard::after\{([^}]*)\}/m)?.[1]||'';
  assert.match(lowerArc,/bottom:-101cqw/);
  assert.doesNotMatch(lowerArc,/top:84cqw|left:-43cqw|border:/);
  const upperArc=theme.match(/\.artboard::before\{([^}]*)\}/)?.[1]||'';
  assert.match(upperArc,/linear-gradient\(158deg/);
  assert.doesNotMatch(upperArc,/border:/);
});
