import {observationSites,roadSampleCells,roadImpacts} from './hydraulic-observations.js';
import {validateParameters} from './hydraulic-parameters.js';
// Independent local-inertial finite-volume demonstration; not LISFLOOD-FP software.
export const method={id:'local-inertial-v3',gravity:9.81,courant:.45,dryDepth:.0001,defaultMaxStep:.0625};
export const defaults={qStart:30,qPeak:900,qEnd:20,rain:0,runoff:.6,drain:1,drainBlocked:false,width:48,bankDepth:3,initialDepth:.35,roughness:.065,tailDepth:.25,duration:1800};
export function geometry(data,p=defaults){
 const N=data.nx*data.ny,z=new Float64Array(N),channel=new Uint8Array(N);
 for(let i=0;i<N;i++){const d=data.distance[i],b=data.bank[i],half=p.width/2;channel[i]=d<=half?1:0;
  if(d<=half)z[i]=b-p.bankDepth+p.bankDepth*Math.pow(d/half,4);
  else{const edge=b+.018*(d-half),blend=Math.min(1,Math.max(0,(d-half-60)/36));z[i]=edge*(1-blend)+data.raw[i]*blend;}
 }
 return {z,channel};
}
export function hydrograph(t,p){const peak=p.duration*.4;if(t>=p.duration)return p.qEnd;return t<=peak?p.qStart+(p.qPeak-p.qStart)*t/peak:p.qPeak+(p.qEnd-p.qPeak)*(t-peak)/(p.duration-peak);}
export function inertialFlux(previous,etaA,etaB,bedA,bedB,dt,dx,n){
 const h=Math.max(0,Math.max(etaA,etaB)-Math.max(bedA,bedB));if(h<method.dryDepth)return 0;
 const q=previous/dx,slope=(etaB-etaA)/dx;
 return dx*(q-method.gravity*h*dt*slope)/(1+method.gravity*dt*n*n*Math.abs(q)/Math.pow(h,7/3));
}
export class HydraulicModel{
 constructor(data,parameters={},numerics={}){
  this.data=data;this.p=validateParameters({...defaults,...parameters});this.maxStep=numerics.maxStep??method.defaultMaxStep;if(!(this.maxStep>0&&this.maxStep<=2))throw Error('无效计算步长');
  const {nx,ny,dx}=data;this.nx=nx;this.ny=ny;this.dx=dx;this.area=dx*dx;this.N=nx*ny;Object.assign(this,geometry(data,this.p));
  this.h=new Float64Array(this.N);this.u=new Float32Array(this.N);this.v=new Float32Array(this.N);this.qx=new Float64Array(this.N);this.qz=new Float64Array(this.N);this.tailQ=new Float64Array(this.N);this.out=new Float64Array(this.N);this.scale=new Float64Array(this.N);
  this.sources=[];this.sinks=[];
  for(let i=0;i<this.N;i++){if(this.channel[i]&&!data.blocked[i]){this.h[i]=Math.min(this.p.initialDepth,Math.max(0,data.bank[i]-this.z[i]-.1));if(i<nx)this.sources.push(i);if(i>=(ny-1)*nx)this.sinks.push(i);}}
  if(!this.sources.length||!this.sinks.length)throw Error('河槽没有贯穿上下游计算边界，请调整河槽宽度');
  this.sites=observationSites(data,this.p.width);this.roadSamples=data.roads.map(r=>roadSampleCells(data,r));this.siteStats=this.sites.map(()=>({firstWet:null,lastWet:null,wetDuration:0,peakDepth:0,peakSpeed:0}));
  this.roadStats=data.roads.map(()=>({firstWet:null,peakDepth:0}));this.roadSampleTime=0;
  this.t=0;this.initial=this.volume();this.inflow=0;this.tailInflow=0;this.rainInput=0;this.rainLoss=0;this.outflow=0;this.drained=0;this.limitedFaces=0;this.totalLimitedFaces=0;this.steps=0;this.minStep=Infinity;this.lastStep=0;
 }
 volume(){let s=0;for(const h of this.h)s+=h*this.area;return s;}
 stableStep(requested){let max=Math.max(this.p.tailDepth,.001);for(const h of this.h)max=Math.max(max,h);const forcing=Math.max(this.p.qStart,this.p.qPeak,this.p.qEnd)*Math.min(requested,this.maxStep)/this.sources.length/this.area;return Math.min(requested,this.maxStep,method.courant*this.dx/Math.sqrt(method.gravity*(max+forcing)));}
 face(a,b,previous,dt){return this.data.blocked[a]||this.data.blocked[b]?0:inertialFlux(previous,this.z[a]+this.h[a],this.z[b]+this.h[b],this.z[a],this.z[b],dt,this.dx,this.p.roughness);}
 step(requested=this.maxStep){
  const dt=this.stableStep(requested);if(!(dt>0)||!Number.isFinite(dt))throw Error('无法取得有效计算步长');
  const {nx,N,h,qx,qz,out,scale,area,data}=this;
  const incoming=hydrograph(this.t+dt/2,this.p)*dt;for(const i of this.sources)h[i]+=incoming/this.sources.length/area;this.inflow+=incoming;
  const rainfall=this.p.rain/1000/3600*dt;for(let i=0;i<N;i++)if(!data.blocked[i]){h[i]+=rainfall*this.p.runoff;this.rainInput+=rainfall*area*this.p.runoff;this.rainLoss+=rainfall*area*(1-this.p.runoff);}
  out.fill(0);
  for(let i=0;i<N;i++){if(i%nx<nx-1){const q=this.face(i,i+1,qx[i],dt);qx[i]=q;out[q>0?i:i+1]+=Math.abs(q);}if(i<N-nx){const q=this.face(i,i+nx,qz[i],dt);qz[i]=q;out[q>0?i:i+nx]+=Math.abs(q);}}
  for(const i of this.sinks){const q=inertialFlux(this.tailQ[i],this.z[i]+h[i],this.z[i]+this.p.tailDepth,this.z[i],this.z[i],dt,this.dx,this.p.roughness);this.tailQ[i]=q;if(q>0)out[i]+=q;}
  // Last-resort positivity protection, reported rather than concealed.
  for(let i=0;i<N;i++)scale[i]=out[i]>0?Math.min(1,h[i]*area*.95/(out[i]*dt)):1;
  this.u.fill(0);this.v.fill(0);let limited=0;
  for(let i=0;i<N;i++){
   if(i%nx<nx-1){let q=qx[i];const donor=q>0?i:i+1;if(scale[donor]<1&&q!==0)limited++;q*=scale[donor];const dv=q*dt/area;h[i]-=dv;h[i+1]+=dv;qx[i]=q;}
   if(i<N-nx){let q=qz[i];const donor=q>0?i:i+nx;if(scale[donor]<1&&q!==0)limited++;q*=scale[donor];const dv=q*dt/area;h[i]-=dv;h[i+nx]+=dv;qz[i]=q;}
  }
  for(const i of this.sinks){let q=this.tailQ[i];if(q>0){if(scale[i]<1)limited++;q*=scale[i];this.outflow+=q*dt;}else this.tailInflow-=q*dt;this.tailQ[i]=q;h[i]-=q*dt/area;}
  if(!this.p.drainBlocked&&this.p.drain>0){let available=0;for(const i of data.roadCells)if(!data.blocked[i])available+=h[i]*area;const dv=Math.min(available,this.p.drain*dt);if(available>0)for(const i of data.roadCells)if(!data.blocked[i])h[i]-=dv*h[i]/available;this.drained+=dv;}
  for(let i=0;i<N;i++)if(h[i]>.005){const c=i%nx,r=Math.floor(i/nx);this.u[i]=((c?qx[i-1]:0)+qx[i])/(2*this.dx*h[i]);this.v[i]=((r?qz[i-nx]:0)+(r===this.ny-1?this.tailQ[i]:qz[i]))/(2*this.dx*h[i]);}
  for(let k=0;k<this.sites.length;k++){const i=this.sites[k].index,record=this.siteStats[k];record.peakDepth=Math.max(record.peakDepth,h[i]);record.peakSpeed=Math.max(record.peakSpeed,Math.hypot(this.u[i],this.v[i]));if(h[i]>=.05){if(record.firstWet===null)record.firstWet=this.t+dt;record.lastWet=this.t+dt;record.wetDuration+=dt;}}
  this.t+=dt;this.limitedFaces=limited;this.totalLimitedFaces+=limited;this.steps++;this.lastStep=dt;this.minStep=Math.min(this.minStep,dt);
  if(this.t-this.roadSampleTime>=5-1e-8){this.observeRoads();this.roadSampleTime=this.t;}
 }
 observeRoads(){for(let k=0;k<this.roadSamples.length;k++){if(this.data.roads[k].tags.bridge&&this.data.roads[k].tags.bridge!=='no')continue;let depth=0;for(const i of this.roadSamples[k])depth=Math.max(depth,this.h[i]);const s=this.roadStats[k];s.peakDepth=Math.max(s.peakDepth,depth);if(depth>=.05&&s.firstWet===null)s.firstWet=this.t;}}
 advance(target){while(this.t<target-1e-8)this.step(Math.min(this.maxStep,target-this.t));if(Math.abs(this.t-target)<1e-8)this.t=target;}
 result(){
  this.observeRoads();let maxDepth=0,maxSpeed=0,floodArea=0,channelVolume=0,maxFroude=0;for(let i=0;i<this.N;i++){const speed=Math.hypot(this.u[i],this.v[i]);maxDepth=Math.max(maxDepth,this.h[i]);maxSpeed=Math.max(maxSpeed,speed);if(this.h[i]>=.05)maxFroude=Math.max(maxFroude,speed/Math.sqrt(method.gravity*this.h[i]));if(!this.channel[i]&&this.h[i]>=.05&&!this.data.blocked[i])floodArea+=this.area;if(this.channel[i])channelVolume+=this.h[i]*this.area;}
  const stored=this.volume(),expected=this.initial+this.inflow+this.tailInflow+this.rainInput-this.outflow-this.drained;
  return {method:method.id,parameters:{...this.p},t:this.t,observations:this.sites.map((s,k)=>({...s,...this.siteStats[k],depth:this.h[s.index],speed:Math.hypot(this.u[s.index],this.v[s.index]),u:this.u[s.index],v:this.v[s.index],sectionFlow:s.kind==='river'?Array.from(this.qz.slice(Math.floor(s.index/this.nx)*this.nx,(Math.floor(s.index/this.nx)+1)*this.nx)).reduce((a,b)=>a+b,0):null})),roads:roadImpacts(this.data,this.h,this.roadSamples,this.u,this.v,this.roadStats),h:Float32Array.from(this.h),u:this.u.slice(),v:this.v.slice(),metrics:{stored,initial:this.initial,inflow:this.inflow,tailInflow:this.tailInflow,rainInput:this.rainInput,rainLoss:this.rainLoss,outflow:this.outflow,drained:this.drained,error:stored-expected,maxDepth,maxSpeed,maxFroude,floodArea,channelVolume,roadDepth:this.h[this.data.probe],roadSpeed:Math.hypot(this.u[this.data.probe],this.v[this.data.probe]),q:hydrograph(this.t,this.p),limitedFaces:this.limitedFaces,totalLimitedFaces:this.totalLimitedFaces,steps:this.steps,lastStep:this.lastStep,minStep:Number.isFinite(this.minStep)?this.minStep:0,maxStep:this.maxStep}};
 }
}
