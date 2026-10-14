// Deterministic visual response. Not a CFD, fabric or tree-strength solver.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
export function windConfig(n,c={}){
 const base=clamp(Number.isFinite(n.value)?n.value:0,0,35),direction=((Number.isFinite(n.extra?.direction)?n.extra.direction:0)%360+360)%360;
 return {base,direction,peak:Math.max(base,clamp(Number.isFinite(c.gustPeak)?c.gustPeak:18,0,35)),gust:c.gust===true,period:clamp(Number.isFinite(c.gustPeriod)?c.gustPeriod:12,4,60)};
}
export function sampleWindConfig(history,time){
 let result={...history.base};
 for(const e of history.changes){if(time<e.time)break;const mix=e.blend===0?1:smooth((time-e.time)/2),delta=((e.to.direction-e.from.direction+540)%360)-180;
  result={base:e.from.base+(e.to.base-e.from.base)*mix,direction:(e.from.direction+delta*mix+360)%360,peak:e.from.peak+(e.to.peak-e.from.peak)*mix,period:e.from.period+(e.to.period-e.from.period)*mix,gust:e.to.gust,gustWeight:(e.from.gustWeight??Number(e.from.gust))+(Number(e.to.gust)-(e.from.gustWeight??Number(e.from.gust)))*mix};
 }
 return result;
}
export function syncWindHistory(playback,config){
 const key=JSON.stringify(config),time=playback.time;
 if(!playback.windHistory?.base||!Array.isArray(playback.windHistory.changes)||!Number.isFinite(playback.windHistory.version)||time===0){playback.windHistory={base:{...config},changes:[],version:0};playback.windKey=key;return;}
 if(playback.windKey===key)return;
 const history=playback.windHistory,from=sampleWindConfig(history,time);history.changes=history.changes.filter(e=>e.time<time);history.changes.push({time,from,to:{...config},blend:playback.running?2:0});history.version++;playback.windKey=key;
}
export function windSpeed(config,time,duration){
 if(duration<=0||time>=duration||config.base<=0)return 0;
 const ramp=Math.min(2,duration/2),envelope=smooth(time/ramp)*smooth((duration-time)/ramp);
 const pulse=Math.pow(.5-.5*Math.cos(2*Math.PI*time/config.period),4),weight=config.gustWeight??Number(config.gust);
 return (config.base+(config.peak-config.base)*weight*pulse)*envelope;
}
const caches=new WeakMap();
function distanceAt(history,time,duration){
 let cache=caches.get(history);const key=`${history.version}:${duration}`;
 if(cache?.key!==key){cache={key,values:[0]};caches.set(history,cache);}
 const step=.25,index=Math.floor(time/step),values=cache.values;
 for(let i=values.length;i<=index;i++){const a=(i-1)*step,b=i*step,v0=windSpeed(sampleWindConfig(history,a),a,duration),v1=windSpeed(sampleWindConfig(history,b),b,duration);values.push(values[i-1]+(v0+v1)*step/2);}
 const a=index*step,v0=windSpeed(sampleWindConfig(history,a),a,duration),v1=windSpeed(sampleWindConfig(history,time),time,duration);
 return values[index]+(v0+v1)*(time-a)/2;
}
const directions=['北','东北','东','东南','南','西南','西','西北'];
export function windFrame(n,c,time=0,activated=false,history=null){
 const target=windConfig(n,c),duration=clamp(Number.isFinite(n.secondary)?n.secondary:0,0,3600),t=clamp(time,0,duration);
 history??={base:target,changes:[],version:0};const config=sampleWindConfig(history,t),speed=activated&&target.base>0?windSpeed(config,t,duration):0,a=config.direction*Math.PI/180;
 const response=clamp(speed/35,0,1),distance=activated?distanceAt(history,t,duration):0;
 return {time:t,duration,base:target.base,peak:target.peak,gust:target.gust,speed,strength:response,direction:config.direction,vector:{x:-Math.sin(a),z:Math.cos(a)},from:directions[Math.round(config.direction/45)%8],toward:directions[(Math.round(config.direction/45)+4)%8],distance,active:speed>1e-6,ended:activated&&t>=duration,phase:distance*.18,timePhase:t};
}
export function flagVertex(u,v,index,frame){
 const s=frame.strength,stretch=.10+.90*Math.sqrt(s),wave=s*(.00055+.00025*Math.sin(frame.phase*.4+index)),normal=wave*Math.sin(u*9-frame.phase*2+v*2+index)*u;
 return {along:.006*u*stretch,side:normal+(1-s)*.00012*Math.sin(u*7+v*3)*u,y:-.003*v-.0022*(1-s)*u*u+s*.00065*u*u*Math.sin(u*7-frame.phase*1.7+index+v)};
}
export function treeResponse(index,frame){
 const s=frame.strength,osc=.78+.22*Math.sin(frame.phase*.65+index*1.9);return {bend:s*.22*osc,flutter:s*.045*Math.sin(frame.phase*1.2+index*2.7)};
}
