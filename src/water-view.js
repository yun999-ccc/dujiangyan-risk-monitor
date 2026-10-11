import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {streetHeight,waterCoverage,waterTrend} from './water-model.js';

export function mountWaterView(getState,onDepth,onLocate){
  const panel=document.createElement('section');panel.className='panel water-panel';panel.setAttribute('aria-label','道路积水近景示意');
  panel.innerHTML=`<div class="water-heading"><div><span class="water-eyebrow">LOCAL WATER STUDY · 局部示意</span><h2>水深变化，看见淹没关系。</h2><p>同一模拟节点 · 道路、地面高差和建筑均为设计示意</p></div><button class="btn" id="water-locate">定位区域点位</button></div>
  <div class="water-stage"><div id="water-canvas" role="img" aria-label="可旋转的道路积水三维示意"></div><div class="water-reading"><span>低洼参考点水深</span><strong id="water-reading"></strong><small id="water-validity"></small></div><div class="water-ruler" aria-label="0至60厘米水深刻度"><div id="water-ruler-fill"></div><span>60</span><span>30</span><span>15</span><span>0 cm</span></div><div class="water-canvas-caption">拖动旋转 · 滚轮缩放<br>水面高度按米显示，无垂直夸张</div></div>
  <div class="water-console"><div class="water-input"><label for="water-depth">积水深度 <output id="water-depth-output"></output></label><input type="range" id="water-depth" min="0" max="60" step="1"><div class="water-samples">${[0,5,15,30,60].map(v=>`<button data-water-sample="${v}">${v} cm</button>`).join('')}</div></div><div class="water-settings"><label><input type="checkbox" id="water-animation" checked> 水面微波纹</label><label><input type="checkbox" id="water-rain" checked> 降雨时显示涟漪</label><button class="btn" id="water-camera">恢复近景视角</button></div></div>
  <div class="water-summary"><span id="water-trend"></span><span id="water-rate"></span><span id="water-area"></span><span id="water-rain-state"></span></div><p class="water-boundary">范围仅根据本示意盆地的地面高差计算，不代表真实区域淹没。波纹为视觉效果，不表示流速；河道水位独立。暂停模拟停止水位演算，微波纹可单独关闭。</p>`;
  document.querySelector('.map-panel').after(panel);
  const $=s=>panel.querySelector(s),container=$('#water-canvas');let renderer;
  let animation=true,rainEffects=true,lastValid=getState().states.water.lastValidVisualDepth??getState().states.water.history?.at(-1)?.v??8,lastArea=-1,cachedArea=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;animation=!reduced;rainEffects=!reduced;$('#water-animation').checked=animation;$('#water-rain').checked=rainEffects;
  $('#water-depth').oninput=e=>onDepth(+e.target.value);
  for(const button of panel.querySelectorAll('[data-water-sample]'))button.onclick=()=>onDepth(+button.dataset.waterSample);
  $('#water-locate').onclick=onLocate;
  $('#water-animation').onchange=e=>{animation=e.target.checked;refresh()};$('#water-rain').onchange=e=>{rainEffects=e.target.checked;refresh()};
  let scene,camera,controls,water,uniforms,disposed=false,phase=0,lastFrame=performance.now(),observer;
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor('#e8eee7');renderer.outputColorSpace=THREE.SRGBColorSpace;container.append(renderer.domElement);
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(37,1,.1,150);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=5;controls.maxDistance=55;controls.maxPolarAngle=Math.PI*.47;
    const reset=()=>{camera.position.set(20,15,23);controls.target.set(0,.5,0);if(container.clientWidth<640)camera.position.sub(controls.target).multiplyScalar(1.4).add(controls.target);controls.update();};reset();$('#water-camera').onclick=reset;
    scene.add(new THREE.HemisphereLight('#f4f9ff','#858d79',2));const sun=new THREE.DirectionalLight('#fff5db',2.5);sun.position.set(-12,20,8);scene.add(sun);
    function box(x,y,z,w,h,d,color){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.9}));mesh.position.set(x,y,z);scene.add(mesh);return mesh;}
    box(0,-.25,0,22,.5,26,'#bbc4ae');
    const road=new THREE.PlaneGeometry(9,26,36,104);road.rotateX(-Math.PI/2);const pos=road.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,streetHeight(pos.getX(i),pos.getZ(i)));road.computeVertexNormals();scene.add(new THREE.Mesh(road,new THREE.MeshStandardMaterial({color:'#4f5759',roughness:1})));
    for(const side of [-1,1]){
      // Walkway and verge elevations agree with the water mask.
      for(const [center,width,color] of [[5.5,2,'#ccc8b9'],[8.75,4.5,'#a3b58c']]){
        const g=new THREE.PlaneGeometry(width,26,8,104);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i)+center*side;p.setX(i,x);p.setY(i,streetHeight(x,p.getZ(i)));}g.computeVertexNormals();scene.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:1})));
      }
      for(let z=-12;z<=12;z+=1)box(side*4.52,.22+.002*z*z,z,.12,.13,.97,'#e2dfcc');
      for(const z of [-7,0,7]){
        box(side*9,2.45,z,4,4.2,5,'#e6e3d7');box(side*9,4.6,z,4.15,.18,5.12,'#74847f');
        box(side*7.07,.52,z,.12,.32,1.2,'#bab9a8');box(side*7.02,1.25,z,.06,1.5,.75,'#405c58');
        for(const level of [1.4,2.8,3.8])for(const dz of [-1.7,1.7])box(side*6.99,level,z+dz,.035,.63,.75,'#73909a');
        box(side*8,.8,z-2.65,.1,1.6,.1,'#788776');
      }
      for(const z of [-10,10]){
        box(side*3.8,streetHeight(side*3.8,z)+.008,z,.65,.012,.9,'#222f33');for(let k=0;k<6;k++)box(side*3.8,streetHeight(side*3.8,z)+.02,z-.35+k*.14,.6,.008,.035,'#8d9995');
      }
    }
    for(let z=-12;z<=12;z+=3)box(0,streetHeight(0,z)+.009,z,.1,.015,1.2,'#e3d2a2');
    // A flat level plane clips against the designed ground and building footprint.
    uniforms={depth:{value:.08},time:{value:0},rain:{value:0},unknown:{value:0},waveAmplitude:{value:1}};
    const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,vertexShader:`varying vec2 local;void main(){local=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
      uniform float depth,time,rain,unknown,waveAmplitude;varying vec2 local;
      float ground(vec2 p){float a=abs(p.x);if(a<=4.5)return .011*p.x*p.x+.002*p.y*p.y;if(a<=6.5)return .28+.002*p.y*p.y;return .35+.001*p.y*p.y;}
      void main(){vec2 p=local;float d=depth-ground(p);if(depth<=0.||d<=0.)discard;
        if(abs(p.x)>=7.&&abs(p.x)<=11.&&(abs(p.y+7.)<=2.5||abs(p.y)<=2.5||abs(p.y-7.)<=2.5))discard;
        float waves=sin(p.x*3.+time*.65)*sin(p.y*2.2-time*.4);float ripple=0.;
        for(int i=0;i<8;i++){float k=float(i);vec2 c=vec2(sin(k*14.3)*4.,cos(k*8.1)*11.);float dist=length(p-c),age=fract(time*.27+k*.137);ripple+=exp(-pow((dist-age*2.5)*12.,2.))*(1.-age);}
        vec3 color=mix(vec3(.33,.69,.73),vec3(.08,.39,.50),clamp(d/.6,0.,1.));color+=waves*waveAmplitude*.025+ripple*rain*.09;float edge=1.-smoothstep(0.,.035,d);color=mix(color,vec3(.67,.83,.80),edge*.48);color=mix(color,vec3(.43,.49,.48),unknown*.8);
        gl_FragColor=vec4(color,mix(.52,.91,clamp(d/.25,0.,1.)));
#include <tonemapping_fragment>\n#include <colorspace_fragment>
      }`});
    const g=new THREE.PlaneGeometry(22,26);g.rotateX(-Math.PI/2);water=new THREE.Mesh(g,material);water.position.y=.081;scene.add(water);
    // Small physical gauge; large DOM scale remains readable at every zoom.
    box(.85,.39,.1,.08,.78,.08,'#f4eee0');for(const y of [0,.15,.3,.45,.6])box(.92,y+.01,.1,.12,.018,.09,'#536f63');
    observer=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();});observer.observe(container);
  }catch{controls?.dispose();observer?.disconnect();renderer?.dispose();renderer=null;scene=null;controls=null;container.innerHTML='<div class="water-fallback">三维渲染不可用。水深与右侧刻度仍可联动，范围为示意地面计算。</div>';$('#water-camera').disabled=true;}
  function refresh(){
    const state=getState(),n=state.states.water;panel.hidden=state.selected!=='water';if(panel.hidden)return;
    if(!n.unknown){lastValid=n.value;n.lastValidVisualDepth=n.value;}const depth=lastValid,weather=state.weather['河谷居民区'];
    $('#water-reading').textContent=`${depth.toFixed(0)} cm`;$('#water-validity').textContent=n.unknown?'最后有效模拟状态 · 当前数据未知':'模拟水深 · 低洼参考点为零高程';
    $('#water-depth').value=n.value;$('#water-depth').disabled=n.unknown;$('#water-depth-output').textContent=n.unknown?'数据未知':`${n.value} cm`;
    for(const button of panel.querySelectorAll('[data-water-sample]'))button.disabled=n.unknown;
    $('#water-ruler-fill').style.height=`${depth/60*100}%`;panel.classList.toggle('water-unknown',n.unknown);
    if(lastArea!==depth){lastArea=depth;cachedArea=waterCoverage(depth);}
    $('#water-trend').textContent=n.unknown?'趋势未知':`${waterTrend(n)} · ${state.running?'模拟运行中':'模拟已暂停'}`;
    $('#water-rate').textContent=`设置涨退速度 ${n.secondary} cm/min`;
    $('#water-area').textContent=`示意覆盖面积 ≈ ${cachedArea.toFixed(1)} m²`;
    $('#water-rain-state').textContent=weather.enabled?`片区模拟雨强 ${weather.rain.toFixed(1)} mm/h`:'片区模拟降雨关闭';
    if(water){water.visible=depth>0;water.position.y=depth/100+.001;uniforms.depth.value=depth/100;uniforms.unknown.value=n.unknown?1:0;uniforms.waveAmplitude.value=animation?1:0;uniforms.rain.value=weather.enabled&&rainEffects&&!n.unknown?Math.min(1,weather.rain/60):0;}
    window.__waterView={depth,unknown:n.unknown,area:cachedArea,phase,rainActive:!!(weather.enabled&&rainEffects&&weather.rain>0&&!n.unknown),waterVisible:depth>0,animation,backend:renderer?'WebGL':'fallback'};
  }
  function frame(now){if(disposed)return;requestAnimationFrame(frame);const dt=Math.min(.1,(now-lastFrame)/1000);lastFrame=now;if(panel.hidden||document.hidden)return;
    const state=getState(),weather=state.weather['河谷居民区'];if((animation||(rainEffects&&weather.enabled&&weather.rain>0))&&!state.states.water.unknown)phase+=dt;if(uniforms)uniforms.time.value=phase;
    controls?.update();if(renderer&&scene)renderer.render(scene,camera);if(window.__waterView)window.__waterView.phase=phase;
  }
  refresh();requestAnimationFrame(frame);
  return {refresh,dispose(){disposed=true;observer?.disconnect();controls?.dispose();scene?.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});renderer?.dispose();}};
}
