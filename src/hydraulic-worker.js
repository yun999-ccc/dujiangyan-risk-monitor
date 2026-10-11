import {HydraulicModel} from './hydraulic-model.js';
let data,model,epoch=0;
self.onmessage=async({data:m})=>{
 if(m.type==='init'){data=m.data;return;}
 const id=++epoch;
 try{
  if(m.type==='reset'||!model||m.target<model.t||m.parameters)model=new HydraulicModel(data,m.parameters??model?.p);
  const target=m.target??0;
  while(model.t<target-1e-8){if(id!==epoch)return;const end=Math.min(target,model.t+30);model.advance(end);if(id!==epoch)return;self.postMessage({type:'progress',id:m.id,t:model.t,target});await new Promise(r=>setTimeout(r,0));}
  const result=model.result();self.postMessage({type:'result',id:m.id,...result},[result.h.buffer,result.u.buffer,result.v.buffer]);
 }catch(e){self.postMessage({type:'error',id:m.id,message:e.message});}
};
