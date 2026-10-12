export const parameterFields={qStart:['起始来水 / m³/s',0,2000,1],qPeak:['峰值来水 / m³/s',0,2000,1],qEnd:['结束来水 / m³/s',0,2000,1],rain:['区域降雨 / mm/h',0,150,1],drain:['假定排水 / m³/s',0,100,.1],duration:['来水时长 / 分钟',1,120,1],width:['假定河槽宽 / m',32,80,1],bankDepth:['假定河槽深 / m',1,8,.1],initialDepth:['起始参考水深 / m',0,2,.05],roughness:['曼宁阻力系数',.02,.15,.005],tailDepth:['下游参考水深 / m',0,5,.05],runoff:['有效降雨比例',0,1,.05]};
export function validateParameters(parameters){
 for(const [key,[label,min,max]] of Object.entries(parameterFields)){
  const value=key==='duration'?parameters[key]/60:parameters[key];
  if(typeof parameters[key]!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(`${label}：请填写${min}—${max}范围内的数值`);
 }
 if(typeof parameters.drainBlocked!=='boolean')throw Error('排水受阻状态无效');
 return parameters;
}
