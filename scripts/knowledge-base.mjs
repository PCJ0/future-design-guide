import {readFile} from 'node:fs/promises';
import path from 'node:path';

const stop=new Set(['我们','你们','他们','实验室','介绍','一下','什么','哪些','怎么','如何','请问','想知道','关于','这个','那个','是否','主要','可以','吗','呢','的','了','和','与','在','是','有','做','想','吗','一下']);
const aliases=[
  [/介绍.{0,8}实验室|实验室.{0,8}介绍|实验室是什么|实验室简介|实验室定位/,'实验室定位'],
  [/衣服|服装|穿搭|换装/,'服饰'],
  [/方向|主攻|研究什么|做什么/,'研究方向'],
  [/案例|项目|成果|做过/,'案例'],
  [/仓库|库存|存货|非标品/,'多模态库存检索'],
  [/智慧商圈|客流|门店/,'视觉感知'],
  [/AI转型|企业人工智能/,'企业AI'],
  [/新疆|图木舒克|第三师/,'45团项目']
];
const normalize=s=>String(s||'').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');

function makeTerms(query,lexicon){
  let q=normalize(query);if(!q)return [];
  const out=new Map();
  const add=(term,weight=1,strong=false)=>{term=normalize(term);if(term.length<2||stop.has(term))return;const old=out.get(term);out.set(term,{weight:Math.max(weight,old?.weight||0),strong:strong||!!old?.strong});};
  for(const [pattern,canonical] of aliases)if(pattern.test(q))add(canonical,3.2,true);
  for(const phrase of lexicon)if(phrase.length>=2&&q.includes(phrase))add(phrase,3.5,true);
  const latin=q.match(/[a-z0-9]+/g)||[];latin.forEach(t=>add(t,2.5,true));
  const chars=[...q].filter(c=>/[\u3400-\u9fff]/u.test(c));
  for(let n of [3,2])for(let i=0;i<=chars.length-n;i++)add(chars.slice(i,i+n).join(''),n===3?1.2:0.8,false);
  return [...out].map(([term,value])=>({term,...value}));
}

export async function loadKnowledgeBase(root){
  const file=path.join(root,'knowledge','lab-kb.json');
  const docs=[...JSON.parse(await readFile(file,'utf8')),...JSON.parse(await readFile(path.join(root,'knowledge','lab-projects.json'),'utf8'))];
  if(!Array.isArray(docs)||docs.length<1||docs.some(d=>!d.id||!d.title||!d.content||!d.source||!d.status))throw new Error('本地知识库格式无效。');
  const lexicon=[...new Set(docs.flatMap(d=>[d.title,...(d.tags||[])].map(normalize)))].sort((a,b)=>b.length-a.length);
  const indexed=docs.map(doc=>({doc,title:normalize(doc.title),tags:normalize((doc.tags||[]).join(' ')),body:normalize(doc.content)}));
  return {docs,lexicon,indexed,dfCache:new Map()};
}

export function searchKnowledge(query,kb,{limit=3,maxChars=800}={}){
  const terms=makeTerms(query,kb.lexicon);
  if(!terms.length)return [];
  const ranked=kb.indexed.map(({doc,title,tags,body})=>{
    let score=0,matched=0,strongMatches=0;
    for(const {term,weight,strong} of terms){
      const inTitle=title.includes(term),inTags=tags.includes(term),inBody=body.includes(term);
      if(!inTitle&&!inTags&&!inBody)continue;
      matched++;
      if(strong)strongMatches++;
      let df=kb.dfCache.get(term);
      if(df===undefined){df=kb.indexed.reduce((n,d)=>n+((d.title.includes(term)||d.tags.includes(term)||d.body.includes(term))?1:0),0);kb.dfCache.set(term,df);}
      const idf=Math.log(1+(kb.docs.length+0.5)/(df+0.5));
      score+=weight*idf*((inTitle?3.2:0)+(inTags?2.4:0)+(inBody?1:0));
    }
    const softTerms=terms.filter(t=>!t.strong).length;
    return {doc,score,matched,strongMatches,coverage:softTerms?(matched-strongMatches)/softTerms:1};
  }).filter(x=>x.score>0&&(x.strongMatches>0||(x.matched>=2&&x.coverage>=0.3)))
    .sort((a,b)=>b.score-a.score||b.coverage-a.coverage);
  if(!ranked.length)return [];
  const best=ranked[0].score;
  return ranked.filter(x=>x.score>=Math.max(1.8,best*0.68)).slice(0,Math.max(1,Math.min(5,limit))).map(({doc,score})=>({
    title:doc.title,
    excerpt:doc.content.slice(0,maxChars),
    source:doc.source,
    slides:doc.slides,
    status:doc.status,
    score:Number(score.toFixed(2))
  }));
}

export function formatKnowledgeResult(results){
  if(!results.length)return JSON.stringify({found:false,message:'本地资料中没有找到足以回答该问题的内容。请说明资料尚未确认，不要用模型常识补写实验室事实。'});
  return JSON.stringify({found:true,results:results.map(({title,excerpt,source,slides,status})=>({title,excerpt,source,slides,status}))});
}
