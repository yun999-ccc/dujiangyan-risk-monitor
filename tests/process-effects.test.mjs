import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../src/model.js';
import {effectSettings,effectSnapshot} from '../src/hazard-effects-model.js';
test('火险指数与主动火情分开，零半径、零时长和未启动均无火焰',()=>{
 const n=createState().states.forest;n.value=100;
 assert.equal(effectSnapshot('forest',n,{},10,true).fireActive,false);
 for(const [c,on] of [[{fireMode:'fire'},false],[{fireMode:'fire',radius:0},true],[{fireMode:'fire',duration:0},true]]){const f=effectSnapshot('forest',n,c,10,on);assert.equal(f.fireActive,false);assert.equal(f.burnRadius,0);}
});
test('手动火情按假定范围演示，结束只停止火焰而不删除残迹或巡查',()=>{
 const n=createState().states.forest;n.extra.inspection='发现火情';
 const c={fireMode:'fire',radius:8,growth:.2,duration:60},a=effectSnapshot('forest',n,c,20,true),b=effectSnapshot('forest',n,c,60,true);
 assert.equal(a.fireActive,true);assert.equal(a.burnRadius,12);assert.equal(b.fireActive,false);assert.equal(b.burnRadius,20);assert.equal(b.smoke,true);assert.equal(n.extra.inspection,'发现火情');
});
test('热浪按温度、视觉倍率和遮阴映射，结束与零倍率不改变监测温度',()=>{
 const n=createState().states.heat;n.value=45;n.extra.shade='无遮阴';const a=effectSnapshot('heat',n,{gain:1,duration:30},10,true);assert.equal(a.heatGain,1);assert.equal(a.heatActive,true);
 n.extra.shade='有遮阴';assert.equal(effectSnapshot('heat',n,{gain:1},10,true).heatGain,.45);assert.equal(effectSnapshot('heat',n,{gain:0},10,true).heatActive,false);assert.equal(effectSnapshot('heat',n,{duration:30},30,true).heatActive,false);assert.equal(n.value,45);
});
test('四类配置保留取景与跟随开关，时长为零合法且无非法数值传播',()=>{
 for(const id of ['heat','forest','landslide','debris']){const c=effectSettings(id,{duration:0,view:'path',follow:false});assert.equal(c.duration,0);assert.equal(c.view,'path');assert.equal(c.follow,false);assert.ok(Number.isFinite(effectSnapshot(id,createState().states[id],c,10,true).progress));}
});
