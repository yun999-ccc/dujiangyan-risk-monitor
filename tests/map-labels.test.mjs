import test from 'node:test';import assert from 'node:assert/strict';
import {arrangeLabels} from '../src/map-labels.js';
test('标注避开工具和其他标注，优先保留所选点位',()=>{
 const entries=Array.from({length:12},(_,i)=>({id:i,x:180+i*3,y:130+i*4,width:84,height:28,priority:i===7?10:3}));
 const result=arrangeLabels(entries,390,470,[{left:0,top:0,right:390,bottom:78},{left:328,top:78,right:390,bottom:252}]);
 assert.ok(result.find(p=>p.id===7).box);const boxes=result.filter(p=>p.box).map(p=>p.box);
 for(let i=0;i<boxes.length;i++){const a=boxes[i];assert.ok(a.left>=8&&a.right<=382&&a.top>=78&&a.bottom<=462);for(let j=i+1;j<boxes.length;j++){const b=boxes[j];assert.ok(a.right+5<=b.left||b.right+5<=a.left||a.bottom+5<=b.top||b.bottom+5<=a.top);}}
});
test('无足够空间时隐藏次要标注，不挤入画面或挡住主控件',()=>{
 const result=arrangeLabels([{x:40,y:40,width:180,height:60,priority:1}],100,100,[{left:0,top:0,right:100,bottom:100}]);assert.equal(result[0].box,null);
});
