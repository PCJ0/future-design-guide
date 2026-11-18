export const GRAPH={width:1400,height:1480,cx:660,cy:630,rx:405,ry:405,beamScale:.45};
export function point(angle){const a=angle*Math.PI/180;return {x:GRAPH.cx+Math.cos(a)*GRAPH.rx,y:GRAPH.cy+Math.sin(a)*GRAPH.ry};}
export function projectPosition(index,count){return point(count===1?75:-28+176*index/(count-1));}
export function labelLines(name,width=14,maxLines=3){const chars=Array.from(name),lines=[];for(let i=0;i<chars.length&&lines.length<maxLines;i+=width)lines.push(chars.slice(i,i+width).join(''));if(chars.length>width*maxLines)lines[maxLines-1]=lines[maxLines-1].slice(0,-1)+'…';return lines;}
export function labelPlacement(point){return {x:point.x+(point.x>=GRAPH.cx?15:-15),y:point.y-13,anchor:point.x>=GRAPH.cx?'start':'end'};}
