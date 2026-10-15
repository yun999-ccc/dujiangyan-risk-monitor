import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,updateValue} from '../src/model.js';
import {updateNode} from '../src/simulation.js';
import {effectSettings,effectSnapshot,downhillPath} from '../src/hazard-effects-model.js';
test('低温和湿度不自动生成冰面，形成演示需要明确启用或巡查证据',()=>{
  const s=createState();updateValue(s,'ice',-8);updateNode(s,'ice','secondary',100);updateNode(s,'ice','surface','有水');
  assert.equal(effectSnapshot('ice',s.states.ice,{}).ice,false);
  assert.equal(effectSnapshot('ice',s.states.ice,{formation:true}).ice,true);
  updateNode(s,'ice','surface','干燥');assert.equal(effectSnapshot('ice',s.states.ice,{formation:true}).ice,false);
  updateNode(s,'ice','inspection','发现结冰');updateValue(s,'ice',5);
  assert.equal(effectSnapshot('ice',s.states.ice,{}).ice,true);
  assert.equal(effectSnapshot('ice',s.states.ice,{coverage:0}).coverage,0);
});
test('火险指数再高也不自动出现烟柱，烟火记录不随指数回落而清除',()=>{
  const s=createState();updateValue(s,'forest',100);assert.equal(effectSnapshot('forest',s.states.forest,{}).smoke,false);
  updateNode(s,'forest','inspection','发现烟雾');updateValue(s,'forest',0);assert.equal(effectSnapshot('forest',s.states.forest,{}).smoke,true);
  updateNode(s,'forest','inspection','未见烟火');assert.equal(effectSnapshot('forest',s.states.forest,{}).smoke,false);
});
test('位移和雨强不自动启动滑移或泥流，独立假定只影响运动示意',()=>{
  const s=createState();updateValue(s,'landslide',20);updateValue(s,'debris',100);
  assert.equal(effectSnapshot('landslide',s.states.landslide,{},10,false).travel,0);
  assert.equal(effectSnapshot('debris',s.states.debris,{},10,false).distance,0);
  assert.equal(effectSnapshot('landslide',s.states.landslide,{travel:10,duration:20},10,true).travel,5);
  assert.equal(effectSnapshot('debris',s.states.debris,{velocity:6},10,true).distance,60);
  assert.equal(effectSnapshot('debris',s.states.debris,{velocity:0},10,true).distance,0);
  assert.equal(s.states.debris.value,100);
});
test('效果参数约束、零风速及零持续时间不产生受风动画',()=>{
  assert.equal(effectSettings('debris',{velocity:-5,width:500,solids:NaN}).velocity,0);
  assert.equal(effectSettings('debris',{width:500}).width,80);
  const s=createState();updateValue(s,'wind',0);assert.equal(effectSnapshot('wind',s.states.wind,{}).active,false);
  updateValue(s,'wind',20);updateNode(s,'wind','secondary',0);assert.equal(effectSnapshot('wind',s.states.wind,{}).active,false);
  assert.equal(effectSnapshot('wind',s.states.wind,{}).duration,0);
});
test('DEM下坡路径可重现、逐点下降，低点和水平地形不伪造流向',()=>{
  const height=(x,z)=>2-x*.2+z*z;
  const a=downhillPath({x:0,z:0},height,20);assert.deepEqual(a,downhillPath({x:0,z:0},height,20));
  assert.equal(a.length,21);for(let i=1;i<a.length;i++)assert.ok(a[i].y<a[i-1].y);
  assert.equal(downhillPath({x:0,z:0},()=>1).length,1);
  assert.equal(downhillPath({x:0,z:0},(x,z)=>x*x+z*z).length,1);
});
test('冰雪增长显式启用且可重现，零覆盖零时长与干燥路面不产生飘雪',()=>{
 const s=createState(),n=s.states.ice;updateNode(s,'ice','surface','积雪');const c={snow:20,coverage:80,duration:40,accumulate:true};
 const a=effectSnapshot('ice',n,c,0,false),b=effectSnapshot('ice',n,c,20,true),e=effectSnapshot('ice',n,c,40,true);
 assert.equal(a.snow,0);assert.equal(a.coverage,0);assert.equal(a.snowfall,false);assert.equal(b.snow,10);assert.equal(b.coverage,.4);assert.equal(b.snowfall,true);assert.deepEqual(b,effectSnapshot('ice',n,c,20,true));assert.equal(e.snow,20);assert.equal(e.snowfall,false);
 assert.equal(effectSnapshot('ice',n,{...c,coverage:0},20,true).snowfall,false);assert.equal(effectSnapshot('ice',n,{...c,duration:0},0,true).snowfall,false);
 updateNode(s,'ice','surface','干燥');assert.equal(effectSnapshot('ice',n,c,20,true).snowfall,false);assert.equal(effectSnapshot('ice',n,c,20,true).coverage,0);
});
test('热浪倍率、遮阴与独立上升速度有界，不把湿度当作人体风险',()=>{
 const s=createState();updateValue(s,'heat',45);updateNode(s,'heat','shade','无遮阴');const n=s.states.heat;
 assert.equal(effectSnapshot('heat',n,{gain:1},5,true).heatGain,1);updateNode(s,'heat','shade','有遮阴');assert.equal(effectSnapshot('heat',n,{gain:1},5,true).heatGain,.45);
 assert.equal(effectSnapshot('heat',n,{gain:0},5,true).heatActive,false);updateValue(s,'heat',20);assert.equal(effectSnapshot('heat',n,{gain:3},5,true).heatActive,false);assert.equal(effectSettings('heat',{rise:-2}).rise,0);assert.equal(effectSettings('heat',{rise:100}).rise,3);
});
test('独立林火视觉强度可关闭火焰，火险与巡查证据仍独立',()=>{
 const s=createState(),n=s.states.forest;updateValue(s,'forest',100);assert.equal(effectSnapshot('forest',n,{fireMode:'risk'},5,true).fireActive,false);
 assert.equal(effectSnapshot('forest',n,{fireMode:'fire',power:1},5,true).fireActive,true);assert.equal(effectSnapshot('forest',n,{fireMode:'fire',power:0},5,true).fireActive,false);assert.equal(effectSnapshot('forest',n,{fireMode:'fire',radius:0},5,true).burnRadius,0);assert.equal(effectSnapshot('forest',n,{fireMode:'fire',duration:0},0,true).fireActive,false);
 assert.equal(effectSettings('forest',{}).view,'context');assert.equal(effectSettings('forest',{smokeGain:5}).smokeGain,2);assert.equal(effectSettings('forest',{power:-1}).power,0);
});
