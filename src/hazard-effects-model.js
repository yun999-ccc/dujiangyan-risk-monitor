import {windFrame} from './wind-model.js';
export const effectIds = ['ice', 'wind', 'heat', 'forest', 'landslide', 'debris'];
export const effectFields = {
  ice: [{key:'coverage',label:'示意覆盖率',unit:'%',min:0,max:100,step:1,value:45}, {key:'snow',label:'假定积雪厚度',unit:'cm',min:0,max:40,step:1,value:8},{key:'duration',label:'覆盖增长演示时长',unit:'s',min:0,max:300,step:1,value:60}],
  wind: [{key:'gustPeak',label:'阵风峰值',unit:'m/s',min:0,max:35,step:.5,value:18},{key:'gustPeriod',label:'假定阵风间隔',unit:'s',min:4,max:60,step:1,value:12}], heat: [{key:'duration',label:'热浪演示时长',unit:'s',min:0,max:300,step:1,value:60},{key:'gain',label:'热浪视觉倍率',unit:'×',min:0,max:3,step:.1,value:1},{key:'rise',label:'热浪上升视觉速度',unit:'×',min:0,max:3,step:.1,value:1}], forest: [{key:'radius',label:'假定火源半径',unit:'m',min:0,max:30,step:1,value:8},{key:'growth',label:'假定范围增长速度',unit:'m/s',min:0,max:1,step:.05,value:.2},{key:'direction',label:'背景风来向',unit:'°',min:0,max:360,step:1,value:0},{key:'duration',label:'火情演示时长',unit:'s',min:0,max:300,step:1,value:60}],
  landslide: [{key:'travel',label:'假定滑移距离',unit:'m',min:0,max:30,step:1,value:8}, {key:'duration',label:'滑移演示时长',unit:'s',min:0,max:120,step:1,value:20}],
  debris: [{key:'velocity',label:'假定泥流速度',unit:'m/s',min:0,max:15,step:.5,value:6}, {key:'width',label:'假定泥流宽度',unit:'m',min:5,max:80,step:1,value:35}, {key:'solids',label:'假定含固体积比',unit:'%',min:0,max:80,step:1,value:55}, {key:'duration',label:'泥流演示时长',unit:'s',min:0,max:120,step:1,value:30}]
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function effectSettings(id, input={}) {
  const result={motion:input.motion!==false,formation:input.formation===true,gust:input.gust===true};if(id==='ice'){result.accumulate=input.accumulate===true;result.snowfall=input.snowfall!==false;}if(id==='wind')result.view=['field','flag','tree'].includes(input.view)?input.view:'flag';
  if(['heat','forest','landslide','debris'].includes(id)){result.view=(id==='heat'?['context','subject','source','path']:['subject','source','path']).includes(input.view)?input.view:id==='heat'?'context':'subject';result.follow=input.follow!==false;}if(id==='forest')result.fireMode=input.fireMode==='fire'?'fire':'risk';
  for(const f of effectFields[id]??[]) result[f.key]=Number.isFinite(input[f.key])?clamp(input[f.key],f.min,f.max):f.value;
  return result;
}
export function effectDuration(id,n,c) {return ['ice','heat','forest','landslide','debris'].includes(id)?c.duration:id==='wind'?clamp(n.secondary,0,3600):30;}
// Indicators describe observations. Event playback is an explicit, separate demonstration.
export function effectSnapshot(id,n,settings,time=0,activated=false,windHistory=null) {
  const c=effectSettings(id,settings),duration=effectDuration(id,n,c),progress=duration?clamp(time/duration,0,1):0;
  const result={id,time,progress,duration,activated,unknown:n.unknown,motion:c.motion,settings:c,input:{value:n.value,secondary:n.secondary,extra:{...n.extra}},notes:[],legend:[]};
  if(id==='ice') {
    result.snow=n.extra.surface==='积雪'?c.snow:0;
    result.ice=n.extra.inspection==='发现结冰'||(c.formation&&n.value<=0&&['有水','积雪'].includes(n.extra.surface));
    result.coverage=result.ice||result.snow>0?c.coverage/100:0;
    result.targetSnow=result.snow;result.targetCoverage=result.coverage;result.growth=c.accumulate?(activated?progress:0):1;result.snow*=result.growth;result.coverage*=result.growth;result.snowfall=activated&&time<duration&&c.snowfall&&result.targetSnow>0&&c.coverage>0;
    result.notes=[`${n.value}℃ · 表面湿度 ${n.secondary}% · ${n.extra.surface}`,result.ice?`冰面覆盖 ${c.coverage}%（手动假定），${n.extra.inspection==='发现结冰'?'巡查记录示意':'已主动启用形成演示'}`:'尚未确认冰面，低温只作核查提醒',`当前积雪 ${result.snow.toFixed(1)} cm / 目标 ${result.targetSnow} cm（假定），${c.accumulate?'覆盖按演示时间增长':'静态覆盖'}`];
    result.legend=['蓝白斑块：冰面示意','沿道路白色覆盖：积雪示意'];
  } else if(id==='wind') {
    result.wind=windFrame(n,c,time,activated,windHistory);result.strength=result.wind.strength;result.direction=result.wind.direction;result.active=result.wind.active;
    result.notes=[`基础 ${n.value} m/s · 当前演示 ${result.wind.speed.toFixed(1)} m/s · ${c.gust?'阵风峰值 '+result.wind.peak+' m/s':'阵风关闭'}`,`来自${result.wind.from}方，吹向${result.wind.toward}方 · ${time.toFixed(1)} / ${duration} 模拟秒`,`${n.extra.facility} · ${n.extra.inspection}；动画结束不清除巡查记录`];
    result.legend=['浅青风迹：连续移动','暖黄旗布：固定边缘变形','绿色树冠：基部固定、上部摆动'];
  } else if(id==='heat') {
    result.strength=clamp((n.value-20)/25,0,1);result.heatGain=result.strength*c.gain*(n.extra.shade==='有遮阴'?.45:1);result.heatActive=activated&&duration>0&&time<duration&&result.heatGain>0;result.exposure=n.extra.shade==='有遮阴'?'有遮阴':n.extra.shade==='无遮阴'?'无遮阴':'遮阴未知';
    result.notes=[`环境 ${n.value}℃ · 湿度 ${n.secondary}%`,`户外活动 ${n.extra.minutes} min · ${result.exposure}`,'地表颜色由环境温度映射；不计算体感温度或个人中暑概率'];
    result.legend=['橙色热表面：温度视觉映射','透明上升扰动：视觉热浪；非体感温度'];
  } else if(id==='forest') {
    result.strength=clamp(n.value/100,0,1);result.smoke=['发现烟雾','发现火情'].includes(n.extra.inspection);
    result.fireActive=c.fireMode==='fire'&&activated&&duration>0&&c.radius>0&&time<duration;result.burnRadius=c.fireMode==='fire'&&activated&&duration>0&&c.radius>0?Math.min(60,c.radius+c.growth*Math.min(time,duration)):0;result.fireElapsed=Math.min(time,duration);result.wind=clamp(n.extra.wind,0,50);result.dryness=1-clamp(n.secondary/100,0,1);
    result.notes=[`演示指数 ${n.value}/100 · 湿度 ${n.secondary}%`,`背景风 ${n.extra.wind} m/s · 近期${n.extra.recentRain}`,`${n.extra.inspection}；${result.smoke?'烟柱仅表示手动巡查记录':'未设置烟火记录，不显示烟柱'}；${c.fireMode==='fire'?'已选择独立火情演示，需主动播放':'火险模式不生成火焰'}`];
    result.legend=['林地色带：火险背景','火焰/烟雾：主动演示或巡查记录','深色范围：假定残迹，结束后保留'];
  } else if(id==='landslide') {
    result.displacement=n.value;result.cracks=['发现裂缝','发现掉块'].includes(n.extra.inspection);
    result.travel=activated?c.travel*progress:0;
    result.notes=[`位移变化 ${n.value} mm/h · 累计雨量 ${n.secondary} mm`,`${n.extra.inspection} · 外部${n.extra.external}`,activated?`独立滑移示意 ${result.travel.toFixed(1)} / ${c.travel} m，不由监测阈值触发`:'仅监测示意；尚未启动土体滑移'];
    result.legend=['琥珀箭头：放大的监测位移','棕色土体：手动启动的滑移示意'];
  } else if(id==='debris') {
    result.rain=n.value;result.antecedent=n.secondary;result.blocked=n.extra.inspection==='发现堵塞';result.abnormal=n.extra.inspection==='发现异常水流';
    result.distance=activated?c.velocity*Math.max(0,time):0;
    result.notes=[`雨强 ${n.value} mm/h · 前期雨量 ${n.secondary} mm`,`${n.extra.inspection} · 外部${n.extra.external}`,activated?`假定速度 ${c.velocity} m/s · 宽度 ${c.width} m · 含固 ${c.solids}%；不是由雨量计算`:'尚未启动泥流；雨量不等于灾害发生'];
    result.legend=['浅褐虚线：DEM下坡方向示意','棕色带与颗粒：主动启动的泥流'];
  }
  return result;
}
// Follow the sampled displayed terrain downhill; no claim that this is a surveyed channel.
export function downhillPath(start,height,steps=40,spacing=.012) {
  const path=[{...start,y:height(start.x,start.z)}];let direction=null;
  for(let k=0;k<steps;k++) {
    const p=path.at(-1);let best=null;
    for(let i=0;i<16;i++) {
      const a=i*Math.PI/8,dx=Math.cos(a),dz=Math.sin(a);
      if(direction&&dx*direction.x+dz*direction.z<-.1)continue;
      const x=p.x+dx*spacing,z=p.z+dz*spacing,y=height(x,z);
      if(y<p.y-1e-7&&(!best||y<best.y))best={x,z,y,dx,dz};
    }
    if(!best)break;
    direction={x:best.dx,z:best.dz};path.push({x:best.x,z:best.z,y:best.y});
  }
  return path;
}
