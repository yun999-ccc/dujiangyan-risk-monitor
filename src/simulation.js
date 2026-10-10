import {hazards,riskLevel} from './model.js';
export const zones=['龙池山地区域','河谷居民区','平坝城区'];
const num=(key,label,unit,min,max,value,step=1)=>({key,label,unit,min,max,value,step});
const choice=(key,label,options,value)=>({key,label,options,value});
export const fields={
 water:[choice('evolution','播放时按涨退速度演算',['关闭','开启'],'关闭'),num('minutes','持续时间','min',0,1440,0)],
 ice:[choice('surface','路面情况',['未知','干燥','有水','积雪'],'未知'),choice('inspection','巡查结果',['未巡查','未发现冰','发现结冰'],'未巡查')],
 lightning:[num('validMinutes','模拟信号有效期','min',1,1440,60),choice('activity','户外活动',['未安排','进行中','已暂停'],'未安排')],
 wind:[num('direction','风向','°',0,360,0),choice('facility','待核查设施',['临时设施','树木','建筑附属设施'],'临时设施'),choice('inspection','设施巡查',['未巡查','未见异常','发现松动'],'未巡查')],
 heat:[num('minutes','户外活动时长','min',0,1440,30),choice('shade','遮阴情况',['有遮阴','无遮阴','未知'],'未知')],
 forest:[choice('recentRain','近期降雨',['有降雨','无降雨','未知'],'未知'),num('wind','背景风速','m/s',0,50,3,.5),choice('inspection','巡查记录',['未巡查','未见烟火','发现烟雾','发现火情'],'未巡查')],
 landslide:[choice('inspection','边坡巡查',['未巡查','未见异常','发现裂缝','发现掉块'],'未巡查'),choice('external','模拟外部预警',['无','需关注','加强核查'],'无')],
 debris:[choice('inspection','沟道巡查',['未巡查','未见异常','发现异常水流','发现堵塞'],'未巡查'),choice('external','模拟外部预警',['无','需关注','加强核查'],'无')]
};
export const secondaryConfig=id=>id==='water'?{min:-5,max:5,step:.1}:['landslide','debris'].includes(id)?{min:0,max:1000,step:1}:{min:0,max:id==='lightning'?1000:id==='wind'?3600:100,step:1};
const copy=v=>structuredClone(v);
export function createState(){
 const s={schemaVersion:2,ruleVersion:'演示规则 v2',selected:'water',seconds:0,running:false,speed:1,mode:'3d',layer:'terrain',controlMode:'manual',durationMinutes:30,events:[],scenario:null,
 weather:Object.fromEntries(zones.map(z=>[z,{enabled:false,rain:0,target:60,antecedent:0,cumulative:0}])),
 states:Object.fromEntries(hazards.map(h=>[h.id,{value:h.initial,secondary:h.secondInitial,fault:false,quality:'valid',unknown:false,level:0,history:[{t:0,v:h.initial}],extra:Object.fromEntries(fields[h.id].map(f=>[f.key,f.value])),policy:{warning:h.warning,danger:h.danger},track:{enabled:false,target:h.warning},linked:false,source:'手动模拟',modifiedAt:0,signalIssuedAt:0}]))};
 for(const h of hazards)assess(s,h.id);return s;
}
export function log(s,id,text){s.events.unshift({time:s.seconds,hazard:id,text});s.events=s.events.slice(0,80)}
export function assess(s,id){
 const h=hazards.find(h=>h.id===id),n=s.states[id];
 n.unknown=n.fault||n.quality!=='valid'||(id==='lightning'&&n.value>0&&s.seconds-n.signalIssuedAt>=n.extra.validMinutes*60);
 n.level=n.unknown?0:riskLevel({...h,...n.policy},n.value);
 let reason=`${h.metric} ${Number(n.value.toFixed(2))}${h.unit}；演示关注阈值 ${n.policy.warning}${h.unit}、高风险阈值 ${n.policy.danger}${h.unit}。`;
 if(id==='ice'){
  n.level=n.unknown?0:n.extra.inspection==='发现结冰'?2:n.value<=0&&['有水','积雪'].includes(n.extra.surface)?1:n.value<=n.policy.warning?1:0;
  reason=`路面 ${n.value}℃，${n.extra.surface}；巡查：${n.extra.inspection}。${n.extra.inspection==='发现结冰'?'模拟巡查记录已发现结冰，降低温度以外的输入不会自动清除该记录。':'温度仅用于核查提醒，不能确认已经结冰。'}`;
 }
 if(id==='forest'&&['发现烟雾','发现火情'].includes(n.extra.inspection)){if(!n.unknown)n.level=2;reason+=` 巡查：${n.extra.inspection}；指数降低不会清除记录。`}
 if(['landslide','debris'].includes(id)){
  if(!n.unknown&&n.extra.external!=='无')n.level=Math.max(n.level,n.extra.external==='加强核查'?2:1);
  if(!n.unknown&&n.extra.inspection!=='未巡查'&&n.extra.inspection!=='未见异常')n.level=Math.max(n.level,1);
  reason+=` 巡查：${n.extra.inspection}；外部预警：${n.extra.external}。阈值未作点位标定，不代表灾害已经发生。`;
 }
 if(id==='lightning')reason=`模拟信号：${['无信号','黄色','橙色','红色'][Math.round(n.value)]}；活动：${n.extra.activity}，${n.secondary}人；有效期 ${n.extra.validMinutes}分钟。此信号未接入气象部门。`;
 if(id==='forest')reason+=` 湿度 ${n.secondary}%，背景风速 ${n.extra.wind}m/s，近期${n.extra.recentRain}；背景条件不计算正式火险指数。`;
 if(id==='wind'&&!n.unknown&&n.extra.inspection==='发现松动')n.level=Math.max(n.level,1);
 if(id==='wind')reason+=` 风向 ${n.extra.direction}°，持续 ${n.secondary}秒；${n.extra.facility}巡查：${n.extra.inspection}。不判断设施会否倒塌。`;
 if(id==='heat')reason+=` 湿度 ${n.secondary}%，活动 ${n.extra.minutes}分钟，${n.extra.shade}。不诊断个人中暑。`;
 if(id==='water')reason+=` 涨退速度 ${n.secondary}cm/min；${n.extra.evolution==='开启'?'情景播放时演算水深。':'自动涨退已关闭。'}未使用排水模型。`;
 if(n.linked&&s.weather[h.zone].enabled)reason+=` 片区背景：雨强 ${s.weather[h.zone].rain.toFixed(1)}mm/h，过程累计 ${s.weather[h.zone].cumulative.toFixed(1)}mm。${id==='debris'?'雨量来自共享背景，不代表发生泥石流。':'仅作背景，不自动改变主指标。'}`;
 n.action=n.unknown?'核查数据来源和现场状态，不能按正常数据使用。':h.action;
 if(id==='forest'&&['发现烟雾','发现火情'].includes(n.extra.inspection))n.action='通知现场负责人核查烟火，按现场应急制度响应。';
 if(id==='ice'&&n.extra.inspection==='发现结冰')n.action='安排路段警示与现场处理，新的巡查记录确认后再更新状态。';
 if(id==='wind'&&n.extra.inspection==='发现松动')n.action='通知负责人检查并处理已上报的松动设施，风速回落不清除巡查记录。';
 n.reason=n.unknown?'数据中断、过期或缺失；当前状态未知，需要核查。':reason;
}
function refresh(s,id,history=true){const n=s.states[id],prev=n.level,unknown=n.unknown;assess(s,id);if(prev!==n.level||unknown!==n.unknown)log(s,id,`${hazards.find(h=>h.id===id).name}：${n.unknown?'数据未知':n.level===2?'高风险演示':n.level===1?'关注核查':'常态演示'}`);if(history&&!n.unknown){n.history.push({t:s.seconds,v:n.value});n.history=n.history.slice(-80)}}
function override(s,id){const n=s.states[id];n.track.enabled=false;if(id==='water')n.extra.evolution='关闭';n.source='手动模拟';n.modifiedAt=s.seconds;if(id==='debris')n.linked=false;if(s.scenario){s.scenario.baseline.states[id]=copy(n);s.scenario.baseline.states[id].history=[{t:0,v:n.value}]} }
export function updateValue(s,id,value){const h=hazards.find(h=>h.id===id);if(!h||!Number.isFinite(value))return;const n=s.states[id];n.value=Math.max(h.min,Math.min(h.max,value));if(id==='lightning'){n.value=Math.round(n.value);n.signalIssuedAt=s.seconds}override(s,id);refresh(s,id);log(s,id,`${h.name}主参数设为 ${n.value}${h.unit}；退出该项自动轨迹`)}
export function updateNode(s,id,key,value){const n=s.states[id];if(key==='secondary'){if(!Number.isFinite(value))return;const c=secondaryConfig(id);n.secondary=Math.max(c.min,Math.min(c.max,value))}else if(key==='quality')n.quality=value;else if(key==='fault')n.fault=value;else{const f=fields[id].find(f=>f.key===key);if(!f)return;if(f.options){if(!f.options.includes(value))return}else{if(!Number.isFinite(value))return;value=Math.max(f.min,Math.min(f.max,value))}n.extra[key]=value}
 n.source='手动模拟';n.modifiedAt=s.seconds;if(s.scenario){const base=s.scenario.baseline.states[id];if(['secondary','quality','fault'].includes(key))base[key]=n[key];else base.extra[key]=n.extra[key];}refresh(s,id);log(s,id,`${hazards.find(h=>h.id===id).name}：更新模拟输入 ${key}`);
}
export function setPolicy(s,id,warning,danger){const h=hazards.find(h=>h.id===id);if(![warning,danger].every(Number.isFinite)||warning<h.min||warning>h.max||danger<h.min||danger>h.max||(h.inverse?warning<=danger:warning>=danger))return false;s.states[id].policy={warning,danger};if(s.scenario)s.scenario.baseline.states[id].policy={warning,danger};refresh(s,id,false);log(s,id,'修改演示阈值（未经点位标定）');return true}
export function applyPreset(s,id,level){const h=hazards.find(h=>h.id===id),n=s.states[id];n.fault=false;n.quality='valid';if(id==='ice'){n.extra.surface=level?'有水':'干燥';n.extra.inspection=level===2?'发现结冰':'未巡查'}if(id==='forest')n.extra.inspection='未巡查';if(['landslide','debris'].includes(id)){n.extra.inspection='未巡查';n.extra.external='无'}updateValue(s,id,[h.initial,n.policy.warning,n.policy.danger][level]);}
export function prepareScenario(s){s.running=false;s.seconds=0;s.controlMode='scenario';s.events=[];for(const h of hazards){s.states[h.id].signalIssuedAt=0;s.states[h.id].history=[{t:0,v:s.states[h.id].value}];s.states[h.id].modifiedAt=0;}for(const w of Object.values(s.weather))w.cumulative=0;s.scenario={duration:Math.max(60,Math.min(7200,s.durationMinutes*60)),baseline:{states:copy(s.states),weather:copy(s.weather)}};log(s,'scenario','情景已生成；1秒播放 = 1秒模拟，速度只改变时间推进');seekScenario(s,0);}
export function seekScenario(s,seconds){if(!s.scenario)return;const {baseline,duration}=s.scenario;const oldTime=s.seconds;s.seconds=Math.max(0,Math.min(duration,seconds));if(s.seconds<oldTime)for(const n of Object.values(s.states))n.history=n.history.filter(p=>p.t<=s.seconds);const t=s.seconds/duration;
 for(const z of zones){const base=baseline.weather[z],w=s.weather[z];w.rain=base.enabled?base.rain+(base.target-base.rain)*t:base.rain;w.cumulative=base.enabled?(base.rain+w.rain)/2*s.seconds/3600:0;}
 for(const h of hazards){const n=s.states[h.id],base=baseline.states[h.id];if(n.fault||n.quality!=='valid'){refresh(s,h.id,false);continue}n.value=base.track.enabled?base.value+(base.track.target-base.value)*t:base.value;n.source=base.track.enabled?'情景轨迹':'手动模拟';if(h.id==='lightning')n.value=Math.round(n.value);
  if(h.id==='water'&&!base.track.enabled&&base.extra.evolution==='开启'){n.value=base.value+base.secondary*s.seconds/60;n.source='涨退速度演算'}
  const w=s.weather[h.zone];if(n.linked&&w.enabled){if(h.id==='debris'){n.value=w.rain;n.secondary=baseline.weather[h.zone].antecedent+w.cumulative;n.source='片区共享降雨'}if(h.id==='landslide')n.secondary=baseline.weather[h.zone].antecedent+w.cumulative;}
  n.value=Math.max(h.min,Math.min(h.max,n.value));refresh(s,h.id);
 }
 if(s.seconds>=duration)s.running=false;
}
export function rewindScenario(s){s.running=false;if(!s.scenario)return;for(const h of hazards)s.states[h.id]=copy(s.scenario.baseline.states[h.id]);s.weather=copy(s.scenario.baseline.weather);s.events=[];seekScenario(s,0);log(s,'scenario','回到情景起点，可重播同一组输入');}
export function tick(s){const next=s.seconds+s.speed;if(s.controlMode==='scenario'&&s.scenario){seekScenario(s,next)}else{s.seconds=next;for(const h of hazards)refresh(s,h.id)}}
