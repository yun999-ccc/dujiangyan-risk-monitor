import test from 'node:test';import assert from 'node:assert/strict';
import {streetHeight,insideBuilding,waterCoverage,waterTrend} from '../src/water-model.js';
test('示意积水随深度展开，零深度无水，建筑不计入覆盖',()=>{
  assert.equal(waterCoverage(0),0);const areas=[5,15,30,60].map(waterCoverage);
  for(let i=1;i<areas.length;i++)assert.ok(areas[i]>areas[i-1]);
  assert.ok(areas.at(-1)<22*26-6*4*5);assert.equal(insideBuilding(9,7),true);assert.equal(insideBuilding(0,7),false);
  assert.equal(streetHeight(0,0),0);assert.ok(streetHeight(5,0)>streetHeight(0,0));
});
test('涨退趋势来自模拟样本，不根据水深大小猜测',()=>{
  assert.equal(waterTrend({history:[{v:20},{v:10}]}),'回落');assert.equal(waterTrend({history:[{v:10},{v:20}]}),'上涨');assert.equal(waterTrend({history:[{v:50},{v:50}]}),'稳定');
});
