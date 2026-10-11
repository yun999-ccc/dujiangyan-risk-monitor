export const lightningDefaults={frequency:12,minutes:3,type:'云对地',region:'龙池山地',distance:1.2,style:'标准',seed:20261011};
export const lightningRegions={'龙池山地':{lon:103.565,lat:31.10},'河谷片区':{lon:103.56158,lat:31.07218},'城区片区':{lon:103.63664,lat:30.99815}};
export function randomSource(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export function normalizeLightning(c={}){const p={...lightningDefaults,...c};for(const [key,min,max] of [['frequency',0,30],['minutes',1,60],['distance',.2,3],['seed',1,2147483647]]){if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw Error('雷电参数超出范围');}if(!lightningRegions[p.region]||!['云对地','云间'].includes(p.type)||!['柔和','标准','鲜明'].includes(p.style))throw Error('雷电类型、区域或视觉档位无效');return p;}
export function generateLightning(config,exclusions=[]){
 const p=normalizeLightning(config),rand=randomSource(p.seed),count=Math.floor(p.frequency*p.minutes+1e-8),duration=p.minutes*60,interval=count?duration/count:0,center=lightningRegions[p.region],mx=111320*Math.cos(center.lat*Math.PI/180),events=[];
 for(let i=0;i<count;i++){const t=(i+.5+(rand()-.5)*.3)*interval,seed=Math.floor(rand()*2147483647)+1;let location=null;
  for(let attempt=0;attempt<32;attempt++){const r=(.2+rand()*(p.distance-.2))*1000,angle=rand()*Math.PI*2,lon=center.lon+Math.cos(angle)*r/mx,lat=center.lat+Math.sin(angle)*r/111320;const blocked=p.type==='云对地'&&exclusions.some(b=>lon>=b.west&&lon<=b.east&&lat>=b.south&&lat<=b.north);if(!blocked){location={lon,lat,distance:r/1000};break;}}
  events.push({id:i+1,t,seed,type:p.type,location,displayable:!!location});
 }
 return events;
}
export function eventsAt(events,t){let low=0,high=events.length;while(low<high){const mid=(low+high)>>1;if(events[mid].t<=t)low=mid+1;else high=mid;}return low;}
export function createLightningSession(config=lightningDefaults,clock=0,exclusions=[]){const p=normalizeLightning(config);return {version:1,config:p,events:generateLightning(p,exclusions),time:0,running:false,speed:1,warningClock:clock,eventStatus:'valid',manual:[],selected:0};}
export function channelShape(event,style='标准'){
 const rand=randomSource(event.seed),points=[],cloud=event.type==='云间';const scale=style==='柔和'?.65:style==='鲜明'?1.3:1;
 for(let i=0;i<=12;i++){const f=i/12;points.push({x:cloud?f*.7:(i===0||i===12?0:(rand()-.5)*.16*scale),y:cloud?.88+(rand()-.5)*.07:.95*(1-f),z:(i===0||(!cloud&&i===12)?0:(rand()-.5)*.13*scale)});}
 const branches=[];for(const index of [3,6,8]){const start=points[index],dir=rand()>.5?1:-1;branches.push([start,{x:start.x+dir*.09*scale,y:start.y-.04,z:start.z+.04},{x:start.x+dir*.17*scale,y:Math.max(.18,start.y-.16),z:start.z-.06}]);}
 return {points,branches};
}
