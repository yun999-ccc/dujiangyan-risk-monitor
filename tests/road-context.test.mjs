import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectNearbyRoad,roadFrame} from '../src/road-context.js';
import {project} from '../src/model.js';
const bounds={west:103.3,east:103.9,south:30.9,north:31.3};
test('项目便道端点匹配官方核查：起端连接道路，末端待核实，不凭空接线',()=>{
 const osm=JSON.parse(fs.readFileSync(new URL('../public/data/osm.json',import.meta.url))),check=JSON.parse(fs.readFileSync(new URL('../public/data/road-endpoint-check.json',import.meta.url))),records=osm.elements.filter(e=>e.tags?.highway).map(e=>({id:e.id,kind:e.tags.highway,structure:e.tags.tunnel?'tunnel':'surface',points:e.geometry.map(p=>project(p.lon,p.lat,bounds))})),origin=project(103.57,31.145,bounds),info=inspectNearbyRoad(records,origin);
 assert.equal(info.road.id,501045901);assert.equal(check.sameGeometryAsBundled,true);assert.deepEqual(info.endpoints[0].connections,[501045902]);assert.deepEqual(info.endpoints[1].connections,[]);assert.deepEqual(check.endpoints[1].otherRoads,[]);assert.ok(info.distance>.17&&info.distance<.20);
});
test('相近但没有相同端点的道路不自动连接；地图边界与记录端点可区分',()=>{const roads=[{id:1,points:[{x:0,z:0},{x:1,z:0}],startKind:'map-boundary',structure:'surface'},{id:2,points:[{x:1.001,z:0},{x:2,z:0}],structure:'surface'}];const info=inspectNearbyRoad(roads,{x:.5,z:0});assert.equal(info.endpoints[0].boundary,true);assert.deepEqual(info.endpoints[1].connections,[]);});
test('全貌取景包含道路与起伏地形，空数据返回无结果',()=>{const points=[{x:0,z:0},{x:1,z:2},{x:2,z:0}],frame=roadFrame(points,(x,z)=>x+z);assert.ok(Number.isFinite(frame.radius)&&frame.radius>1.5);assert.equal(roadFrame([],()=>0),null);assert.equal(inspectNearbyRoad([],{x:0,z:0}),null);});
