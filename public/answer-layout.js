// Group numbered directions and their source cards together for every response path.
// Unassigned sources in a multi-direction paragraph require an explicit name/ID mention.
export function groupAnswerDirections(segments){
  const heading=/(?:^|\n)[ \t]*(?=(?:第[一二三四五六七八九十\d]+[条项个]|方向[一二三四五六七八九十\d]+|[一二三四五六七八九十\d]+[、.．）)]|[（(][一二三四五六七八九十\d]+[）)]))/g;
  const startsDirection=/^(?:第[一二三四五六七八九十\d]+[条项个]|方向[一二三四五六七八九十\d]+|[一二三四五六七八九十\d]+[、.．）)]|[（(][一二三四五六七八九十\d]+[）)])/;
  const groups=[];
  for(const segment of segments||[]){
    const text=String(segment.text||'').trim();if(!text)continue;
    const parts=text.split(heading).map(x=>x.trim()).filter(Boolean);
    const multiple=parts.filter(x=>startsDirection.test(x)).length>1;
    for(const part of parts){
      const projects=(segment.projects||[]).filter(p=>!multiple||(p.name&&part.includes(p.name))||(p.id&&part.includes(p.id)));
      const previous=groups.at(-1);
      if(previous&&!startsDirection.test(part)&&previous.direction){previous.text+='\n\n'+part;previous.projects.push(...projects);}
      else groups.push({text:part,projects:[...projects],direction:startsDirection.test(part)});
    }
  }
  return groups.map(({text,projects})=>({text,projects:[...new Map(projects.map(p=>[p.id||p.name,p])).values()]}));
}
