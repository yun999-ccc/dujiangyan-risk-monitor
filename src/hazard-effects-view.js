import {createMapControls} from './map-controls.js';
import {mountProcessControls,processIds} from './process-controls.js';
import {updateNode,updateValue} from './simulation.js';
import {windConfig,syncWindHistory} from './wind-model.js';
import {hazards} from './model.js';
import {effectIds,effectFields,effectSettings,effectSnapshot} from './hazard-effects-model.js';

export function mountHazardEffects(getState,getScene,render,toast) {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const panel=document.createElement('section');panel.className='panel effects-panel';panel.hidden=true;
  panel.innerHTML=`<div class="effects-heading"><div><span class="water-eyebrow">INPUT → PHENOMENON · 变量与现象</span><h2 id="effect-title"></h2><p id="effect-intro"></p></div><button class="btn" id="effect-focus">定位效果</button></div>
    <div class="effect-readings" id="effect-readings"></div><div class="effect-legend" id="effect-legend"></div>
    <div id="wind-controls" class="wind-controls" hidden>
      <div class="wind-controls-head"><h3>大风控制</h3><span>统一输入 · 模拟过程</span></div>
      <div class="wind-control-grid">
       <label>基础风速 / m/s<div><input id="wind-speed" type="range" min="0" max="35" step=".5"><input id="wind-speed-number" type="number" min="0" max="35" step=".5" aria-label="基础风速精确输入"></div></label>
       <label>持续时间 / 模拟秒<div><input id="wind-duration" type="range" min="0" max="3600" step="1"><input id="wind-duration-number" type="number" min="0" max="3600" step="1" aria-label="风过程持续时间精确输入"></div><span class="wind-quick">快捷时长 <button data-wind-duration="30">30秒</button><button data-wind-duration="60">60秒</button><button data-wind-duration="180">180秒</button></span></label>
       <label>来向 / °<div><input id="wind-direction" type="range" min="0" max="360" step="1"><input id="wind-direction-number" type="number" min="0" max="360" step="1" aria-label="风的来向精确输入"></div><span class="wind-quick"><button data-wind-direction="0">北风</button><button data-wind-direction="90">东风</button><button data-wind-direction="180">南风</button><button data-wind-direction="270">西风</button></span></label>
      </div><label class="wind-gust-toggle"><input id="wind-gust" type="checkbox"> 启用假定阵风</label><p id="wind-direction-reading"></p><div class="wind-view-buttons" role="group" aria-label="受风细节视角"><button data-wind-view="flag">旗布近景</button><button data-wind-view="tree">树冠近景</button><button data-wind-view="field">全场景</button></div>
      <div class="wind-now"><span>当前演示风速</span><b id="wind-current-speed"></b><small id="wind-process-status"></small></div>
      <p class="control-hint">播放中调整风速和来向会在2模拟秒内过渡；暂停时更新静态画面。结束前2秒内回落至无风，监测输入与巡查记录保留。风险提示仍按基础风速和巡查判断，阵风峰值只驱动视觉演示。0 m/s表示无风，阵风不启动。</p>
    </div><div class="effect-fields" id="effect-fields"></div>
    <label class="effect-formation" id="effect-formation-label"><input id="effect-formation" type="checkbox"> 主动启用结冰形成示意（假定有水且温度≤0℃时）</label>
    <div class="effect-actions"><button class="btn primary" id="effect-play"></button><button class="btn" id="effect-rewind">回到起点</button><label><input id="effect-motion" type="checkbox"> 动态效果</label><label>演示速度<select id="effect-speed"><option value="1">1×</option><option value="3">3×</option><option value="5">5×</option><option value="10">10×</option></select></label><output id="effect-time"></output></div>
    <label class="effect-seek-label">效果时间线 · 独立于监测轨迹<input id="effect-seek" type="range" min="0" max="30" step=".1" value="0"></label>
    <p class="effect-validity" id="effect-validity" role="status"></p><p class="control-hint" id="effect-terrain-result"></p><p class="effects-boundary" id="effect-boundary"></p>`;
  document.querySelector('.map-panel').after(panel);const $=q=>panel.querySelector(q)??document.querySelector(q);
  const dock=createMapControls('冰雪 / 大风 · 变量与过程','拖动模型改变视角；播放推进过程。暂停和时间线使用同一个模拟时钟。');
  const iceInputs=document.createElement('div');iceInputs.className='ice-map-inputs';iceInputs.hidden=true;iceInputs.innerHTML='<div class=effect-fields><label>路面温度 / ℃<input id=ice-temperature type=number min=-30 max=10 step=.5></label><label>路面情况<select id=ice-surface><option>未知</option><option>干燥</option><option>有水</option><option>积雪</option></select></label></div><label><input id=ice-accumulate type=checkbox> 手动覆盖增长演示（不表示实测冻结速度）</label><label><input id=ice-snowfall type=checkbox> 积雪场景飘雪</label><button class=btn id=ice-closeup>道路近景</button>';panel.append(iceInputs);
  const transport=document.createElement('div');transport.className='wind-map-transport';transport.hidden=true;
  transport.innerHTML='<button class="btn primary" id="wind-map-play">播放大风</button><div><b id="wind-map-status"></b><small id="wind-map-time"></small></div><button class="btn" data-wind-camera="front">恢复正面</button><button class="btn" data-wind-camera="side">侧面观察</button><label><input type="checkbox" id="wind-map-motion"> 动态效果</label><small id="wind-camera-hint">拖动只改变视角，播放才推进风过程</small>';
  document.querySelector('#canvas').after(transport);
  let current=null,disposed=false,previous=performance.now(),paint=-1,identity;
  function setup(id) {
    const s=getState();s.effectSettings??={};s.effectPlayback??={};s.effectLastValid??={};
    s.effectSettings[id]=effectSettings(id,s.effectSettings[id]??{motion:!reduced});
    s.effectPlayback[id]??={time:0,running:false,activated:false,speed:1};
    if(id==='wind')s.effectSettings[id].gustPeak=Math.max(s.states[id].value,s.effectSettings[id].gustPeak);
    return {s,n:s.states[id],c:s.effectSettings[id],p:s.effectPlayback[id]};
  }
  $('#ice-temperature').onchange=e=>{if(e.target.value!==''&&e.target.checkValidity()){updateValue(getState(),'ice',e.target.valueAsNumber);render();}};$('#ice-surface').onchange=e=>{updateNode(getState(),'ice','surface',e.target.value);render();};for(const key of ['accumulate','snowfall'])$('#ice-'+key).onchange=e=>{const {c,p}=setup('ice');c[key]=e.target.checked;p.running=false;if(key==='accumulate'){p.time=0;p.activated=false;}render();};$('#ice-closeup').onclick=()=>{getScene()?.focusIceDetail?.();};
  const processControls=mountProcessControls(getState,setup,render,getScene);
  for(const id of effectIds){const {p,c}=setup(id);p.running=false;if(['heat','forest'].includes(id))c.view='context';if(reduced)c.motion=false;p.speed=[1,3,5,10].includes(p.speed)?p.speed:1;p.time=Math.max(0,Number.isFinite(p.time)?p.time:0);}
  function snapshot(id) {
    const {s,n,c,p}=setup(id);
    if(!n.unknown){if(id==='wind'){p.time=Math.min(p.time,n.secondary);if(n.secondary===0||n.value===0||p.time>=n.secondary)p.running=false;syncWindHistory(p,windConfig(n,c));}const snap=effectSnapshot(id,n,c,p.time,p.activated,p.windHistory);if(processIds.includes(id)&&(snap.duration===0||id==='heat'&&(snap.heatGain===0||c.rise===0)||id==='forest'&&c.fireMode==='fire'&&(c.radius===0||c.power===0)||id==='landslide'&&c.travel===0||id==='debris'&&c.velocity===0))p.running=false;p.time=Math.min(p.time,snap.duration);s.effectLastValid[id]=effectSnapshot(id,n,c,p.time,p.activated,p.windHistory);return s.effectLastValid[id];}
    p.running=false;
    const previous=s.effectLastValid[id];
    return previous?{...previous,unknown:true,motion:false}:{...effectSnapshot(id,n,c,0,false),unknown:true,motion:false,unavailable:true,notes:['暂无有效环境输入','现场状态需核查','不生成灾害现象'],legend:['数据未知：暂无可保留的有效画面']};
  }
  function locate(){const s=getState();s.mode='3d';getScene()?.setMode('3d');getScene()?.focusEffect?.(s.selected);document.querySelector('.map-panel').scrollIntoView({block:'center',behavior:reduced?'auto':'smooth'});render();}
  $('#effect-focus').onclick=locate;
  transport.querySelector('#wind-map-play').onclick=()=>$('#effect-play').click();
  transport.querySelector('#wind-map-motion').onchange=e=>{const {c,p}=setup('wind');c.motion=e.target.checked;if(!c.motion)p.running=false;render();};
  for(const el of transport.querySelectorAll('[data-wind-camera]'))el.onclick=()=>{setup('wind').c.view='flag';getScene()?.focusWindDetail?.('flag',el.dataset.windCamera);render();};
  $('#effect-play').onclick=()=>{
    const id=getState().selected;let {n,c,p}=setup(id);if(n.unknown)return;
    if(p.running){p.running=false;render();return;}
    if(!c.motion){toast('动态效果已关闭，可拖动效果时间线查看静态阶段');return;}
    const snap=snapshot(id);c=setup(id).c;if(snap.duration<=0){toast('持续时间为零，不启动效果');return;}
    if(id==='forest'){if(c.radius<=0||c.power<=0)return;const fresh=c.fireMode!=='fire'||!p.activated||p.time>=snap.duration;c.fireMode='fire';if(fresh){p.time=0;c.view='subject';getState().mode='3d';getScene()?.setMode('3d');getScene()?.focusProcess?.(id,'subject');}}
    if(p.time>=snap.duration)p.time=0;p.activated=true;p.running=true;if(['ice','heat','forest'].includes(id))render();else locate();
  };
  $('#effect-rewind').onclick=()=>{const {p}=setup(getState().selected);p.time=0;p.running=false;p.activated=false;if(getState().selected==='wind'){delete p.windHistory;delete p.windKey;}render();};
  $('#effect-seek').oninput=e=>{const {n,p}=setup(getState().selected);if(n.unknown)return;p.time=+e.target.value;p.activated=p.time>0;p.running=false;render();};
  $('#effect-motion').onchange=e=>{const {c,p}=setup(getState().selected);c.motion=e.target.checked;if(!c.motion)p.running=false;render();};
  $('#effect-speed').onchange=e=>{setup(getState().selected).p.speed=+e.target.value;render();};
  $('#effect-formation').onchange=e=>{const {c,p}=setup('ice');c.formation=e.target.checked;p.running=false;render();};
  $('#effect-fields').onchange=e=>{const id=getState().selected,f=effectFields[id].find(f=>f.key===e.target.dataset.effectKey);if(!f)return;if(e.target.value===''||!e.target.checkValidity()){toast('请输入范围内的假定参数');refresh();return;}const {c,p}=setup(id);c[f.key]=e.target.valueAsNumber;if(id!=='wind'){p.time=Math.min(p.time,c.duration??p.time);}render();};
  function setWind(kind,value){
    if(kind==='speed')window.__monitor.updateValue('wind',value);else{updateNode(getState(),'wind',kind==='duration'?'secondary':'direction',value);render();if(kind==='direction'&&!setup('wind').p.running)getScene()?.focusWindDetail?.(setup('wind').c.view);}
  }
  for(const kind of ['speed','duration','direction'])for(const suffix of ['', '-number']){
    const element=$('#wind-'+kind+suffix),event=suffix?'onchange':'oninput';element[event]=e=>{if(e.target.value===''||!e.target.checkValidity()){toast('请输入范围内的风过程参数');e.target.value=kind==='speed'?getState().states.wind.value:kind==='duration'?getState().states.wind.secondary:getState().states.wind.extra.direction;return;}setWind(kind,e.target.valueAsNumber);};
  }
  for(const button of panel.querySelectorAll('[data-wind-duration]'))button.onclick=()=>setWind('duration',+button.dataset.windDuration);
  for(const button of panel.querySelectorAll('[data-wind-direction]'))button.onclick=()=>setWind('direction',+button.dataset.windDirection);
  for(const button of document.querySelectorAll('[data-wind-view]'))button.onclick=()=>{const {c}=setup('wind');c.view=button.dataset.windView;getScene()?.focusWindDetail?.(c.view);render();};
  $('#wind-gust').onchange=e=>{setup('wind').c.gust=e.target.checked;render();};
  const boundaries={
    ice:'道路走向和编号来自OSM，节点移至XN19已收录路段；路面高程取公开DEM，未经测量。积雪仅覆盖该路段附近400米直径演示区，厚度与覆盖率为假定。蓝白冰面来自巡查记录或主动启用的形成演示，不是结冰预测；湿度只作背景。覆盖增长需手动启用；按指定演示时长线性变化，飘雪、冰面反光与时间线同步。不是冻结、降雪累积或融雪物理计算。',
    wind:'风速、持续时间、来向与阵风由你设定。阵风按假定间隔平滑增强再回落；旗布、树冠与风迹均为确定性视觉演示。旗杆、旗布和树木的尺寸及位置为示意，基础地形取公开DEM。风迹沿地形背景表达流向，不是实测三维风场；不计算结构受力、倒塌或树木折断。时间线独立于监测记录，结束或回放不解除风险记录。',
    heat:'内置绘图生成透明材质用于热浪视觉演示；默认增强示意用暖白波纹和放大的高度表达升腾，并非真实发光空气。可关闭增强，仅观察背景扭曲。温度、视觉倍率与遮阴决定强弱，上升速度为动画倍率。地表柔和色带不表示实测地表温度，热浪不是空气折射或人体风险求解。湿度仅作背景。',
    forest:'火险背景与独立火情模式分开。火源范围、增长速度和持续时间为手动假定，风向只驱动烟雾偏移。不是林火预测或燃烧求解；未设置火情模式与启动过程不会生成火焰。',
    landslide:'箭头将毫米级监测位移放大显示。滑移距离和时长为独立手动假定；默认待演示坡面及其裂缝、纵向滑带、分块和坡脚均为示意。路径只顺应公开DEM下坡方向；不改写真实山体，不计算稳定性、滑体体积守恒或实际堆积范围。',
    debris:'泥流速度、宽度、含固比例与时长均为手动假定，雨量不推算泥流发生或速度。路径来自局部DEM下坡采样，未核实黄央沟沟道，遇地形低点会停止；不是实际影响范围。泥流采用优先显示的贴地覆盖图层，颗粒循环表达流向，不表示泥流厚度、流量或守恒体积。'
  };
  function refresh() {
    const id=getState().selected;panel.hidden=!effectIds.includes(id);document.body.classList.toggle('effects-layout',!panel.hidden);document.body.classList.toggle('wind-layout',id==='wind');
    if(panel.hidden){dock.hide();iceInputs.hidden=true;processControls.refresh();if(current)setup(current).p.running=false;current=null;return;}
    const {s,n,c,p}=setup(id),snap=snapshot(id),h=hazards.find(h=>h.id===id);
    if(current!==id||identity!==s.effectSettings){if(current&&current!==id)setup(current).p.running=false;current=id;identity=s.effectSettings;
      $('#effect-fields').innerHTML=effectFields[id].map(f=>`<label>${f.label} / ${f.unit}<input type="number" data-effect-key="${f.key}" id="effect-${f.key}" min="${f.min}" max="${f.max}" step="${f.step}"></label>`).join('');
    }
    $('#effect-title').textContent=`${h.name} · 变量如何改变画面`;
    $('#effect-intro').textContent=id==='wind'?'在这里控制风速、时长与来向，启动后观察风迹、旗布和树冠。':['landslide','debris'].includes(id)?'监测提示与灾害运动示意分开。启动按钮或时间线才启用运动示意。':'右侧调整环境与现场输入，主沙盘同步显示对应现象。';
    $('#effect-readings').innerHTML=snap.notes.map((t,i)=>`<div><span>${['环境与监测','条件与现场','画面解释'][i]}</span><b>${t}</b></div>`).join('');
    $('#effect-legend').innerHTML=snap.legend.map(t=>`<span>${t}</span>`).join('');
    for(const f of effectFields[id]){const el=$('#effect-'+f.key);if(document.activeElement!==el)el.value=c[f.key];el.disabled=n.unknown;}
    $('#wind-controls').hidden=id!=='wind';transport.hidden=id!=='wind';iceInputs.hidden=id!=='ice';if(['ice','wind'].includes(id)){dock.panel.querySelector('strong').textContent=id==='ice'?'冰雪 · 道路覆盖与过程':'大风 · 风速、风向与过程';dock.show([id==='ice'?iceInputs:$('#wind-controls'),$('#effect-fields'),...(id==='ice'?[$('#effect-formation-label')]:[]),$('.effect-actions'),$('.effect-seek-label')]);}else dock.hide();if(id==='ice'){if(document.activeElement!==$('#ice-temperature'))$('#ice-temperature').value=n.value;$('#ice-temperature').disabled=n.unknown;$('#ice-surface').value=n.extra.surface;$('#ice-surface').disabled=n.unknown;$('#ice-accumulate').checked=c.accumulate;$('#ice-snowfall').checked=c.snowfall;$('#ice-accumulate').disabled=$('#ice-snowfall').disabled=n.unknown;}
    if(id==='wind'){
      for(const [kind,value] of [['speed',n.value],['duration',n.secondary],['direction',n.extra.direction]])for(const suffix of ['', '-number']){const el=$('#wind-'+kind+suffix);if(document.activeElement!==el)el.value=value;el.disabled=n.unknown;}
      document.querySelectorAll('[data-wind-view]').forEach(el=>{const active=el.dataset.windView===c.view;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
      $('#wind-gust').checked=c.gust;$('#wind-gust').disabled=n.unknown;$('#effect-gustPeak').min=n.value;$('#effect-gustPeak').disabled=n.unknown||!c.gust;$('#effect-gustPeriod').disabled=n.unknown||!c.gust;
      document.querySelectorAll('[data-wind-duration],[data-wind-direction]').forEach(el=>el.disabled=n.unknown);
      $('#wind-direction-reading').textContent=`设定来向 ${n.extra.direction}°；当前来自${snap.wind?.from??'—'}方，吹向${snap.wind?.toward??'—'}方`;
      $('#wind-current-speed').textContent=snap.unavailable?'未知':`${snap.wind.speed.toFixed(1)} m/s`;
      $('#wind-process-status').textContent=snap.unknown?'数据未知 · 冻结最后有效画面':!c.motion?'动态已关闭 · 下方可启用':snap.wind.ended?'已结束 · 旗布与树冠回落':p.running?'播放中':p.activated?'已暂停 · 可定位时间线':'尚未启动';
    }
    $('#effect-fields').hidden=!effectFields[id].length||(id==='wind'&&!c.gust);$('#effect-formation-label').hidden=id!=='ice';$('#effect-formation').checked=c.formation;$('#effect-formation').disabled=n.unknown;
    $('#effect-play').textContent=id==='wind'?(p.running?'暂停大风':'播放大风'):p.running?'暂停效果':id==='landslide'?'启动滑移示意':id==='debris'?'启动泥流示意':id==='ice'?'播放冰雪过程':id==='heat'?'播放热浪':id==='forest'?(p.activated&&c.fireMode==='fire'?(p.time>=snap.duration?'重新演示火情':'继续火情演示'):'启动火情演示'):'播放效果';
    const neededAssets={heat:['heat'],forest:['flame','smoke','soil'],landslide:['soil'],debris:['mud']}[id]??[];const assetsPending=neededAssets.some(name=>window.__processAssets?.[name]!=='ready');
    $('#effect-play').disabled=assetsPending||n.unknown||!c.motion||snap.duration===0||(id==='ice'&&(!snap.ice&&snap.targetSnow<=0||c.coverage===0))||(id==='wind'&&n.value<=0)||(id==='forest'&&(c.radius<=0||c.power<=0))||(id==='landslide'&&c.travel<=0)||(id==='debris'&&c.velocity<=0)||(id==='heat'&&(snap.heatGain<=0||c.rise===0));processControls.refresh();if(id==='ice'){const top=document.querySelector('#play');top.textContent=$('#effect-play').textContent;top.disabled=$('#effect-play').disabled;}$('#effect-rewind').disabled=n.unknown;$('#effect-motion').checked=c.motion;$('#effect-speed').value=p.speed;
    $('#effect-seek').max=snap.duration||1;$('#effect-seek').value=p.time;$('#effect-seek').disabled=n.unknown||snap.duration===0;$('#effect-time').textContent=`${p.time.toFixed(1)} / ${snap.duration.toFixed(0)} s`;
    $('#effect-validity').textContent=n.unknown?'数据未知：冻结最后有效示意，不能按正常状态使用。':!getScene()?'正在加载三维效果…':getScene().backend!=='WebGL / Three.js r185'?'当前设备三维渲染不可用，参数与文字解释仍可查看。':p.running?'效果播放中 · 所有参数为模拟':!c.motion?'动态已关闭 · 可拖动时间线查看静态阶段':'静态阶段 · 点击播放或拖动时间线';
    $('#effect-boundary').textContent=boundaries[id];panel.classList.toggle('effects-unknown',n.unknown);
    const layer=window.__hazardLayer;$('#effect-terrain-result').hidden=!['landslide','debris'].includes(id);
    $('#effect-terrain-result').textContent=layer?.id===id?(layer.pathPoints>1?`DEM示意下坡路径 ${layer.pathLengthMeters.toFixed(0)} m${id==='debris'?` · 当前泥流前沿 ${layer.frontMeters.toFixed(1)} m；到达示意路径终点后不再延伸`:''}`:'该点DEM采样未找到连续下坡路径，不伪造运动通道。'):'正在核对示意下坡路径…';
    if(id==='wind'){
      const motion=transport.querySelector('#wind-map-motion');motion.checked=c.motion;motion.disabled=n.unknown;const button=transport.querySelector('#wind-map-play');button.textContent=$('#effect-play').textContent;button.disabled=$('#effect-play').disabled;
      transport.querySelector('#wind-map-status').textContent=$('#wind-process-status').textContent;
      transport.querySelector('#wind-map-time').textContent=`${p.time.toFixed(1)} / ${snap.duration} 秒 · ${snap.wind?.speed.toFixed(1)??'—'} m/s`;
      const top=document.querySelector('#play');top.textContent=button.textContent;top.disabled=button.disabled;
    }
    window.__hazardEffects={...snap,running:p.running};
  }
  function frame(now){if(disposed)return;requestAnimationFrame(frame);const dt=Math.min(.5,(now-previous)/1000);previous=now;const id=getState().selected;if(!effectIds.includes(id)||document.hidden)return;const {n,c,p}=setup(id),wasRunning=p.running;if(p.running&&!n.unknown&&c.motion){const duration=snapshot(id).duration;p.time=Math.min(duration,p.time+dt*p.speed);if(p.time>=duration)p.running=false;}if(wasRunning){const tick=Math.floor(now/200);if(tick!==paint||!p.running){paint=tick;render();}}}
  let hintPaint=0;function cameraHint(now){if(disposed)return;requestAnimationFrame(cameraHint);if(getState().selected!=='wind'||now-hintPaint<200)return;hintPaint=now;const v=window.__windVisual,thin=v?.flagFaceAlignment<.3;transport.querySelector('#wind-camera-hint').textContent=thin?'旗布接近侧视，点击「恢复正面」看布面起伏':'拖动只改变视角，播放才推进风过程';}
  requestAnimationFrame(cameraHint);requestAnimationFrame(frame);refresh();
  return {refresh,snapshot,dispose(){disposed=true;dock.dispose();panel.remove();transport.remove();processControls.dispose();}};
}
