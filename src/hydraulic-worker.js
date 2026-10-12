import {HydraulicModel} from './hydraulic-model.js';
let data,model,epoch=0,history=[];
self.onmessage=async({data:m})=>{
 if(m.type==='init'){data=m.data;return;}
 const id=++epoch;if(m.type==='cancel')return;
 try{
  if(m.type==='compare'){
   const runs=[];
   for(const maxStep of [.125,.0625,.03125]){const sample=new HydraulicModel(data,m.parameters,{maxStep});while(sample.t<m.target-1e-8){if(id!==epoch)return;sample.advance(Math.min(m.target,sample.t+30));self.postMessage({type:'progress',id:m.id,t:sample.t,target:m.target,comparisonStep:maxStep});await new Promise(r=>setTimeout(r,0));}runs.push({maxStep,metrics:sample.result().metrics,h:sample.h.slice()});}
   const reference=runs.at(-1),comparison=runs.map(r=>{let maxDepthDifference=0,meanDepthDifference=0;for(let i=0;i<r.h.length;i++){const d=Math.abs(r.h[i]-reference.h[i]);maxDepthDifference=Math.max(maxDepthDifference,d);meanDepthDifference+=d/r.h.length;}return {maxStep:r.maxStep,metrics:r.metrics,maxDepthDifference,meanDepthDifference};});
   self.postMessage({type:'comparison',id:m.id,target:m.target,parameters:m.parameters,comparison});return;
  }
  if(m.type==='reset'||!model||m.target<model.t||m.parameters){model=new HydraulicModel(data,m.parameters??model?.p);history=[];}
  const target=m.target??0;
  while(model.t<target-1e-8){if(id!==epoch)return;const end=Math.min(target,Math.floor(model.t/30+1)*30);model.advance(end);if(id!==epoch)return;const r=model.result();if(model.t%30<1e-7){history.push({t:model.t,sites:r.observations.map(s=>({id:s.id,depth:s.depth,speed:s.speed}))});if(history.length>250)history.shift();}self.postMessage({type:'progress',id:m.id,t:model.t,target});await new Promise(r=>setTimeout(r,0));}
  const result=model.result();self.postMessage({type:'result',id:m.id,...result,history},[result.h.buffer,result.u.buffer,result.v.buffer]);
 }catch(e){self.postMessage({type:'error',id:m.id,message:e.message});}
};
