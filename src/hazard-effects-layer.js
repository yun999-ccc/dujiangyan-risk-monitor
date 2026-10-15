import {createProcessLayer} from './process-layer.js';
import {processIds} from './process-controls.js';
import {createWindLayer} from './wind-layer.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {hazards,project,unproject} from './model.js';
import {effectIds,effectSettings,effectSnapshot,downhillPath} from './hazard-effects-model.js';

export function createHazardEffectsLayer(scene,bounds,elevation,getState,container,roadBuilder,windPlacement) {
  const group=new THREE.Group();scene.add(group);let key='',live={},path=[],pathLength=0,currentId='';
  const label=document.createElement('div');label.className='effect-map-label';container.append(label);label.hidden=true;
  const v=new THREE.Vector3(),height=(x,z)=>{const p=unproject(x,z,bounds);return elevation(p.lon,p.lat);};
  const windHazard=hazards.find(h=>h.id==='wind'),windOrigin=project(windHazard.lon,windHazard.lat,bounds),windLayer=createWindLayer(scene,windOrigin,height,windPlacement);
  const processLayer=createProcessLayer(scene,bounds,height);
  const mat=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1,side:THREE.DoubleSide});
  function clear(){group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});group.clear();live={};}
  function mesh(geometry,material,parent=group){const m=new THREE.Mesh(geometry,material);parent.add(m);return m;}
  function line(points,color,dashed=false,opacity=.8){
    const curve=new THREE.CurvePath();for(let i=1;i<points.length;i++)curve.add(new THREE.LineCurve3(points[i-1],points[i]));
    const geometry=new THREE.TubeGeometry(curve,Math.max(8,points.length*3),.0013,5,false);
    const material=dashed?new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{tint:{value:new THREE.Color(color)},alpha:{value:opacity},length:{value:curve.getLength()}},vertexShader:'varying float along;void main(){along=uv.x;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying float along;uniform vec3 tint;uniform float alpha,length;void main(){if(mod(along*length,.03)>.018)discard;gl_FragColor=vec4(tint,alpha);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}):mat(color,opacity);
    return mesh(geometry,material);
  }
  const point=(x,z,offset=.004)=>new THREE.Vector3(x,height(x,z)+offset,z);
  function patch(x,z,r,color,opacity=.35){const geometry=new THREE.PlaneGeometry(r*2,r*2,24,24);geometry.rotateX(-Math.PI/2);const p=geometry.attributes.position;for(let i=0;i<p.count;i++){p.setX(i,p.getX(i)+x);p.setZ(i,p.getZ(i)+z);p.setY(i,height(p.getX(i),p.getZ(i))+.003);}geometry.computeVertexNormals();
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{tint:{value:new THREE.Color(color)},alpha:{value:opacity}},vertexShader:'varying vec2 coord;void main(){coord=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 tint;uniform float alpha;varying vec2 coord;void main(){float r=length(coord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(tint,alpha*(1.-smoothstep(.7,1.,r)));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
    return mesh(geometry,material);
  }
  function arrow(origin,direction,length,color){const a=new THREE.ArrowHelper(direction.clone().normalize(),origin,length,color,Math.min(length*.25,.035),Math.min(length*.13,.018));group.add(a);return a;}
  function trailSet(origin,dir,strength){const trails=[];for(let i=0;i<10;i++){const q=point(origin.x+Math.sin(i*4)*.16,origin.z+Math.cos(i*5)*.16,.045+(i%3)*.018);const m=line([q,q.clone().addScaledVector(dir,.04+strength*.08)],'#d6ebe0',false,.85);trails.push({m,base:q});}return trails;}
  function build(id,n,snap) {
    clear();currentId=id;path=[];pathLength=0;const h=hazards.find(h=>h.id===id),q=project(h.lon,h.lat,bounds),c=snap.settings;
    group.position.set(0,0,0);live.center=point(q.x,q.z,.09);
    if(id==='ice') {
      const attachment=roadBuilder?.nearestRoad(q.x,q.z);
      if(!attachment||attachment.distance>.1){live.caption='公开道路未覆盖该节点 · 不生成假路';live.roadBinding=null;}
      else {
        const road=attachment.road,center=new THREE.Vector2(attachment.x,attachment.z),radius=.2;
        live.center.set(center.x,road.height(center.x,center.y)+.002,center.y);
        live.roadBinding={id:road.id,part:road.part,name:road.name,distanceMeters:attachment.distance*1000,widthMeters:road.widthMeters,lengthMeters:road.lengthMeters,surfaceSource:road.elevationSource,scopeMeters:400,snowDepthMeters:snap.snow/100,verticalGapMeters:0};
        if(snap.targetCoverage>0&&(snap.ice||snap.targetSnow>0)){
          // Copy the exact rendered asphalt triangles. No separate road and no metre-scale lift.
          const geometry=new THREE.BufferGeometry();
          const vertices=road.geometry(),rise=0;live.roadBase=vertices.slice();
          for(let i=1;i<vertices.length;i+=3)vertices[i]+=rise;
          geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));geometry.computeVertexNormals();
          const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,uniforms:{center:{value:center},radius:{value:radius},coverage:{value:snap.coverage},tint:{value:new THREE.Color(snap.targetSnow>0?'#f5fafb':'#b8e6ef')},phase:{value:0}},vertexShader:'varying vec2 groundPosition;void main(){groundPosition=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 groundPosition;uniform vec2 center;uniform float radius,coverage,phase;uniform vec3 tint;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
void main(){if(distance(groundPosition,center)>radius||coverage<=0.)discard;
// Rank a smooth noise field so coverage endpoints are exactly dry/full.
float n=noise(groundPosition*900.);float rank=smoothstep(.12,.88,n);if(coverage<1.&&rank>coverage)discard;
float reflection=.025*sin(groundPosition.x*1200.+phase)*sin(groundPosition.y*1000.-phase);gl_FragColor=vec4(tint*(.97+reflection),1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
          const overlay=mesh(geometry,material);live.ice=overlay;
          if(snap.targetSnow>0&&c.snowfall){const snowGeometry=new THREE.BufferGeometry();snowGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(180*3),3));const snowMaterial=new THREE.PointsMaterial({color:'#ffffff',size:2.8,sizeAttenuation:false,transparent:true,opacity:.85,depthWrite:false});live.flakes=new THREE.Points(snowGeometry,snowMaterial);snowMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(length(gl_PointCoord-vec2(.5))>.5)discard;');};group.add(live.flakes);live.snowCenter=center;}
        }
        live.caption=`${road.name||'山区道路'} · OSM路段 ${road.id} · ${snap.snow>0?'积雪目标 '+snap.targetSnow+' cm':snap.ice?'冰面覆盖':'路面核查'}（假定）`;
      }
    } else if(id==='heat') {
      const color=new THREE.Color('#e3c996').lerp(new THREE.Color('#d66c38'),snap.strength);
      patch(q.x,q.z,.2,color,.15+snap.strength*.37);live.heat=[];
      for(let i=0;i<7;i++){const x=q.x+Math.sin(i*4)*.13,z=q.z+Math.cos(i*5)*.12,y=height(x,z);const pts=Array.from({length:13},(_,k)=>new THREE.Vector3(x+Math.sin(k*.8+i)*.004,y+.012+k*.006,z));const m=line(pts,'#efbb73',false,.15+snap.strength*.65);live.heat.push(m);}
      if(n.extra.shade==='有遮阴'){const canopy=mesh(new THREE.PlaneGeometry(.075,.075),mat('#839c82',.7));canopy.rotation.x=-Math.PI/2;canopy.position.copy(point(q.x,q.z,.05));}
      live.caption='局部温度色带与热浪示意 · 非热风险预测';
    } else if(id==='forest') {
      patch(q.x,q.z,.2,new THREE.Color('#b9b67c').lerp(new THREE.Color('#bd8b48'),snap.dryness),.12+snap.strength*.32);
      line(Array.from({length:65},(_,i)=>point(q.x+Math.cos(i/64*Math.PI*2)*.2,q.z+Math.sin(i/64*Math.PI*2)*.2,.007)),snap.strength>.55?'#d79b48':'#a4bc8d',true);
      live.smoke=[];
      if(snap.smoke)for(let i=0;i<9;i++){
        const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{alpha:{value:.4-i*.021}},vertexShader:'varying vec3 n;varying vec3 view;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);view=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 n,view;uniform float alpha;void main(){float edge=pow(max(0.,dot(normalize(n),normalize(view))),2.);gl_FragColor=vec4(vec3(.39,.44,.43),alpha*edge);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
        const m=mesh(new THREE.SphereGeometry(.014+i*.004,18,12),material);m.position.copy(point(q.x,q.z,.03+i*.023));live.smoke.push({m,index:i,base:m.position.clone()});
      }
      if(snap.wind>0){live.dir=new THREE.Vector3(1,0,0);live.trails=trailSet(q,live.dir,snap.wind/50);}
      live.caption=snap.smoke?'烟柱来自手动巡查记录 · 无火势演算':'火险关注示意 · 未设置火情';
    } else {
      path=downhillPath(q,height,id==='debris'?50:18,.012);pathLength=0;const distances=[0];for(let i=1;i<path.length;i++){pathLength+=Math.hypot(path[i].x-path[i-1].x,path[i].z-path[i-1].z);distances.push(pathLength);}
      live.path=path;live.distances=distances;
      if(path.length>1)line(path.map(p=>new THREE.Vector3(p.x,p.y+.007,p.z)),'#d2a783',true,.9);
      if(id==='landslide') {
        const direction=path.length>1?new THREE.Vector3(path[1].x-q.x,0,path[1].z-q.z).normalize():new THREE.Vector3(1,0,0);
        live.direction=direction;if(snap.displacement>0)arrow(point(q.x,q.z,.018),direction,.025+snap.displacement/20*.12,'#e4b270');
        if(snap.cracks)for(let j=0;j<3;j++)line(Array.from({length:12},(_,i)=>point(q.x-.045+i*.008,q.z+j*.014+Math.sin(i*4)*.003,.006)),'#73583d',false,.85);
        const soilGroup=new THREE.Group();group.add(soilGroup);const soilGeometry=new THREE.CylinderGeometry(.045,.043,.008,9,1,false);soilGeometry.rotateY(.2);
        soilGeometry.scale(1.2,1,.85);live.soilGeometry=soilGeometry;live.soilTop=Array.from(soilGeometry.attributes.position.array).filter((_,i)=>i%3===1).map(y=>y>=0);
        const material=new THREE.MeshStandardMaterial({color:'#a77d51',roughness:1,flatShading:true});mesh(soilGeometry,material,soilGroup);
        for(let i=0;i<6;i++){const rock=mesh(new THREE.DodecahedronGeometry(.004+(i%2)*.002,0),new THREE.MeshStandardMaterial({color:'#bf9c6c',roughness:1}),soilGroup);rock.position.set(Math.sin(i*7)*.027,.006,Math.cos(i*5)*.025);rock.scale.y=.6;}
        live.soil=soilGroup;
        live.caption='位移箭头为放大符号 · 滑移为独立假定';
      } else {
        const positions=[],lengths=[];
        const section=path.map((p,i)=>{
          const before=path[Math.max(0,i-1)],after=path[Math.min(path.length-1,i+1)],dx=after.x-before.x,dz=after.z-before.z,len=Math.hypot(dx,dz)||1,half=c.width/2000;
          return [point(p.x-dz/len*half,p.z+dx/len*half,.006),point(p.x+dz/len*half,p.z-dx/len*half,.006)];
        });
        for(let i=0;i<path.length-1;i++){
          const [pa,pb]=section[i],[pc,pd]=section[i+1];
          for(const [p,d] of [[pa,distances[i]],[pb,distances[i]],[pc,distances[i+1]],[pb,distances[i]],[pd,distances[i+1]],[pc,distances[i+1]]]){positions.push(p.x,p.y,p.z);lengths.push(d);}
        }
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('distanceAlong',new THREE.Float32BufferAttribute(lengths,1));
        const mud=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{front:{value:0},phase:{value:0},tint:{value:c.solids===0?new THREE.Color('#388daf'):new THREE.Color('#92582b').lerp(new THREE.Color('#553622'),c.solids/80)}},vertexShader:'attribute float distanceAlong;varying float d;varying vec2 loc;void main(){d=distanceAlong;loc=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float front,phase;uniform vec3 tint;varying float d;varying vec2 loc;void main(){if(d>front||front<=0.)discard;float band=.5+.5*sin(d*750.-phase*.6+sin(loc.x*310.)*1.4);float grooves=smoothstep(.82,1.,band);float grain=fract(sin(dot(floor(loc*800.),vec2(12.9898,78.233)))*43758.5453);float filtered=1.-smoothstep(.5,2.,max(fwidth(loc.x),fwidth(loc.y))*800.);gl_FragColor=vec4(tint*(.94+.06*band)+grooves*.045+(grain-.5)*.035*filtered,.97);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
        // Public rivers are vertically lifted illustrative tubes. Keep the selected
        // terrain-following phenomenon readable as an explicitly labelled overlay.
        mud.depthTest=false;live.mud=mesh(g,mud);live.mud.renderOrder=20;
        live.rocks=[];for(let i=0;i<32;i++){const material=mat('#c8b095');material.depthTest=false;material.transparent=true;material.depthWrite=false;const rock=mesh(new THREE.DodecahedronGeometry(.0015+(i%3)*.0005,0),material);rock.renderOrder=21;rock.visible=false;live.rocks.push(rock);}
        if(snap.blocked)for(let i=0;i<7;i++){const rock=mesh(new THREE.DodecahedronGeometry(.006,0),mat('#796e5b'));rock.position.copy(point(q.x-.015+i*.005,q.z,.01));}
        if(snap.abnormal)arrow(point(q.x+.04,q.z,.018),new THREE.Vector3(0,0,1),.07,'#73afb9');
        // Fixed seeded droplet positions, rainfall only changes visible count.
        live.rain=[];for(let i=0;i<24;i++){const p=point(q.x+Math.sin(i*13)*.13,q.z+Math.cos(i*7)*.13,.03+(i%7)*.017);const drop=line([p,p.clone().add(new THREE.Vector3(0,.012,0))],'#a9c9cf',false,.65);drop.visible=i<Math.round(snap.rain/100*24);live.rain.push(drop);}
        live.caption='泥流路径为DEM下坡示意 · 未核实沟道';
      }
    }
  }
  function along(distance){if(path.length<2)return path[0];const d=Math.min(pathLength,Math.max(0,distance));let i=1;while(i<live.distances.length-1&&live.distances[i]<d)i++;const t=(d-live.distances[i-1])/(live.distances[i]-live.distances[i-1]||1),a=path[i-1],b=path[i];return {x:THREE.MathUtils.lerp(a.x,b.x,t),z:THREE.MathUtils.lerp(a.z,b.z,t)};}
  function update(camera) {
    const s=getState(),id=s.selected;group.visible=effectIds.includes(id);label.hidden=!group.visible;if(!group.visible){windLayer.hide();processLayer.hide();window.__hazardLayer={visible:false,id};return;}
    const n=s.states[id],p=s.effectPlayback?.[id]??{time:0,activated:false,running:false},c=effectSettings(id,s.effectSettings?.[id]);
    const snap=n.unknown?{...(s.effectLastValid?.[id]??effectSnapshot(id,n,c)),unknown:true}:effectSnapshot(id,n,c,p.time,p.activated,p.windHistory);
    if(n.unknown&&!s.effectLastValid?.[id]){group.visible=false;windLayer.hide();processLayer.hide();label.hidden=true;window.__hazardLayer={id,visible:false,unknown:true};return;}
    if(id==='wind'){
      processLayer.hide();if(!n.unknown)s.effectLastValid.wind=snap;
      group.visible=false;const metrics=windLayer.update(snap.wind,snap.unknown,camera,container);label.hidden=false;label.textContent=`风过程示意 · ${snap.wind.speed.toFixed(1)} m/s · ${snap.wind.from} → ${snap.wind.toward}${snap.unknown?' · 数据未知，冻结画面':snap.wind.ended?' · 已结束':''}`;
      window.__hazardLayer={...metrics,id:'wind',caption:label.textContent,strength:snap.strength,direction:snap.direction,moving:p.running&&!snap.unknown,time:snap.time,visible:true};return;
    }
    windLayer.hide();
    if(processIds.includes(id)){if(!n.unknown)s.effectLastValid[id]=snap;group.visible=false;const metrics=processLayer.update(id,n,snap,camera,container);label.hidden=false;label.textContent=snap.unknown?'数据未知 · 冻结最后有效示意':`${id==='heat'?'热浪纹理示意':id==='forest'?'火险/火情为手动示意':id==='landslide'?'独立土体滑移示意':'泥流前沿与颗粒示意'}${!snap.activated?' · 尚未启动':''}`;window.__hazardLayer={...metrics,unknown:snap.unknown,moving:p.running&&!snap.unknown&&snap.motion,time:snap.time,caption:label.textContent,strength:snap.strength};return;}
    processLayer.hide();
    const cacheKey=JSON.stringify([id,snap.input,snap.settings]);
    if(key!==cacheKey){key=cacheKey;build(id,snap.input,snap);}
    const time=snap.time??0,moving=p.running&&!snap.unknown&&snap.motion;
    if(live.ice){live.ice.material.uniforms.phase.value=time*2.;live.ice.material.uniforms.coverage.value=snap.coverage;const vertices=live.ice.geometry.attributes.position;for(let i=0;i<vertices.count;i++)vertices.setY(i,live.roadBase[i*3+1]+snap.snow/100000);vertices.needsUpdate=true;if(live.roadBinding)live.roadBinding.snowDepthMeters=snap.snow/100;}
    if(id==='ice'&&live.roadBinding)live.caption=`${live.roadBinding.name||'山区道路'} · ${snap.targetSnow>0?'积雪 '+snap.snow.toFixed(1)+' cm':snap.ice?'冰面':'无冰雪覆盖'} · 覆盖 ${(snap.coverage*100).toFixed(0)}%（假定）`;
    if(live.flakes){live.flakes.visible=snap.snowfall;const vertices=live.flakes.geometry.attributes.position;for(let i=0;i<vertices.count;i++){const x=live.snowCenter.x+Math.sin(i*13.37)*.065+Math.sin(time*.6+i)*.002,z=live.snowCenter.y+Math.cos(i*7.41)*.065;vertices.setXYZ(i,x,height(x,z)+.001+((i*.00137-time*.006)% .045+.045)%.045,z);}vertices.needsUpdate=true;live.flakes.geometry.computeBoundingSphere();}

    if(live.trails)for(let i=0;i<live.trails.length;i++){const {m}=live.trails[i];m.position.copy(live.dir).multiplyScalar(((time*(id==='wind'?(.03+snap.strength*.14):.03+snap.wind*.004)+i*.027)%.24)-.12);}
    if(live.heat)for(let i=0;i<live.heat.length;i++)live.heat[i].position.x=Math.sin(time*2+i)*.006*snap.strength;
    if(live.smoke)for(const {m,index,base} of live.smoke){m.position.copy(base);m.position.x+=snap.wind/50*index*.014+Math.sin(time+index)*.004;}
    if(live.soil){const q=along(snap.travel/1000),ground=height(q.x,q.z);live.soil.position.set(q.x,ground,q.z);live.soil.visible=snap.activated&&snap.travel>0&&path.length>1;
      if(live.soilLocation!==`${q.x}:${q.z}`){live.soilLocation=`${q.x}:${q.z}`;const p=live.soilGeometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,height(q.x+p.getX(i),q.z+p.getZ(i))-ground+(live.soilTop[i]?.012:.004));p.needsUpdate=true;live.soilGeometry.computeVertexNormals();live.soilGeometry.computeBoundingBox();live.soilGeometry.computeBoundingSphere();for(const rock of live.soil.children.slice(1))rock.position.y=height(q.x+rock.position.x,q.z+rock.position.z)-ground+.016;}
    }
    if(live.mud){const front=Math.min(pathLength,snap.distance/1000);live.mud.visible=snap.activated&&front>0&&path.length>1;live.mud.material.uniforms.front.value=front;live.mud.material.uniforms.phase.value=time*snap.settings.velocity;
      const count=Math.round(snap.settings.solids/80*32);for(let i=0;i<live.rocks.length;i++){const rock=live.rocks[i];rock.visible=live.mud.visible&&i<count;if(rock.visible){const d=(time*snap.settings.velocity/1000+i*.017)%Math.max(.0001,front),q=along(d);rock.position.copy(point(q.x+Math.sin(i*11)*snap.settings.width/5000,q.z,.009));}}
    }
    if(live.rain)for(let i=0;i<live.rain.length;i++)live.rain[i].position.y=-(time*.03+i*.01)%.045;
    const caption=snap.unknown?'数据未知 · 冻结最后有效示意':`${live.caption}${['landslide','debris'].includes(id)&&!snap.activated?' · 尚未启动运动':''}`;
    v.copy(live.center).project(camera);label.hidden=v.z>1||Math.abs(v.x)>1||Math.abs(v.y)>1;label.textContent=caption;label.style.left=`${(v.x*.5+.5)*container.clientWidth}px`;label.style.top=`${(-v.y*.5+.5)*container.clientHeight}px`;
    let soilInFrame=true;if(live.soil?.visible){live.soil.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(live.soil);for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);if(Math.abs(p.x)>.98||Math.abs(p.y)>.98||p.z>1)soilInFrame=false;}}
    window.__hazardLayer={soilInFrame,id,visible:true,caption,roadBinding:live.roadBinding??null,moving,time,ice:snap.ice,snow:snap.snow,coverage:snap.coverage,snowfallVisible:!!live.flakes?.visible,snowSignature:live.flakes?.visible?Array.from(live.flakes.geometry.attributes.position.array.slice(0,12)):[],smoke:!!snap.smoke,soilVisible:!!live.soil?.visible,mudVisible:!!live.mud?.visible,pathPoints:path.length,pathLengthMeters:pathLength*1000,frontMeters:Math.min(pathLength*1000,snap.distance??0),strength:snap.strength,direction:snap.direction,unknown:snap.unknown};
  }
  return {update,windBounds:windLayer.bounds,processBounds:processLayer.framing,dispose(){processLayer.dispose();windLayer.dispose();label.remove();clear();scene.remove(group);}};
}
