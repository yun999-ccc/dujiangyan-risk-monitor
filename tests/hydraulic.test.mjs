import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {HydraulicModel,geometry,defaults,inertialFlux} from '../src/hydraulic-model.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/hydraulic.json',import.meta.url)));
test('来水、漫岸、道路积水及退水都有守恒水量，没有负水深',()=>{
 const m=new HydraulicModel(data);assert.equal(m.result().metrics.floodArea,0);m.advance(60);const early=m.result();assert.ok(early.metrics.maxSpeed>0);m.advance(900);const peak=m.result();assert.ok(peak.metrics.floodArea>0);assert.ok(peak.metrics.roadDepth>.05);m.advance(3600);const late=m.result();assert.ok(late.metrics.floodArea<peak.metrics.floodArea);assert.ok(late.metrics.roadDepth<peak.metrics.roadDepth);
 for(const h of m.h)assert.ok(h>=-1e-12&&Number.isFinite(h));assert.ok(Math.abs(late.metrics.error)<1e-4);
});
test('零来水零初始水量无水，雨量比例及建筑遮挡计入收支',()=>{
 const blocked=data.blocked.slice();blocked[data.probe]=1;const d={...data,blocked};const dry=new HydraulicModel(d,{qStart:0,qPeak:0,qEnd:0,rain:0,initialDepth:0,tailDepth:0});dry.advance(120);assert.equal(dry.volume(),0);
 const rain=new HydraulicModel(d,{qStart:0,qPeak:0,qEnd:0,rain:60,runoff:.5,initialDepth:0,drain:0,tailDepth:0});rain.advance(10);const r=rain.result();const area=blocked.filter(v=>!v).length*data.dx**2;assert.ok(Math.abs(r.metrics.rainInput-area*.06/3600*10*.5)<1e-6);assert.equal(r.h[data.probe],0);assert.ok(Math.abs(r.metrics.error)<1e-5);
});
test('排水受阻减少排出，确定性回放与相同输入保持一致',()=>{
 const a=new HydraulicModel(data,{rain:100,drain:30}),b=new HydraulicModel(data,{rain:100,drain:30,drainBlocked:true});a.advance(300);b.advance(300);assert.ok(a.drained>b.drained);const c=new HydraulicModel(data,{rain:100,drain:30});c.advance(300);assert.deepEqual(a.h,c.h);assert.ok(Math.abs(a.result().metrics.error)<1e-4);
});
test('计算与展示共用假定河槽，修改断面实际改变地形',()=>{
 const a=geometry(data),b=geometry(data,{...defaults,bankDepth:5});const i=data.distance.findIndex(d=>d<5);assert.ok(b.z[i]<a.z[i]-1);assert.equal(a.z.length,data.nx*data.ny);
});

// Analytical checks are independent of the real-terrain demonstration.
test('水平静水无通量，均匀流通量与曼宁解析解一致',()=>{
 assert.equal(inertialFlux(0,2,2,0,.5,.0625,16,.065),0);
 const h=2,slope=.001,n=.065,dx=16,q=dx*h**(5/3)*Math.sqrt(slope)/n;
 assert.ok(Math.abs(inertialFlux(q,h,h-slope*dx,0,-slope*dx,.0625,dx,n)-q)<1e-10);
});
test('下游高参考水位产生倒灌并纳入守恒，桥面缺失不当作道路淹没',()=>{
 const m=new HydraulicModel(data,{qStart:0,qPeak:0,qEnd:0,initialDepth:0,tailDepth:1,drain:0});m.advance(60);const r=m.result();assert.ok(r.metrics.tailInflow>0);assert.ok(Math.abs(r.metrics.error)<1e-5);const bridge=r.roads.find(r=>r.bridge);assert.equal(bridge.maxDepth,null);assert.equal(bridge.wetCells,null);assert.equal(bridge.firstWet,null);
});
test('默认条件逐网格时间步长差异受控，仍不证明空间或现场精度',()=>{
 const coarse=new HydraulicModel(data,{}, {maxStep:.0625}),fine=new HydraulicModel(data,{}, {maxStep:.03125});coarse.advance(900);fine.advance(900);let max=0,sum=0;for(let i=0;i<coarse.N;i++){const delta=Math.abs(coarse.h[i]-fine.h[i]);max=Math.max(max,delta);sum+=delta;}assert.ok(max<.05,`maximum difference ${max}`);assert.ok(sum/coarse.N<.001);assert.equal(coarse.totalLimitedFaces,0);assert.equal(fine.totalLimitedFaces,0);
});
test('非法参数不会进入计算，包括被篡改的持久化数值',()=>{
 for(const p of [{roughness:0},{qPeak:NaN},{rain:-1},{width:0},{tailDepth:Infinity},{duration:0},{qStart:'30'},{drainBlocked:'true'}])assert.throws(()=>new HydraulicModel(data,p));
});
