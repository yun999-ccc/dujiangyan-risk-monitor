import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {parseLengthMeters,buildingHeight,terrainSpacing,gridCoordinate,geometryDifference,gridProfile,geometryReadiness} from '../src/geometry-audit.js';
import {geometry,defaults} from '../src/hydraulic-model.js';
const read=n=>JSON.parse(fs.readFileSync(new URL(`../public/data/${n}.json`,import.meta.url))),data=read('hydraulic'),report=read('geometry-audit');
test('缺失、负高度不会被当作可靠高度，楼层推算与标签来源分开',()=>{
 assert.equal(buildingHeight({height:'-2','building:levels':'3'}).source,'levels-assumed');assert.equal(buildingHeight({height:'0','building:levels':'0'}).source,'default-assumed');
 assert.equal(buildingHeight({height:'18 m','building:levels':'3'}).meters,18);assert.equal(buildingHeight({'building:levels':'4'}).meters,12);
 assert.equal(buildingHeight({height:'120'}).meters,120);assert.equal(buildingHeight({height:'120'}).displayMeters,90);
 assert.equal(parseLengthMeters('10 ft'),3.048);assert.ok(Number.isNaN(parseLengthMeters('12;15')));assert.equal(buildingHeight({height:'12;15'}).source,'default-assumed');
});
test('16m计算网格不会被记录成公开DEM采样间距或测绘精度',()=>{
 const spacing=terrainSpacing(read('terrain'));assert.ok(spacing.eastWest>data.dx*3);assert.ok(spacing.northSouth>data.dx*3);
 assert.equal(report.terrain.accuracyMeters,null);assert.deepEqual(report.terrain.spacingMeters,spacing);
});
test('剖面坐标对应网格中心，方向和边界一致，高程不含显示夸张',()=>{
 const z=geometry(data).z,row=Math.floor(data.probe/data.nx),profile=gridProfile(data,z,row);
 const first=gridCoordinate(data,0),last=gridCoordinate(data,data.nx*data.ny-1);assert.ok(first.lat>last.lat);assert.ok(first.lon<last.lon);assert.ok(first.lon>data.bounds.west);assert.ok(last.lon<data.bounds.east);
 assert.equal(profile.length,data.nx);for(const p of profile){assert.equal(p.raw,data.raw[p.index]);assert.equal(p.used,z[p.index]);assert.equal(p.delta,p.used-p.raw);}
 assert.throws(()=>gridCoordinate(data,-1));assert.throws(()=>gridCoordinate(data,data.nx*data.ny));
});
test('地形差值审计与当前河槽参数一致，零差值面积为零',()=>{
 assert.equal(geometryDifference(data,data.raw).changedArea,0);assert.throws(()=>geometryDifference(data,[0]));
 const a=geometryDifference(data,geometry(data).z),b=geometryDifference(data,geometry(data,{...defaults,bankDepth:5}).z);assert.deepEqual(a,report.river.modification);assert.notEqual(a.meanAbs,b.meanAbs);assert.equal(a.changedArea,a.changedCells*data.dx**2);
});
test('核查记录与实际打包文件哈希一致，高度来源分类互斥且合计正确',()=>{
 for(const f of report.files){const bytes=fs.readFileSync(new URL(`../public/${f.path}`,import.meta.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),f.sha256);}
 const counts={'height-tag':0,'levels-assumed':0,'default-assumed':0};for(const w of read('osm').elements.filter(w=>w.tags?.building))counts[buildingHeight(w.tags).source]++;
 assert.deepEqual(counts,report.buildings.heightSources);assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),report.buildings.total);
});
test('任一必需几何证据未核实都不能显示通过，公开地图空记录不等于现场无建筑',()=>{
 assert.equal(geometryReadiness(report).ready,false);assert.equal(report.readiness.ready,false);
 const one={requirements:[{id:'bed',required:true,status:'missing'}]};assert.equal(geometryReadiness(one).ready,false);
 assert.equal(geometryReadiness({requirements:[{id:'bed',required:true,status:'verified'}]}).ready,true);
 assert.equal(report.sourceChecks[0].counts.buildings,report.sourceChecks[0].wayIds.buildings.length);assert.match(report.sourceChecks[0].note,/不能据此判定现场无建筑/);
});
