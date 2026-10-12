// Local demonstration contract for the future warning and response clients.
// Completing a task never certifies a road safe or changes hydraulic results.
export const eventSchemaVersion=1;
export function scenarioId(method,parameters){const text=JSON.stringify([method,Object.entries(parameters).sort(([a],[b])=>a.localeCompare(b))]);let hash=2166136261;for(const c of text)hash=Math.imul(hash^c.charCodeAt(0),16777619);return `river-${(hash>>>0).toString(16)}`;}
export const workflowLabels={detected:'待人工确认',confirmed:'已确认模拟事件',assigned:'已安排模拟巡查',completed:'已记录处置反馈'};
export function syncRoadEvents(result,caseId,records=[]){
 return result.roads.filter(r=>!r.bridge&&(r.wetCells>0||r.firstWet!==null)).map(road=>{
  const id=`${caseId}-road-${road.id}`,prior=records.find(e=>e.id===id);
  const workflow=prior&&workflowLabels[prior.workflow?.status]&&Array.isArray(prior.workflow.log)?{status:prior.workflow.status,log:prior.workflow.log.filter(l=>l&&Number.isFinite(l.t)&&typeof l.action==='string').map(l=>({...l,note:String(l.note??'').slice(0,500)}))}:{status:'detected',log:[]};
  return {schemaVersion:eventSchemaVersion,id,scenarioId:caseId,riskId:'water',source:'simulation',roadId:road.id,name:road.name,t:result.t,active:road.wetCells>0,coordinate:road.coordinate,index:road.maxIndex,firstWet:road.firstWet,peakDepth:road.peakDepth,evidence:{depth:road.maxDepth,speed:road.speed,wetCells:road.wetCells,threshold:.05,units:{depth:'m',speed:'m/s'},basis:'道路中心线附近16m网格水深≥5cm；不是路面实测'},recommendation:road.wetCells>0?'核查受影响区段，演练警示和通行管控':'模拟积水已回落，仍须现场复核',route:{status:'unavailable',reason:'路网连接、桥面高程和实际通行条件未核实'},fieldCalibrated:false,workflow};
 });
}
export function transitionEvent(event,action,t,note=''){
 const next={confirm:['detected','confirmed'],assign:['confirmed','assigned'],feedback:['assigned','completed']}[action];
 if(!next||event.workflow.status!==next[0])throw Error('请按确认、巡查、反馈顺序操作');
 const text=String(note).trim().slice(0,500);if(action==='feedback'&&!text)throw Error('请先填写本次演示的处置反馈');
 return {...event,workflow:{status:next[1],log:[...event.workflow.log,{action,t,recordedAt:new Date().toISOString(),note:text}]}};
}
export function scenarioComparison(reference,result,parameters){
 if(!reference)return {available:false,reason:'请先保存一组演算结果，再修改条件进行对照。'};
 if(reference.t!==result.t)return {available:false,reason:`对照保存于${reference.t}秒；请回到同一时刻再比较。`};
 return {available:true,t:result.t,changed:Object.keys(parameters).filter(k=>parameters[k]!==reference.parameters[k]),delta:{floodArea:result.metrics.floodArea-reference.metrics.floodArea,roadDepth:result.metrics.roadDepth-reference.metrics.roadDepth,inflow:result.metrics.inflow-reference.metrics.inflow,drained:result.metrics.drained-reference.metrics.drained}};
}
