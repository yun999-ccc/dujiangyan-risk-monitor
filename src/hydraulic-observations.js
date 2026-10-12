import {gridCoordinate} from './geometry-audit.js';
export const wetThreshold=.05;
export function observationSites(data,width=48){
 const sites=[8,Math.floor(data.ny/2),data.ny-9].map((row,k)=>{let i=row*data.nx;for(let c=0;c<data.nx;c++)if(data.distance[row*data.nx+c]<data.distance[i])i=row*data.nx+c;return {id:`river-${k}`,name:['上游 A','中游 B','下游 C'][k],kind:'river',index:i,...gridCoordinate(data,i)};});
 const roads=data.roadCells.filter(i=>!data.blocked[i]&&data.distance[i]>width/2);const chosen=new Set();
 for(const [k,f] of [.25,.5,.75].entries()){let i=k===1?data.probe:roads.filter(i=>!chosen.has(i)).sort((a,b)=>Math.abs(Math.floor(a/data.nx)-data.ny*f)-Math.abs(Math.floor(b/data.nx)-data.ny*f))[0];if(i===undefined||chosen.has(i))continue;chosen.add(i);sites.push({id:`road-${k}`,name:['道路 D','道路 E','道路 F'][k],kind:'road',index:i,...gridCoordinate(data,i)});}
 return sites;
}
export function roadSampleCells(data,road){const ids=new Set();for(let k=1;k<road.points.length;k++){const a=road.points[k-1],b=road.points[k],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/(data.dx/2)));for(let j=0;j<=n;j++){const c=Math.floor((a.x+(b.x-a.x)*j/n)/data.dx+data.nx/2),r=Math.floor((a.z+(b.z-a.z)*j/n)/data.dx+data.ny/2);if(c>=0&&c<data.nx&&r>=0&&r<data.ny)ids.add(r*data.nx+c);}}return [...ids];}
export function roadImpacts(data,h,roadCells,u=[],v=[],stats=[]){return data.roads.map((road,k)=>{
 const cells=roadCells[k];let maxIndex=cells[0]??null;for(const i of cells)if(maxIndex===null||h[i]>h[maxIndex])maxIndex=i;
 const maxDepth=maxIndex===null?0:h[maxIndex],wetCells=cells.filter(i=>h[i]>=wetThreshold).length,bridge=!!road.tags.bridge&&road.tags.bridge!=='no';
 return {id:road.id,name:road.tags.name??road.tags.ref??`道路要素 ${road.id}`,bridge,maxDepth:bridge?null:maxDepth,groundDepth:maxDepth,maxIndex,speed:bridge?null:Math.hypot(u[maxIndex]??0,v[maxIndex]??0),coordinate:maxIndex===null?null:gridCoordinate(data,maxIndex),sampledCells:cells.length,wetCells:bridge?null:wetCells,firstWet:bridge?null:stats[k]?.firstWet??null,peakDepth:bridge?null:Math.max(stats[k]?.peakDepth??0,maxDepth),status:bridge?'桥面高程未知':wetCells?'模拟积水':'当前演算未积水'};
 });}
