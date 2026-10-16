import {hazards} from './model.js';
import {createState,assess,fields,secondaryConfig} from './simulation.js';
const extra=(id,key)=>({...fields[id].find(f=>f.key===key),scope:'extra',source:id==='lightning'?'模拟外部预警':['inspection','surface','facility','shade'].includes(key)?'模拟人工核查':key==='external'?'模拟外部预警':'模拟环境输入'});
const secondary=id=>({key:'secondary',scope:'secondary',label:hazards.find(h=>h.id===id).secondary,unit:hazards.find(h=>h.id===id).secondUnit,...secondaryConfig(id),value:hazards.find(h=>h.id===id).secondInitial,source:'模拟采集'});
const context=(key,label,unit,min,max,value)=>({scope:'context',key,label,unit,min,max,value,source:'模拟背景，不参与等级计算'});
export const stationDefinitions={
 water:{sourceType:'sensor',label:'模拟传感器',fields:[secondary('water')],note:'点位水深与涨退速度，不是龙溪河演算结果；不反推真实流量。'},
 ice:{sourceType:'sensor',label:'模拟传感器＋巡查',fields:[secondary('ice'),extra('ice','surface'),extra('ice','inspection'),context('snowDepth','模拟积雪厚度','cm',0,40,0)],note:'温度低只提示核查；发现结冰须明确填写模拟巡查记录。雪深为背景，不是形成速率。'},
 lightning:{sourceType:'external_warning',label:'模拟外部预警',fields:[extra('lightning','validMinutes')],note:'这里上报预警等级与有效期，不测量雷击大小，不把动画频率当监测数据。自动转发不会刷新预警发布时间。'},
 wind:{sourceType:'sensor',label:'模拟传感器＋巡查',fields:[secondary('wind'),extra('wind','direction'),extra('wind','facility'),extra('wind','inspection'),context('gust','模拟阵风峰值','m/s',0,35,8)],note:'等级按基础风速和巡查；阵风是背景记录，不预测设施倒塌，不直接启动风动画。'},
 heat:{sourceType:'sensor',label:'模拟传感器＋环境记录',fields:[secondary('heat'),extra('heat','shade'),context('heatMinutes','持续高温背景','min',0,1440,30)],note:'记录温湿度与遮阴；不诊断中暑，持续时间为背景，不自动控制热浪动画。'},
 forest:{sourceType:'scenario_index',label:'模拟环境＋人为指数＋巡查',fields:[context('airTemperature','模拟环境温度','℃',-20,55,25),secondary('forest'),extra('forest','wind'),extra('forest','recentRain'),extra('forest','inspection')],note:'火险指数是人为设定的演示变量，温湿度不自动换算成正式火险指数；上报烟火不自动点燃三维模型。'},
 landslide:{sourceType:'sensor',label:'模拟位移＋巡查＋外部信息',fields:[secondary('landslide'),extra('landslide','inspection'),extra('landslide','external')],note:'记录位移、雨量和边坡异常，不据此预测真实滑坡路径或发生时间。'},
 debris:{sourceType:'sensor',label:'模拟雨量＋巡查＋外部信息',fields:[secondary('debris'),extra('debris','inspection'),extra('debris','external')],note:'降雨与沟道异常用于核查提醒，不等于泥石流发生；泥流速度、宽度等仍属于动画假定参数。'}
};
for(const [id,d] of Object.entries(stationDefinitions)){const h=hazards.find(h=>h.id===id);Object.assign(d,{id,pointId:`ST-${id.toUpperCase()}-01`,min:h.min,max:h.max,step:h.step,warning:h.warning,danger:h.danger,metric:h.metric,unit:h.unit});}
export const isStationSource=s=>typeof s==='string'&&(s.startsWith('虚拟监测站 ST-')||s==='虚拟监测盒 WATER-01');
export const stationSource=id=>`虚拟监测站 ${stationDefinitions[id].pointId}`;
export function stationDraft(id){const h=hazards.find(h=>h.id===id),d=stationDefinitions[id];if(!h||!d)throw Error('未知采集场景');const v={value:h.initial,quality:'valid',extra:{},context:{},observedAt:null};for(const f of d.fields){if(f.scope==='secondary')v.secondary=f.value;else v[f.scope][f.key]=f.value;}return v;}
function checkedNumber(v,min,max){return typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;}
export function normalizeStationSample(m,now=Date.now()){
 const d=stationDefinitions[m?.id];if(m?.schema!==2||!d||m.pointId!==d.pointId||m.sourceType!==d.sourceType||!checkedNumber(m.value,d.min,d.max)||m.id==='lightning'&&!Number.isInteger(m.value)||!['valid','missing','expired'].includes(m.quality)||!checkedNumber(m.at,0,now+2000)||!checkedNumber(m.observedAt,0,m.at+2000)||typeof m.nonce!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(m.nonce))throw Error('采集数据格式、时间或量程不正确');
 const out={schema:2,id:m.id,pointId:d.pointId,sourceType:d.sourceType,value:m.value,quality:m.quality,observedAt:m.observedAt,at:m.at,nonce:m.nonce,extra:{},context:{}};
 for(const f of d.fields){const v=f.scope==='secondary'?m.secondary:m[f.scope]?.[f.key];if(f.options?!f.options.includes(v):!checkedNumber(v,f.min,f.max))throw Error(`${f.label}不在允许范围内`);if(f.scope==='secondary')out.secondary=v;else out[f.scope][f.key]=v;}
 for(const scope of ['extra','context']){if(m[scope]===null||typeof m[scope]!=='object'||Array.isArray(m[scope]))throw Error('采集字段应为对象');for(const key of Object.keys(m[scope]))if(!d.fields.some(f=>f.scope===scope&&f.key===key))throw Error('包含未定义的采集字段');}
 return out;
}
export function makeStationSample(id,draft,{now=Date.now(),manual=true}={}){const observedAt=manual||id!=='lightning'||!Number.isFinite(draft.observedAt)?now:draft.observedAt;return normalizeStationSample({...draft,schema:2,id,pointId:stationDefinitions[id].pointId,sourceType:stationDefinitions[id].sourceType,at:now,observedAt,nonce:crypto.randomUUID()},now);}
export const stationExpiresAt=m=>m.observedAt+(m.id==='lightning'?m.extra.validMinutes*60000:10000);
export function applyStationSample(state,input,now=Date.now()){
 const m=normalizeStationSample(input,now),h=hazards.find(h=>h.id===m.id),n=state.states[m.id];
 const before=JSON.stringify([n.value,n.secondary,n.extra,n.quality,n.unknown]);
 if(state.controlMode==='scenario'){state.running=false;state.controlMode='manual';state.scenario=null;}
 n.policy={warning:h.warning,danger:h.danger};n.value=m.value;if(m.secondary!==undefined)n.secondary=m.secondary;Object.assign(n.extra,m.extra);n.track.enabled=false;if(m.id==='water')n.extra.evolution='关闭';if(m.id==='debris')n.linked=false;
 n.fault=false;n.quality=now>=stationExpiresAt(m)?'expired':m.quality;
 if(m.id==='lightning')n.signalIssuedAt=(state.lightningSession?.warningClock??state.seconds)-(now-m.observedAt)/1000;
 n.source=stationSource(m.id);n.deviceAt=m.at;n.stationExpiresAt=stationExpiresAt(m);n.stationSample=m;assess(state,m.id);
 if(!n.unknown){n.history.push({t:state.seconds,v:n.value});n.history=n.history.slice(-80);}
 if(before!==JSON.stringify([n.value,n.secondary,n.extra,n.quality,n.unknown])){state.events.unshift({time:state.seconds,hazard:m.id,text:`监测站 ${m.pointId}：${n.unknown?'数据未知':m.value+h.unit+'，已更新采集与巡查输入（模拟）'}`});state.events=state.events.slice(0,80);}
 return n;
}

export function stationAssessment(m,now=Date.now()){const s=createState();return applyStationSample(s,m,now);}
