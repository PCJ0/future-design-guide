import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist');
const names=['app.js','lab-ui.js','content.js','projects.js','media-stage.js','rig.js','motion.js','voice.js','realtime.js','pcm-worklet.js'];
for(const file of names){const r=spawnSync(process.execPath,['--check',path.join(dist,file)],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
const contents=['index.html','style.css',...names].map(n=>fs.readFileSync(path.join(dist,n),'utf8')).join('\n');
for(const asset of new Set(contents.match(/assets\/[A-Za-z0-9_.-]+/g)||[]))assert(fs.existsSync(path.join(dist,asset)),`Missing asset: ${asset}`);
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(dist,'motion.js'),'utf8'),context);const M=context.window.GuideMotion;
for(const [w,h]of [[1280,720],[1512,780],[1920,1080],[390,844]]){const r=M.viewport(w,h);assert(r.x>=0&&r.y>=0&&r.x+r.width<=w+.01&&r.y+r.height<=h+.01);}
vm.runInContext(fs.readFileSync(path.join(dist,'content.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(dist,'projects.js'),'utf8'),context);
const C=context.window.LAB_CONTENT;
assert.equal(C.halls.length,3);assert.equal(C.stops.length,9);assert.equal(C.details.length,9);assert.equal(C.interview.length,4);
assert(C.projects.length>=25,'PPT project catalogue should cover each case');
assert.equal(C.profile.name,'浙江大学未来设计实验室');
assert.deepEqual(Array.from(C.intro,x=>x.text),[
 '你好，我是小 D。欢迎来到未来设计实验室。',
 '这里以创新设计、人工智能与产业领域为理念，围绕真实产业问题，探索设计研究与实践。',
 '我们以大模型为基础、以用户为中心，通过项目案例、AI 赋能和设计实践，让你了解实验室的研究方向与技术能力。',
 '接下来，你可以了解实验室的项目，也可以聊聊你的设计需求。'
]);
assert.equal(C.guide,'你想先听我介绍实验室，还是聊聊你的设计需求？直接告诉我就好。','Effective copy must not be overwritten by old content');
for(const x of [835,1115]){
 const from={x,foot:736,scale:.82},start=M.labEntry(0,from),end=M.labEntry(4600,from);
 assert.equal(start.pose.x,x);assert.equal(start.pose.walk,0);assert.equal(end.pose.x,163);assert.equal(end.pose.facing,0);assert.equal(end.pose.walk,0);
 let previous=start.pose.x;
 for(let ms=100;ms<=4600;ms+=100){const frame=M.labEntry(ms,from);assert(frame.pose.x<=previous);assert(Math.abs(frame.pose.x-previous)<50,'No abrupt jump on the entrance path');previous=frame.pose.x;}
 assert(M.labEntry(1800,from).pose.walk>.7);
}

for(const question of ['实验室有哪些研究方向？','实验室有哪些案例？','第三师45团项目建成了吗？'])assert(C.faq.some(x=>x.pattern.test(question)),`Missing offline answer: ${question}`);
const kb=[...JSON.parse(fs.readFileSync(path.join(root,'knowledge','lab-kb.json'),'utf8')),...JSON.parse(fs.readFileSync(path.join(root,'knowledge','lab-projects.json'),'utf8'))];
assert(kb.length>=10&&new Set(kb.map(x=>x.id)).size===kb.length,'Knowledge base must contain unique source-backed records');
assert(kb.every(x=>x.title&&x.content&&x.source&&x.status),'Knowledge base records must keep provenance and status');
C.stops.forEach((s,i)=>{assert.equal(s.hall,Math.floor(i/3));assert(Number.isFinite(s.focus));if(i)assert(s.position>C.stops[i-1].position)});
assert(!fs.readFileSync(path.join(dist,'index.html'),'utf8').match(/id="(mic|tourHud|questionCue|replyBubble)"/));
console.log(`PASS: JavaScript syntax, asset references, viewport fitting, nine exhibit modules, ${C.projects.length} PPT case pages, ${kb.length} sourced knowledge records, offline FAQ, and interview content.`);
const tests=spawnSync(process.execPath,['--test',path.join(root,'scripts/realtime.test.mjs')],{encoding:'utf8'});
process.stdout.write(tests.stdout);process.stderr.write(tests.stderr);assert.equal(tests.status,0,'Realtime tests failed');
