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
export class HydraulicModel{
 constructor(data,parameters={}){
  this.data=data;this.p={...defaults,...parameters};const {nx,ny,dx}=data;this.nx=nx;this.ny=ny;this.dx=dx;this.area=dx*dx;this.N=nx*ny;Object.assign(this,geometry(data,this.p));
  this.h=new Float64Array(this.N);this.u=new Float32Array(this.N);this.v=new Float32Array(this.N);this.qx=new Float64Array(this.N);this.qz=new Float64Array(this.N);this.out=new Float64Array(this.N);this.scale=new Float64Array(this.N);
  this.sources=[];this.sinks=[];
  for(let i=0;i<this.N;i++){if(this.channel[i]&&!data.blocked[i]){this.h[i]=Math.min(this.p.initialDepth,Math.max(0,data.bank[i]-this.z[i]-.1));if(i<nx)this.sources.push(i);if(i>=(ny-1)*nx)this.sinks.push(i);}}
  if(!this.sources.length||!this.sinks.length)throw Error('河槽没有贯穿上下游计算边界，请调整河槽宽度');
  this.t=0;this.initial=this.volume();this.inflow=0;this.rainInput=0;this.rainLoss=0;this.outflow=0;this.drained=0;this.limitedFaces=0;
 }
 volume(){let s=0;for(const h of this.h)s+=h*this.area;return s;}
 flux(a,b){if(this.data.blocked[a]||this.data.blocked[b])return 0;const ea=this.z[a]+this.h[a],eb=this.z[b]+this.h[b],delta=ea-eb;if(Math.abs(delta)<1e-9)return 0;const donor=delta>0?a:b;if(this.h[donor]<1e-7)return 0;const head=Math.max(0,Math.max(ea,eb)-Math.max(this.z[a],this.z[b]));if(head<=0)return 0;return Math.sign(delta)*Math.pow(head,5/3)/this.p.roughness*Math.sqrt(Math.abs(delta)/this.dx)*this.dx;}
 step(dt=.5){
  dt=Math.min(.5,Math.max(.001,dt));const {nx,ny,N,h,qx,qz,out,scale,area,data}=this;
  const incoming=hydrograph(this.t+dt/2,this.p)*dt;for(const i of this.sources)h[i]+=incoming/this.sources.length/area;this.inflow+=incoming;
  const rainfall=this.p.rain/1000/3600*dt;for(let i=0;i<N;i++)if(!data.blocked[i]){h[i]+=rainfall*this.p.runoff;this.rainInput+=rainfall*area*this.p.runoff;this.rainLoss+=rainfall*area*(1-this.p.runoff);}
  out.fill(0);qx.fill(0);qz.fill(0);
  for(let i=0;i<N;i++){const c=i%nx;if(c<nx-1){const q=this.flux(i,i+1);qx[i]=q;out[q>0?i:i+1]+=Math.abs(q);}if(i<N-nx){const q=this.flux(i,i+nx);qz[i]=q;out[q>0?i:i+nx]+=Math.abs(q);}}
  for(let i=0;i<N;i++)scale[i]=out[i]>0?Math.min(1,h[i]*area*.35/(out[i]*dt)):1;
  this.u.fill(0);this.v.fill(0);let limited=0;
  for(let i=0;i<N;i++){
   if(i%nx<nx-1){let q=qx[i];const donor=q>0?i:i+1;if(scale[donor]<1&&q!==0)limited++;q*=scale[donor];const dv=q*dt/area;h[i]-=dv;h[i+1]+=dv;qx[i]=q;}
   if(i<N-nx){let q=qz[i];const donor=q>0?i:i+nx;if(scale[donor]<1&&q!==0)limited++;q*=scale[donor];const dv=q*dt/area;h[i]-=dv;h[i+nx]+=dv;qz[i]=q;}
  }
  // Fixed-stage, outward-only downstream boundary. No unaccounted tailwater inflow.
  for(const i of this.sinks){const head=h[i]-this.p.tailDepth;if(head>0){const q=Math.pow(h[i],5/3)/this.p.roughness*Math.sqrt(head/this.dx)*this.dx;const dv=Math.min(h[i]*area*.35,q*dt);h[i]-=dv/area;this.outflow+=dv;}}
  if(!this.p.drainBlocked&&this.p.drain>0){let available=0;for(const i of data.roadCells)if(!data.blocked[i])available+=h[i]*area;const dv=Math.min(available,this.p.drain*dt);if(available>0)for(const i of data.roadCells)if(!data.blocked[i])h[i]-=dv*h[i]/available;this.drained+=dv;}
  for(let i=0;i<N;i++)if(h[i]>.005){const c=i%nx,r=Math.floor(i/nx);this.u[i]=((c?qx[i-1]:0)+qx[i])/(2*this.dx*h[i]);this.v[i]=((r?qz[i-nx]:0)+qz[i])/(2*this.dx*h[i]);}
  this.t+=dt;this.limitedFaces=limited;
 }
 advance(target){while(this.t<target-1e-8)this.step(Math.min(.5,target-this.t));}
 result(){
  let maxDepth=0,maxSpeed=0,floodArea=0,channelVolume=0;for(let i=0;i<this.N;i++){maxDepth=Math.max(maxDepth,this.h[i]);maxSpeed=Math.max(maxSpeed,Math.hypot(this.u[i],this.v[i]));if(!this.channel[i]&&this.h[i]>.05&&!this.data.blocked[i])floodArea+=this.area;if(this.channel[i])channelVolume+=this.h[i]*this.area;}
  const stored=this.volume(),expected=this.initial+this.inflow+this.rainInput-this.outflow-this.drained;
  return {t:this.t,h:Float32Array.from(this.h),u:this.u.slice(),v:this.v.slice(),metrics:{stored,initial:this.initial,inflow:this.inflow,rainInput:this.rainInput,rainLoss:this.rainLoss,outflow:this.outflow,drained:this.drained,error:stored-expected,maxDepth,maxSpeed,floodArea,channelVolume,roadDepth:this.h[this.data.probe],roadSpeed:Math.hypot(this.u[this.data.probe],this.v[this.data.probe]),q:hydrograph(this.t,this.p),limitedFaces:this.limitedFaces}};
 }
}
