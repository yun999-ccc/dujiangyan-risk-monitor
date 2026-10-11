import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {HydraulicModel,geometry,defaults} from '../src/hydraulic-model.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/hydraulic.json',import.meta.url)));
test('来水、漫岸、道路积水及退水都有守恒水量，没有负水深',()=>{
 const m=new HydraulicModel(data);assert.equal(m.result().metrics.floodArea,0);m.advance(60);const early=m.result();assert.ok(early.metrics.maxSpeed>0);m.advance(900);const peak=m.result();assert.ok(peak.metrics.floodArea>0);assert.ok(peak.metrics.roadDepth>.05);m.advance(3600);const late=m.result();assert.ok(late.metrics.floodArea<peak.metrics.floodArea);assert.ok(late.metrics.roadDepth<peak.metrics.roadDepth);
 for(const h of m.h)assert.ok(h>=-1e-12&&Number.isFinite(h));assert.ok(Math.abs(late.metrics.error)<1e-4);
});
test('零来水零初始水量无水，雨量比例及建筑遮挡计入收支',()=>{
 const blocked=data.blocked.slice();blocked[data.probe]=1;const d={...data,blocked};const dry=new HydraulicModel(d,{qStart:0,qPeak:0,qEnd:0,rain:0,initialDepth:0});dry.advance(120);assert.equal(dry.volume(),0);
 const rain=new HydraulicModel(d,{qStart:0,qPeak:0,qEnd:0,rain:60,runoff:.5,initialDepth:0,drain:0});rain.advance(10);const r=rain.result();const area=blocked.filter(v=>!v).length*data.dx**2;assert.ok(Math.abs(r.metrics.rainInput-area*.06/3600*10*.5)<1e-6);assert.equal(r.h[data.probe],0);assert.ok(Math.abs(r.metrics.error)<1e-5);
});
test('排水受阻减少排出，确定性回放与相同输入保持一致',()=>{
 const a=new HydraulicModel(data,{rain:100,drain:30}),b=new HydraulicModel(data,{rain:100,drain:30,drainBlocked:true});a.advance(300);b.advance(300);assert.ok(a.drained>b.drained);const c=new HydraulicModel(data,{rain:100,drain:30});c.advance(300);assert.deepEqual(a.h,c.h);assert.ok(Math.abs(a.result().metrics.error)<1e-4);
});
test('计算与展示共用假定河槽，修改断面实际改变地形',()=>{
 const a=geometry(data),b=geometry(data,{...defaults,bankDepth:5});const i=data.distance.findIndex(d=>d<5);assert.ok(b.z[i]<a.z[i]-1);assert.equal(a.z.length,data.nx*data.ny);
});
