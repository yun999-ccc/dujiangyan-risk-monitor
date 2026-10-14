import test from 'node:test';import assert from 'node:assert/strict';
import {windConfig,windFrame,syncWindHistory,flagVertex,treeResponse} from '../src/wind-model.js';
const node=(value=15,direction=0,duration=30)=>({value,secondary:duration,extra:{direction}});
test('0/5/15/30 m/s同一阶段产生递增响应，零风速和零时长均无风',()=>{
 const frames=[0,5,15,30].map(v=>windFrame(node(v),{},10,true));assert.equal(frames[0].active,false);for(let i=1;i<frames.length;i++){assert.ok(frames[i].speed>frames[i-1].speed);assert.ok(frames[i].distance>frames[i-1].distance);assert.ok(treeResponse(0,frames[i]).bend>treeResponse(0,frames[i-1]).bend);}
 assert.equal(windFrame(node(30,0,0),{},0,true).speed,0);assert.equal(windFrame(node(0),{gust:true,gustPeak:35},6,true).speed,0);
});
test('来向与吹向四个主方向一致，度数循环且配置有界',()=>{
 for(const [a,x,z] of [[0,0,1],[90,-1,0],[180,0,-1],[270,1,0]]){const f=windFrame(node(15,a),{},10,true);assert.ok(Math.abs(f.vector.x-x)<1e-12);assert.ok(Math.abs(f.vector.z-z)<1e-12);}
 assert.equal(windConfig(node(30,-90),{gustPeak:18,gustPeriod:0}).direction,270);assert.equal(windConfig(node(30),{gustPeak:18}).peak,30);assert.equal(windConfig(node(15),{gustPeriod:0}).period,4);
});
test('阵风可选，峰值不低于基础风；同一参数与时间严格可重复',()=>{
 const n=node(5,90,120),c={gust:true,gustPeak:30,gustPeriod:12};assert.equal(windFrame(n,c,6,true).speed,30);assert.equal(windFrame(n,c,12,true).speed,5);assert.equal(windFrame(n,{},6,true).speed,5);
 assert.deepEqual(windFrame(n,c,17.5,true),windFrame(n,c,17.5,true));assert.equal(windFrame(n,c,0,false).speed,0);
});
test('30/120秒过程结束前回落，到终点风速与树冠摆幅均为零',()=>{
 for(const duration of [30,120]){const n=node(30,0,duration);assert.equal(windFrame(n,{},duration-2,true).speed,30);assert.ok(windFrame(n,{},duration-1,true).speed<30);const f=windFrame(n,{},duration,true);assert.equal(f.speed,0);assert.equal(treeResponse(0,f).bend,0);assert.equal(f.ended,true);}
});
test('播放中改风速来向两秒过渡，位移连续且拖动可重现历史',()=>{
 const p={time:0,running:true};syncWindHistory(p,windConfig(node(5)));p.time=10;const before=windFrame(node(5),{},10,true,p.windHistory);syncWindHistory(p,windConfig(node(30,90)));
 const start=windFrame(node(30,90),{},10,true,p.windHistory),middle=windFrame(node(30,90),{},11,true,p.windHistory),end=windFrame(node(30,90),{},12,true,p.windHistory);
 assert.equal(start.speed,5);assert.equal(start.distance,before.distance);assert.equal(middle.speed,17.5);assert.equal(middle.direction,45);assert.equal(end.speed,30);assert.equal(end.direction,90);
 assert.equal(windFrame(node(30,90),{},6,true,p.windHistory).speed,5);assert.deepEqual(windFrame(node(30,90),{},11,true,p.windHistory),middle);
 p.running=false;p.time=14;syncWindHistory(p,windConfig(node(15,180)));assert.equal(windFrame(node(15,180),{},14,true,p.windHistory).direction,180);
});
test('旗布固定边缘不随风移动，零风时旗布与树冠不随时间摆动',()=>{
 for(const v of [0,.5,1])for(const speed of [0,5,30]){const f=windFrame(node(speed),{},10,true),p=flagVertex(0,v,0,f);assert.equal(p.along,0);assert.equal(p.side,0);assert.equal(p.y,-.003*v);}
 const a=windFrame(node(0),{},5,true),b=windFrame(node(0),{},15,true);assert.deepEqual(flagVertex(1,.5,0,a),flagVertex(1,.5,0,b));assert.deepEqual(treeResponse(0,a),treeResponse(0,b));
});
