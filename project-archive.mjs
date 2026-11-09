const origin='https://opendesign.cc';
const cache=new Map();let catalogCache=null;
async function responseText(response){
 let size=0,text='';const decoder=new TextDecoder();for await(const chunk of response.body){size+=chunk.length;if(size>2_500_000)throw Error('资料文件过大');text+=decoder.decode(chunk,{stream:true});}return text+decoder.decode();
}
export function extractArchiveText(value){
 if(typeof value==='string')return value.trim();
 if(Array.isArray(value))return value.map(extractArchiveText).filter(Boolean).join('\n\n');
 if(!value||typeof value!=='object')return '';
 for(const key of ['description','introduction','content','text','summary','介绍','项目介绍','详细介绍']){const text=extractArchiveText(value[key]);if(text)return text;}
 return '';
}
export async function loadProjectArchive(projectId,{fetcher=fetch,useCache=true}={}){
 if(!/^[\w-]+$/.test(projectId))throw Error('项目编号无效');
 if(useCache&&cache.get(projectId)?.until>Date.now())return cache.get(projectId).data;
 const pageUrl=`${origin}/inno/dossier/?project=${encodeURIComponent(projectId)}`;
 const result={status:'unavailable',summary:'',text:'',pageUrl,sourceUrl:null};
 const get=url=>fetcher(url,{signal:AbortSignal.timeout(10000),redirect:'error'});
 try{
  let rows;if(useCache&&catalogCache?.until>Date.now())rows=catalogCache.rows;
  else{const r=await get(origin+'/inno/portal/catalog.json');if(r.ok){rows=JSON.parse(await responseText(r));if(useCache)catalogCache={rows,until:Date.now()+900000};}}
  const entry=Array.isArray(rows)?rows.find(x=>x.id===projectId):null;result.summary=typeof entry?.summary==='string'?entry.summary.trim():'';
  const page=await get(pageUrl);if(!page.ok){result.status=[401,403].includes(page.status)?'requires_auth':'unavailable';return result;}
  const html=await responseText(page);
  const links=[...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
  const asset=links.map(link=>{try{return new URL(link,origin);}catch{return null;}}).find(u=>u?.origin===origin&&u.pathname==='/inno/asset'&&u.searchParams.get('project')===projectId&&u.searchParams.get('kind')==='original');
  if(asset){
   result.sourceUrl=asset.href;const raw=await get(asset.href);
   if([401,403].includes(raw.status))result.status='requires_auth';
   else if(raw.ok){const type=raw.headers.get('content-type')||'';
    if(/json|text\/plain/.test(type)){const body=await responseText(raw);try{result.text=extractArchiveText(JSON.parse(body));}catch{if(type.includes('text/plain'))result.text=body.trim();}result.status=result.text?'available':'unsupported';}
    else result.status='unsupported';
   }
  }else result.status=result.summary?'summary_only':'unavailable';
 }catch{result.status=result.summary?'summary_only':'unavailable';}
 if(useCache)cache.set(projectId,{data:result,until:Date.now()+900000});
 return result;
}
