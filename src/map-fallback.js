import {hazards,levels} from './model.js';
export function createMapFallback(container,terrain,getState,onSelect){
 const b=terrain.bounds,n=terrain.size,canvas=document.createElement('canvas');canvas.width=canvas.height=n;
 const context=canvas.getContext('2d');let image='';
 if(context){const pixels=context.createImageData(n,n),stops=[[650,[218,212,177]],[850,[164,184,123]],[1300,[111,142,88]],[1800,[95,122,80]],[2300,[146,146,122]],[3100,[196,189,162]]];
  for(let i=0;i<terrain.heights.length;i++){const h=terrain.heights[i];let k=0;while(k<stops.length-2&&h>stops[k+1][0])k++;const t=Math.max(0,Math.min(1,(h-stops[k][0])/(stops[k+1][0]-stops[k][0])));for(let c=0;c<3;c++)pixels.data[i*4+c]=Math.round(stops[k][1][c]*(1-t)+stops[k+1][1][c]*t);pixels.data[i*4+3]=255;}
  context.putImageData(pixels,0,0);image=canvas.toDataURL();
 }
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('fallback-map');svg.setAttribute('viewBox','0 0 700 500');svg.setAttribute('role','img');svg.setAttribute('aria-label','公开DEM二维高程概览与风险点位');
 svg.innerHTML=`<rect width="700" height="500" fill="#e9efdf"/>${image?`<image href="${image}" x="25" y="30" width="650" height="410" preserveAspectRatio="none"/>`:''}<rect x="20" y="448" width="660" height="36" rx="6" fill="#fffffff0"/><text x="350" y="471" text-anchor="middle" fill="#355f48" font-size="13">三维渲染不可用 · 当前为公开高程二维概览</text>`;
 const dots=[];
 for(const h of hazards){const x=(h.lon-b.west)/(b.east-b.west)*650+25,y=(b.north-h.lat)/(b.north-b.south)*410+30,g=document.createElementNS(svg.namespaceURI,'g');g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label',h.name);g.dataset.fallbackHazard=h.id;
  g.innerHTML=`<circle cx="${x}" cy="${y}" r="8" stroke="#fff" stroke-width="2"/><rect x="${x+12}" y="${y-12}" width="86" height="26" rx="4" fill="#ffffffed"/><text x="${x+18}" y="${y+6}" font-size="12" fill="#355f48">${h.name}</text>`;g.onclick=()=>onSelect(h.id);g.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();onSelect(h.id);}};svg.append(g);dots.push({g,id:h.id});
 }
 container.prepend(svg);let disposed=false,last=0;
 function frame(now){if(disposed)return;requestAnimationFrame(frame);if(now-last<300)return;last=now;for(const {g,id} of dots){const node=getState().states[id];g.firstElementChild.setAttribute('fill',node.unknown?'#8f9692':levels[node.level].color);g.setAttribute('aria-pressed',String(id===getState().selected));}}
 requestAnimationFrame(frame);
 return {terrain,backend:'二维降级示意',setMode(){},reset(){svg.setAttribute('viewBox','0 0 700 500');},zoom(factor){const [x,y,w,h]=svg.getAttribute('viewBox').split(' ').map(Number),next=Math.max(100,Math.min(1000,w*factor));svg.setAttribute('viewBox',`${x+(w-next)/2} ${y+(h-next*5/7)/2} ${next} ${next*5/7}`);},focus(id){const item=hazards.find(h=>h.id===id);if(item){const x=(item.lon-b.west)/(b.east-b.west)*650+25,y=(b.north-item.lat)/(b.north-b.south)*410+30;svg.setAttribute('viewBox',`${x-180} ${y-130} 360 260`);}},region(){this.reset();},layer(){},dispose(){disposed=true;svg.remove();}};
}
