import {normalizeStationSample,isStationSource} from './station-model.js';
import {cloud} from './cloud-session.js';
import {hazards} from './model.js';
export const linkPrefix='shanchuan-link-v1:';
export const messageTTL=10000;
export function validSample(m,now=Date.now()) {return !!m&&m.schema===1&&m.id==='water'&&Number.isFinite(m.value)&&m.value>=0&&m.value<=60&&['valid','missing'].includes(m.quality)&&Number.isFinite(m.at)&&m.at<=now+2000&&now-m.at<=messageTTL;}
export function writeLink(kind,value){if(cloud.enabled)return false;try{localStorage.setItem(linkPrefix+kind,JSON.stringify(value));return true}catch{return false}}
export function readLink(kind){if(cloud.enabled)return cloud.read(kind);try{return JSON.parse(localStorage.getItem(linkPrefix+kind))}catch{return null}}
export function publishState(state,source='监测模拟网页',only){
 const now=Date.now();
 for(const h of hazards){if(only&&h.id!==only)continue;const n=state.states[h.id],old=readLink(h.id),signature=`${n.unknown}:${n.level}`;
 const sensor=isStationSource(n.source)&&Number.isFinite(n.deviceAt);const at=sensor?n.deviceAt:now;const origin=sensor?n.source:source;
 if(old&&old.signature===signature&&old.value===n.value&&old.reason===n.reason&&old.source===origin&&now-old.at<2000)continue;
 const packet={schema:1,id:h.id,value:n.value,level:n.level,unknown:n.unknown,sample:n.stationSample??null,expiresAt:n.stationExpiresAt??null,lastKnownLevel:n.unknown?(old&&Object.hasOwn(old,'lastKnownLevel')?old.lastKnownLevel:old?.unknown?null:old?.level??null):n.level,reason:n.reason,action:n.action,source:origin,at,eventId:old?.signature===signature?old.eventId:globalThis.crypto.randomUUID(),signature};if(cloud.enabled){cloud.publish(h.id,packet)}else writeLink(h.id,packet);}
}
export function terminalStatus(m,now=Date.now(),offline=false){
 if(!m||m.schema!==1||!Number.isFinite(m.at)||m.at>now+2000||!Number.isFinite(m.value)||![0,1,2].includes(m.level))return {kind:'unknown',label:'尚无有效上报',needsCheck:true};
 if(offline||m.connectionLost||now-m.at>messageTTL)return {kind:'unknown',label:offline?'接收已断开 · 保留末次记录':m.connectionLost?'云连接中断 · 当前状态未知':'上报超时 · 当前状态未知',needsCheck:true};
 if(Number.isFinite(m.expiresAt)&&now>=m.expiresAt)return {kind:'unknown',label:'采集记录已过期 · 当前状态未知',needsCheck:true};
 if(m.unknown)return {kind:'unknown',label:'数据异常 · 需要核查',needsCheck:true};
 return {kind:['normal','watch','alarm'][m.level],label:['常态演示','关注核查','高风险演示'][m.level],needsCheck:m.level>0};
}

export async function submitSample(sample){if(sample?.schema===2){const m=normalizeStationSample(sample);return cloud.enabled?cloud.submitSample(m):writeLink('sample:'+m.id,m);}return cloud.enabled?cloud.submitSample(sample):writeLink('sample',sample);}
export async function submitAcknowledgement(m){return cloud.enabled?cloud.acknowledge(m):writeLink('ack',m);}
export function sharedAcknowledgements(){return cloud.enabled?cloud.acks:null;}
