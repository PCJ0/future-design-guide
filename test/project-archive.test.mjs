import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProjectArchive,extractArchiveText} from '../project-archive.mjs';
const id='2020-s16';
function fixture(status=200){return async url=>{
 if(url.endsWith('catalog.json'))return Response.json([{id,summary:'来自题录的简介片段'}]);
 if(url.includes('/dossier/'))return new Response(`<a href="/inno/asset?project=${id}&amp;source=S01&amp;kind=original">原件</a>`);
 return status===200?Response.json({description:'完整原始项目介绍。'}):new Response('Unauthorized',{status});
};}
test('archive loads original content through the source link advertised on the dossier',async()=>{
 const result=await loadProjectArchive(id,{fetcher:fixture(),useCache:false});assert.equal(result.status,'available');assert.equal(result.text,'完整原始项目介绍。');
});
test('protected originals retain the public excerpt without pretending it is full text',async()=>{
 const result=await loadProjectArchive(id,{fetcher:fixture(401),useCache:false});assert.equal(result.status,'requires_auth');assert.equal(result.text,'');assert.equal(result.summary,'来自题录的简介片段');assert.ok(result.sourceUrl.includes('source=S01'));
});
test('archive does not serialize arbitrary metadata as project prose',()=>{
 assert.equal(extractArchiveText({project_id:id,review_status:'unknown'}),'');assert.equal(extractArchiveText({content:['介绍一','介绍二']}),'介绍一\n\n介绍二');
});
