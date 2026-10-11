import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {hazards,project,unproject} from './model.js';
import {effectIds,effectSettings,effectSnapshot,downhillPath} from './hazard-effects-model.js';

export function createHazardEffectsLayer(scene,bounds,elevation,getState,container) {
  const group=new THREE.Group();scene.add(group);let key='',live={},path=[],pathLength=0,currentId='';
  const label=document.createElement('div');label.className='effect-map-label';container.append(label);label.hidden=true;
  const v=new THREE.Vector3(),height=(x,z)=>{const p=unproject(x,z,bounds);return elevation(p.lon,p.lat);};
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
  function windArrow(x,z,dir,length){const side=new THREE.Vector3(-dir.z,0,dir.x),make=(d,w)=>point(x+dir.x*d+side.x*w,z+dir.z*d+side.z*w,.005),end=length*.72;
    const shape=[make(0,-.003),make(end,-.003),make(end,-.014),make(length,0),make(end,.014),make(end,.003),make(0,.003)],positions=[];
    for(const [a,b,c] of [[0,1,5],[0,5,6],[2,3,4]])for(const i of [a,b,c])positions.push(shape[i].x,shape[i].y,shape[i].z);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const material=mat('#bbdfc4',.95);material.depthTest=false;const m=mesh(g,material);m.renderOrder=18;return m;
  }
  function trailSet(origin,dir,strength){const trails=[];for(let i=0;i<10;i++){const q=point(origin.x+Math.sin(i*4)*.16,origin.z+Math.cos(i*5)*.16,.045+(i%3)*.018);const m=line([q,q.clone().addScaledVector(dir,.04+strength*.08)],'#d6ebe0',false,.85);trails.push({m,base:q});}return trails;}
  function build(id,n,snap) {
    clear();currentId=id;path=[];pathLength=0;const h=hazards.find(h=>h.id===id),q=project(h.lon,h.lat,bounds),c=snap.settings;
    group.position.set(0,0,0);live.center=point(q.x,q.z,.09);
    if(id==='ice') {
      const road=new THREE.PlaneGeometry(.05,.28,8,48);road.rotateX(-Math.PI/2);const p=road.attributes.position;for(let i=0;i<p.count;i++){p.setX(i,p.getX(i)+q.x);p.setZ(i,p.getZ(i)+q.z);p.setY(i,height(p.getX(i),p.getZ(i))+.004);}mesh(road,mat('#606c69',.9));
      for(let i=0;i<16;i++){const z=q.z-.13+i*.017;line([point(q.x-.002,z,.005),point(q.x-.002,z+.008,.005)],'#e4dfca');}
      const iceGeometries=[],snowGeometries=[];
      if(snap.ice||snap.snow>0)for(let i=0;i<100;i++){if(((i*37)%100)/100>=snap.coverage)continue;const x=q.x-.022+(i%5)*.011,z=q.z-.135+Math.floor(i/5)*.014;
        const g=new THREE.CircleGeometry(.006,6);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let j=0;j<p.count;j++){p.setX(j,p.getX(j)+x);p.setZ(j,p.getZ(j)+z);p.setY(j,height(p.getX(j),p.getZ(j))+.006);}g.computeVertexNormals();iceGeometries.push(g);
        if(snap.snow>0){
          const snow=new THREE.CircleGeometry(.0065,8);snow.rotateX(-Math.PI/2);const sp=snow.attributes.position;
          for(let j=0;j<sp.count;j++){const spread=j===0?1:.85+.16*Math.sin(i*7+j*13),px=x+sp.getX(j)*spread,pz=z+sp.getZ(j)*spread;sp.setXYZ(j,px,height(px,pz)+.007+snap.snow/100000,pz);}
          snow.computeVertexNormals();snowGeometries.push(snow);
        }
      }
      for(const [geometries,color,opacity] of [[iceGeometries,snap.ice?'#b8e6ef':'#f7fbfd',snap.ice?.78:.94],[snowGeometries,'#f5fafb',1]])if(geometries.length){const m=mesh(mergeGeometries(geometries),mat(color,opacity));if(geometries===iceGeometries&&snap.ice)live.ice=m;geometries.forEach(g=>g.dispose());}
      live.caption=snap.ice?'冰面 · 路段与覆盖为假定':snap.snow>0?'积雪 · 厚度与范围为假定':'路面待核查 · 未确认结冰';
    } else if(id==='wind') {
      // Meteorological direction is where wind comes FROM; x east, z south.
      const a=snap.direction*Math.PI/180,dir=new THREE.Vector3(-Math.sin(a),0,Math.cos(a));
      if(snap.active){for(let i=0;i<3;i++)windArrow(q.x-.12+i*.12,q.z,dir,.08+snap.strength*.16);live.trails=trailSet(q,dir,snap.strength);live.dir=dir;}
      live.flags=[];for(let i=0;i<3;i++){const x=q.x-.1+i*.1,z=q.z+.06,pole=mesh(new THREE.CylinderGeometry(.001,.001,.05,5),mat('#899785'));pole.position.copy(point(x,z,.025));const flag=mesh(new THREE.PlaneGeometry(.025,.012),mat('#ddcc87'));flag.position.copy(point(x+.013,z,.045));flag.rotation.y=-a;live.flags.push(flag);}
      live.caption=`风迹与旗帜为受风示意 · 来向${snap.direction}°`;
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
    const s=getState(),id=s.selected;group.visible=effectIds.includes(id);label.hidden=!group.visible;if(!group.visible){window.__hazardLayer={visible:false,id};return;}
    const n=s.states[id],p=s.effectPlayback?.[id]??{time:0,activated:false,running:false},c=effectSettings(id,s.effectSettings?.[id]);
    const snap=n.unknown?{...(s.effectLastValid?.[id]??effectSnapshot(id,n,c)),unknown:true}:effectSnapshot(id,n,c,p.time,p.activated);
    if(n.unknown&&!s.effectLastValid?.[id]){group.visible=false;label.hidden=true;window.__hazardLayer={id,visible:false,unknown:true};return;}
    const cacheKey=JSON.stringify([id,snap.input,snap.settings]);
    if(key!==cacheKey){key=cacheKey;build(id,snap.input,snap);}
    const time=snap.time??0,moving=p.running&&!snap.unknown&&snap.motion;
    if(live.ice)live.ice.material.color.set('#9ccddc').lerp(new THREE.Color('#dff7fc'),.5+.25*Math.sin(time*.7));
    if(live.trails)for(let i=0;i<live.trails.length;i++){const {m}=live.trails[i];m.position.copy(live.dir).multiplyScalar(((time*(id==='wind'?(.03+snap.strength*.14):.03+snap.wind*.004)+i*.027)%.24)-.12);}
    if(live.flags)for(let i=0;i<live.flags.length;i++)live.flags[i].rotation.z=(snap.active?snap.strength:0)*Math.sin(time*4+i)*.25;
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
    window.__hazardLayer={soilInFrame,id,visible:true,caption,moving,time,ice:snap.ice,snow:snap.snow,smoke:!!snap.smoke,soilVisible:!!live.soil?.visible,mudVisible:!!live.mud?.visible,pathPoints:path.length,pathLengthMeters:pathLength*1000,frontMeters:Math.min(pathLength*1000,snap.distance??0),strength:snap.strength,direction:snap.direction,unknown:snap.unknown};
  }
  return {update,dispose(){label.remove();clear();scene.remove(group);}};
}
