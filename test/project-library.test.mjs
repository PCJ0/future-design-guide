import test from 'node:test';
import assert from 'node:assert/strict';
import {rpc} from '../services.mjs';
import {MCP_URL,LEGACY_MCP_URL,normalizeMcpUrl,LIBRARY_ORIGIN} from '../project-library.mjs';
import {loadProjectArchive} from '../project-archive.mjs';
test('旧配置仅迁移到已核验入口，不向旧地址发送密钥',async()=>{
  const old=globalThis.fetch;let request;
  globalThis.fetch=async(url,options)=>{request={url,options};return Response.json({id:1,result:{tools:[]}});};
  try{await rpc({mcpUrl:LEGACY_MCP_URL,mcpToken:'fixture-secret'},'tools/list');assert.equal(request.url,MCP_URL);assert.equal(request.options.redirect,'manual');assert.equal(request.options.headers.Authorization,'Bearer fixture-secret');}finally{globalThis.fetch=old;}
});
test('未确认地址、路径、协议和含账号URL均在网络请求前拒绝',async()=>{
  for(const url of ['https://outside.invalid/inno/mcp/api',MCP_URL+'?destination=x',LIBRARY_ORIGIN+'/other','http://haoshejiguan.com/inno/mcp/api','https://user:pass@haoshejiguan.com/inno/mcp/api'])assert.throws(()=>normalizeMcpUrl(url),/未获确认/);
});
test('任何新重定向均停止，不向Location补发密钥',async()=>{
  const old=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response('private',{status:308,headers:{Location:'https://outside.invalid/inno/mcp/api'}});};
  try{await assert.rejects(()=>rpc({mcpUrl:MCP_URL,mcpToken:'fixture-secret'},'tools/list'),/停止转发/);assert.equal(calls,1);}finally{globalThis.fetch=old;}
});
test('档案辅助读取只用新公开入口，原件登录跳转仍标需授权',async()=>{
  const urls=[];const id='2021-c11';
  const result=await loadProjectArchive(id,{useCache:false,fetcher:async(url,options)=>{
    urls.push(url);assert.equal(options.redirect,'manual');assert.equal(options.headers,undefined);
    if(url.endsWith('catalog.json'))return Response.json([{id,summary:'已公开简介'}]);
    if(url.includes('/dossier/'))return new Response(`<a href="/inno/asset?project=${id}&amp;kind=original">原件</a>`);
    return new Response('',{status:302,headers:{Location:LIBRARY_ORIGIN+'/inno/login/'}});
  }});
  assert.ok(urls.every(url=>new URL(url).origin===LIBRARY_ORIGIN));assert.ok(urls.some(url=>new URL(url).pathname==='/dossier/'));assert.equal(result.status,'requires_auth');assert.equal(result.text,'');assert.equal(result.summary,'已公开简介');
});
