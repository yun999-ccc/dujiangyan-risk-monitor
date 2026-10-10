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
