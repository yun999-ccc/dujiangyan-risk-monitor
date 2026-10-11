export function arrangeLabels(entries,width,height,reserved=[]) {
  const occupied=[...reserved],result=[];
  const overlap=(a,b)=>a.left<b.right+5&&a.right+5>b.left&&a.top<b.bottom+5&&a.bottom+5>b.top;
  for(const item of [...entries].sort((a,b)=>b.priority-a.priority)) {
    let box=null;
    for(const [dx,dy] of [[0,-8],[0,-34],[0,24],[-45,-8],[45,-8],[-75,24],[75,24],[0,-65]]) {
      const left=Math.max(8,Math.min(width-item.width-8,item.x-item.width/2+dx)),top=Math.max(8,Math.min(height-item.height-8,item.y-item.height+dy));
      const candidate={left,top,right:left+item.width,bottom:top+item.height};
      if(candidate.right<=width-8&&!occupied.some(r=>overlap(candidate,r))){box=candidate;break;}
    }
    if(box)occupied.push(box);result.push({...item,box});
  }
  return result;
}
