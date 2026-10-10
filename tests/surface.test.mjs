import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceHeight} from '../src/city-geometry.js';

test('贴地设施与三角网格表面一致，不按双线性曲面悬浮',()=>{
  const terrain={bounds:{west:0,east:1,south:0,north:1},size:2,heights:[0,0,0,100]};
  assert.equal(surfaceHeight(.25,.75,terrain),0);
  assert.equal(surfaceHeight(.75,.25,terrain),50);
  assert.equal(surfaceHeight(.5,.5,terrain),0);
  assert.equal(surfaceHeight(1,0,terrain),100);
});

import {roadProfile,createRoadBuilder} from '../src/city-geometry.js';
import {project,unproject} from '../src/model.js';
test('山路样式减弱对比，但不覆盖明确的宽度与车道信息',()=>{
  assert.equal(roadProfile({highway:'tertiary'},true).width,.008);
  assert.equal(roadProfile({highway:'tertiary',width:'12'},true).width,.012);
  assert.ok(Math.abs(roadProfile({highway:'tertiary',lanes:'4'},true).width-.0142)<1e-12);
  assert.notEqual(roadProfile({highway:'primary'},true).color,roadProfile({highway:'primary'}).color);
});
test('道路内部细分跨越折面山脊，面片不穿入地形',()=>{
  const bounds={west:103.5,east:103.51,south:31,north:31.01};
  const elevation=(lon,lat)=>{const p=project(lon,lat,bounds);return .9+.3*Math.abs(p.x+.001)+.5*Math.abs(p.z-.003);};
  const builder=createRoadBuilder(bounds,elevation);
  builder.add({id:1,tags:{highway:'primary',width:'30'},geometry:[{lon:103.501,lat:31.004},{lon:103.509,lat:31.006}]});
  const mesh=builder.mesh(),p=mesh.geometry.attributes.position;
  for(let i=0;i<p.count;i+=3){
    for(const weights of [[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]]){
      const x=weights.reduce((s,w,k)=>s+w*p.getX(i+k),0),z=weights.reduce((s,w,k)=>s+w*p.getZ(i+k),0),y=weights.reduce((s,w,k)=>s+w*p.getY(i+k),0);
      const {lon,lat}=unproject(x,z,bounds);assert.ok(y>elevation(lon,lat),`road buried at ${x},${z}`);
    }
  }
  mesh.geometry.dispose();mesh.material.dispose();
});
