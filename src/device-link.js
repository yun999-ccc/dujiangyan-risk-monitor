import {hazards} from './model.js';
export const linkPrefix='shanchuan-link-v1:';
export const messageTTL=10000;
export function validSample(m,now=Date.now()) {return !!m&&m.schema===1&&m.id==='water'&&Number.isFinite(m.value)&&m.value>=0&&m.value<=60&&['valid','missing'].includes(m.quality)&&Number.isFinite(m.at)&&m.at<=now+2000&&now-m.at<=messageTTL;}
export function writeLink(kind,value){try{localStorage.setItem(linkPrefix+kind,JSON.stringify(value));return true}catch{return false}}
export function readLink(kind){try{return JSON.parse(localStorage.getItem(linkPrefix+kind))}catch{return null}}
export function publishState(state,source='监测模拟网页',only){
 const now=Date.now();
 for(const h of hazards){if(only&&h.id!==only)continue;const n=state.states[h.id],old=readLink(h.id),signature=`${n.unknown}:${n.level}`;
 const sensor=n.source==='虚拟监测盒 WATER-01'&&Number.isFinite(n.deviceAt);const at=sensor?n.deviceAt:now;const origin=sensor?n.source:source;
 if(old&&old.signature===signature&&old.value===n.value&&old.reason===n.reason&&old.source===origin&&now-old.at<2000)continue;
 writeLink(h.id,{schema:1,id:h.id,value:n.value,level:n.level,unknown:n.unknown,lastKnownLevel:n.unknown?(old?.lastKnownLevel??old?.level??null):n.level,reason:n.reason,action:n.action,source:origin,at,eventId:old?.signature===signature?old.eventId:globalThis.crypto.randomUUID(),signature});}
}
export function terminalStatus(m,now=Date.now(),offline=false){
 if(!m||m.schema!==1||!Number.isFinite(m.at)||m.at>now+2000||!Number.isFinite(m.value)||![0,1,2].includes(m.level))return {kind:'unknown',label:'尚无有效上报',needsCheck:true};
 if(offline||now-m.at>messageTTL)return {kind:'unknown',label:offline?'接收已断开 · 保留末次记录':'上报超时 · 当前状态未知',needsCheck:true};
 if(m.unknown)return {kind:'unknown',label:'数据异常 · 需要核查',needsCheck:true};
 return {kind:['normal','watch','alarm'][m.level],label:['常态演示','关注核查','高风险演示'][m.level],needsCheck:m.level>0};
}
