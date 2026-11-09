import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import http from 'node:http';
test('本机服务保护配置、拒绝跨站写入和私有目录读取',async()=>{
  const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'5197'},stdio:['ignore','pipe','pipe']});
  try{await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('服务启动失败');})]);
    const base='http://127.0.0.1:5197';assert.equal((await fetch(base)).status,200);
    const config=await (await fetch(base+'/api/config')).json();assert.equal('mcpToken' in config,false);assert.equal('deepseekKey' in config,false);assert.equal('bailianKey' in config,false);
    assert.equal((await fetch(base+'/.local/config.json')).status,404);
    assert.equal((await fetch(base+'/api/config',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://outside.example'},body:'{}'})).status,403);
    const speak=await fetch(base+'/api/tts',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({text:'未经DeepSeek确定的任意文字',answerId:'not-a-real-answer'})});assert.equal(speak.status,400);assert.match((await speak.json()).error,/最终答复/);
    const outside=await new Promise((resolve,reject)=>{http.get(base,{headers:{Host:'outside.example'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});assert.equal(outside,403);
  }finally{child.kill();await once(child,'exit');}
});
