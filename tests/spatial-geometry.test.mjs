import test from 'node:test';import assert from 'node:assert/strict';
import {clipPolyline,clipPolygon,gridSurfaceTriangle} from '../src/spatial-geometry.js';
import {createRoadBuilder,surfaceHeight} from '../src/city-geometry.js';
import {project,unproject} from '../src/model.js';
import {roadWaterCrossings,corridorMask} from '../src/asset-relations.js';
const bounds={west:0,east:1,south:0,north:1};
test('跨区道路两端都在区外仍保留边界交点',()=>assert.deepEqual(clipPolyline([{lon:-1,lat:.5},{lon:2,lat:.5}],bounds),[[{lon:0,lat:.5},{lon:1,lat:.5}]]));
test('道路出界再入界不会伪造区内连线',()=>{const parts=clipPolyline([{lon:.2,lat:.2},{lon:2,lat:.2},{lon:2,lat:.8},{lon:.2,lat:.8}],bounds);assert.equal(parts.length,2);assert.equal(parts[0].at(-1).lon,1);assert.equal(parts[1][0].lon,1);assert.equal(parts[0].at(-1).lat,.2);assert.equal(parts[1][0].lat,.8);});
test('外包水域轮廓裁剪后覆盖地图，未消失',()=>{const p=clipPolygon([{lon:-1,lat:-1},{lon:2,lat:-1},{lon:2,lat:2},{lon:-1,lat:2}],bounds);assert.equal(p.length,4);assert.ok(p.every(q=>q.lon>=0&&q.lon<=1&&q.lat>=0&&q.lat<=1));});
test('面片沿DEM对角线精确拆分，面积守恒且内点贴地',()=>{
 const grid={minX:0,minZ:0,dx:1,dz:1,cols:3,rows:3},height=(x,z)=>Math.max(0,x+z-1),faces=[];
 gridSurfaceTriangle([[.1,0,.1],[1.7,0,.1],[.1,0,1.7]],height,(...p)=>faces.push(p),grid);
 let area=0;for(const [a,b,c] of faces){area+=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2;const x=(a[0]+b[0]+c[0])/3,z=(a[2]+b[2]+c[2])/3,y=(a[1]+b[1]+c[1])/3;assert.ok(Math.abs(y-height(x,z))<1e-10);}
 assert.ok(Math.abs(area-1.28)<1e-10);assert.ok(faces.length<30);
});
test('桥面采用端点假定坡线；隧道不生成地表沥青；积雪网格可复制同一路面',()=>{
 const b={west:103.5,east:103.51,south:31,north:31.01},ground=(lon)=>1+.04*Math.abs((lon-103.505)/.005),builder=createRoadBuilder(b,ground);
 const geometry=[{lon:103.501,lat:31.005},{lon:103.509,lat:31.005}];
 builder.add({id:1,tags:{highway:'tertiary',bridge:'yes',layer:'1'},geometry});builder.add({id:2,tags:{highway:'tertiary',tunnel:'yes'},geometry});builder.add({id:3,tags:{highway:'tertiary'},geometry});
 assert.equal(builder.records[0].structure,'bridge');assert.equal(builder.records[1].structure,'tunnel');assert.equal(builder.records[0].elevationSource,'endpoint grade assumed; clearance unverified');
 const center=project(103.505,31.005,b);assert.ok(builder.records[0].height(center.x,center.z)>ground(103.505)+.02);
 const surface=builder.nearestRoad(center.x,center.z);assert.equal(surface.road.id,3);assert.ok(surface.distance<1e-12);assert.ok(surface.road.geometry().length>0);
});
test('道路水系交叉按桥梁标签区分，普通交叉保持未核实，不当作淹没',()=>{
 const points=[{x:-.1,z:0},{x:.1,z:0}],roads=[{id:1,structure:'bridge',points,height:()=>.1},{id:2,structure:'surface',points,height:()=>.01}],waters=[{id:4,points:[{x:0,z:-.1},{x:0,z:.1}],height:()=>0}];
 const crossings=roadWaterCrossings(roads,waters);assert.deepEqual(crossings.map(c=>c.type),['bridge','unverified']);assert.ok(crossings.every(c=>c.clearanceVerified===false));assert.equal(crossings[0].displaySeparationMeters,100);
});

test('装饰树避让道路水系及树冠余量，但不误遮整个邻近山体',()=>{const blocked=corridorMask([{width:.01,points:[{x:-.1,z:0},{x:.1,z:0}]}],.015);assert.equal(blocked(0,.019),true);assert.equal(blocked(0,.025),false);assert.equal(blocked(.15,0),false);});
