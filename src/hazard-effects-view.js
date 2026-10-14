import {hazards} from './model.js';
import {effectIds,effectFields,effectSettings,effectSnapshot} from './hazard-effects-model.js';

export function mountHazardEffects(getState,getScene,render,toast) {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const panel=document.createElement('section');panel.className='panel effects-panel';panel.hidden=true;
  panel.innerHTML=`<div class="effects-heading"><div><span class="water-eyebrow">INPUT → PHENOMENON · 变量与现象</span><h2 id="effect-title"></h2><p id="effect-intro"></p></div><button class="btn" id="effect-focus">定位效果</button></div>
    <div class="effect-readings" id="effect-readings"></div><div class="effect-legend" id="effect-legend"></div>
    <div class="effect-fields" id="effect-fields"></div>
    <label class="effect-formation" id="effect-formation-label"><input id="effect-formation" type="checkbox"> 主动启用结冰形成示意（假定有水且温度≤0℃时）</label>
    <div class="effect-actions"><button class="btn primary" id="effect-play"></button><button class="btn" id="effect-rewind">回到起点</button><label><input id="effect-motion" type="checkbox"> 动态效果</label><label>演示速度<select id="effect-speed"><option value="1">1×</option><option value="3">3×</option><option value="5">5×</option></select></label><output id="effect-time"></output></div>
    <label class="effect-seek-label">效果时间线 · 独立于监测轨迹<input id="effect-seek" type="range" min="0" max="30" step=".1" value="0"></label>
    <p class="effect-validity" id="effect-validity" role="status"></p><p class="control-hint" id="effect-terrain-result"></p><p class="effects-boundary" id="effect-boundary"></p>`;
  document.querySelector('.map-panel').after(panel);const $=q=>panel.querySelector(q);
  let current=null,disposed=false,previous=performance.now(),paint=-1,identity;
  function setup(id) {
    const s=getState();s.effectSettings??={};s.effectPlayback??={};s.effectLastValid??={};
    s.effectSettings[id]=effectSettings(id,s.effectSettings[id]??{motion:!reduced});
    s.effectPlayback[id]??={time:0,running:false,activated:false,speed:1};
    return {s,n:s.states[id],c:s.effectSettings[id],p:s.effectPlayback[id]};
  }
  for(const id of effectIds){const {p,c}=setup(id);p.running=false;if(reduced)c.motion=false;p.speed=[1,3,5].includes(p.speed)?p.speed:1;p.time=Math.max(0,Number.isFinite(p.time)?p.time:0);}
  function snapshot(id) {
    const {s,n,c,p}=setup(id);
    if(!n.unknown){const snap=effectSnapshot(id,n,c,p.time,p.activated);p.time=Math.min(p.time,snap.duration);s.effectLastValid[id]=effectSnapshot(id,n,c,p.time,p.activated);return s.effectLastValid[id];}
    p.running=false;
    const previous=s.effectLastValid[id];
    return previous?{...previous,unknown:true,motion:false}:{...effectSnapshot(id,n,c,0,false),unknown:true,motion:false,unavailable:true,notes:['暂无有效环境输入','现场状态需核查','不生成灾害现象'],legend:['数据未知：暂无可保留的有效画面']};
  }
  function locate(){const s=getState();s.mode='3d';getScene()?.setMode('3d');getScene()?.focusEffect?.(s.selected);document.querySelector('.map-panel').scrollIntoView({block:'center',behavior:reduced?'auto':'smooth'});render();}
  $('#effect-focus').onclick=locate;
  $('#effect-play').onclick=()=>{
    const id=getState().selected,{n,c,p}=setup(id);if(n.unknown)return;
    if(p.running){p.running=false;render();return;}
    if(!c.motion){toast('动态效果已关闭，可拖动效果时间线查看静态阶段');return;}
    const snap=snapshot(id);if(snap.duration<=0){toast('持续时间为零，不启动效果');return;}
    if(p.time>=snap.duration)p.time=0;p.activated=true;p.running=true;locate();
  };
  $('#effect-rewind').onclick=()=>{const {p}=setup(getState().selected);p.time=0;p.running=false;p.activated=false;render();};
  $('#effect-seek').oninput=e=>{const {n,p}=setup(getState().selected);if(n.unknown)return;p.time=+e.target.value;p.activated=p.time>0;p.running=false;render();};
  $('#effect-motion').onchange=e=>{const {c,p}=setup(getState().selected);c.motion=e.target.checked;if(!c.motion)p.running=false;render();};
  $('#effect-speed').onchange=e=>{setup(getState().selected).p.speed=+e.target.value;render();};
  $('#effect-formation').onchange=e=>{const {c,p}=setup('ice');c.formation=e.target.checked;p.running=false;render();};
  $('#effect-fields').onchange=e=>{const id=getState().selected,f=effectFields[id].find(f=>f.key===e.target.dataset.effectKey);if(!f)return;if(e.target.value===''||!e.target.checkValidity()){toast('请输入范围内的假定参数');refresh();return;}const {c,p}=setup(id);c[f.key]=e.target.valueAsNumber;p.running=false;p.time=0;p.activated=false;render();};
  const boundaries={
    ice:'道路走向和编号来自OSM，节点移至XN19已收录路段；路面高程取公开DEM，未经测量。积雪仅覆盖该路段附近400米直径演示区，厚度与覆盖率为假定。蓝白冰面来自巡查记录或主动启用的形成演示，不是结冰预测；湿度只作背景。动态仅演示冰面反光，不计算结冰或积雪增长速度。',
    wind:'风向按气象来向表达，箭头指向吹去方向。风迹和设施摆动幅度是放大的视觉映射，不表示真实风场、受力或倒塌概率。',
    heat:'热色带仅表示当前点位温度的视觉映射，不是区域温度分布。湿度、时长和遮阴单独显示；热浪不是人体风险模型。',
    forest:'林地边界、树群与烟柱为示意。演示指数控制关注颜色，湿度控制枯干色调，背景风控制烟柱偏移；没有林火点火或蔓延模型。',
    landslide:'箭头将毫米级监测位移放大显示。滑移距离和时长为独立手动假定，路径只顺应公开DEM下坡方向；土体为示意，不改写真实山体，不计算稳定性。',
    debris:'泥流速度、宽度、含固比例与时长均为手动假定，雨量不推算泥流发生或速度。路径来自局部DEM下坡采样，未核实黄央沟沟道，遇地形低点会停止；不是实际影响范围。泥流采用优先显示的贴地覆盖图层，颗粒循环表达流向，不表示泥流厚度、流量或守恒体积。'
  };
  function refresh() {
    const id=getState().selected;panel.hidden=!effectIds.includes(id);document.body.classList.toggle('effects-layout',!panel.hidden);
    if(panel.hidden){if(current)setup(current).p.running=false;current=null;return;}
    const {s,n,c,p}=setup(id),snap=snapshot(id),h=hazards.find(h=>h.id===id);
    if(current!==id||identity!==s.effectSettings){if(current&&current!==id)setup(current).p.running=false;current=id;identity=s.effectSettings;
      $('#effect-fields').innerHTML=effectFields[id].map(f=>`<label>${f.label} / ${f.unit}<input type="number" data-effect-key="${f.key}" id="effect-${f.key}" min="${f.min}" max="${f.max}" step="${f.step}"></label>`).join('');
    }
    $('#effect-title').textContent=`${h.name} · 变量如何改变画面`;
    $('#effect-intro').textContent=['landslide','debris'].includes(id)?'监测提示与灾害运动示意分开。启动按钮或时间线才启用运动示意。':'右侧调整环境与现场输入，主沙盘同步显示对应现象。';
    $('#effect-readings').innerHTML=snap.notes.map((t,i)=>`<div><span>${['环境与监测','条件与现场','画面解释'][i]}</span><b>${t}</b></div>`).join('');
    $('#effect-legend').innerHTML=snap.legend.map(t=>`<span>${t}</span>`).join('');
    for(const f of effectFields[id]){const el=$('#effect-'+f.key);if(document.activeElement!==el)el.value=c[f.key];el.disabled=n.unknown;}
    $('#effect-fields').hidden=!effectFields[id].length;$('#effect-formation-label').hidden=id!=='ice';$('#effect-formation').checked=c.formation;$('#effect-formation').disabled=n.unknown;
    $('#effect-play').textContent=p.running?'暂停效果':id==='landslide'?'启动滑移示意':id==='debris'?'启动泥流示意':id==='ice'?'播放冰面反光':'播放效果';
    $('#effect-play').disabled=n.unknown||!c.motion||snap.duration===0||(id==='ice'&&!snap.ice);$('#effect-rewind').disabled=n.unknown;$('#effect-motion').checked=c.motion;$('#effect-speed').value=p.speed;
    $('#effect-seek').max=snap.duration||1;$('#effect-seek').value=p.time;$('#effect-seek').disabled=n.unknown||snap.duration===0;$('#effect-time').textContent=`${p.time.toFixed(1)} / ${snap.duration.toFixed(0)} s`;
    $('#effect-validity').textContent=n.unknown?'数据未知：冻结最后有效示意，不能按正常状态使用。':!getScene()?'正在加载三维效果…':getScene().backend!=='WebGL / Three.js r185'?'当前设备三维渲染不可用，参数与文字解释仍可查看。':p.running?'效果播放中 · 所有参数为模拟':!c.motion?'动态已关闭 · 可拖动时间线查看静态阶段':'静态阶段 · 点击播放或拖动时间线';
    $('#effect-boundary').textContent=boundaries[id];panel.classList.toggle('effects-unknown',n.unknown);
    const layer=window.__hazardLayer;$('#effect-terrain-result').hidden=!['landslide','debris'].includes(id);
    $('#effect-terrain-result').textContent=layer?.id===id?(layer.pathPoints>1?`DEM示意下坡路径 ${layer.pathLengthMeters.toFixed(0)} m${id==='debris'?` · 当前泥流前沿 ${layer.frontMeters.toFixed(1)} m；到达示意路径终点后不再延伸`:''}`:'该点DEM采样未找到连续下坡路径，不伪造运动通道。'):'正在核对示意下坡路径…';
    window.__hazardEffects={...snap,running:p.running};
  }
  function frame(now){if(disposed)return;requestAnimationFrame(frame);const dt=Math.min(.1,(now-previous)/1000);previous=now;const id=getState().selected;if(!effectIds.includes(id)||document.hidden)return;const {n,c,p}=setup(id),wasRunning=p.running;if(p.running&&!n.unknown&&c.motion){const duration=snapshot(id).duration;p.time=Math.min(duration,p.time+dt*p.speed);if(p.time>=duration)p.running=false;}if(wasRunning){const tick=Math.floor(now/200);if(tick!==paint||!p.running){paint=tick;render();}}}
  requestAnimationFrame(frame);refresh();
  return {refresh,snapshot,dispose(){disposed=true;panel.remove();}};
}
