import * as THREE from 'three';
import {flagVertex,treeResponse} from './wind-model.js';

export function createWindLayer(scene,origin,height,canPlace=()=>true){
 const root=new THREE.Group();root.visible=false;scene.add(root);const flags=[],trees=[],occupied=[];
 const material=color=>new THREE.MeshStandardMaterial({color,roughness:.85,side:THREE.DoubleSide});
 const poleMaterial=material('#889b9a'),clothMaterial=material('#f2bd64'),trunkMaterial=material('#786452');clothMaterial.emissive.set('#f2bd64');clothMaterial.emissiveIntensity=.12;
 const foliage=['#477456','#62865b','#7b985f'].map(material),crownGeometry=new THREE.IcosahedronGeometry(1,1);
 function site(x,z){for(let ring=0;ring<10;ring++)for(let k=0;k<(ring?12:1);k++){const a=k*Math.PI/6,px=x+ring*.008*Math.cos(a),pz=z+ring*.008*Math.sin(a);if(canPlace(px,pz)&&occupied.every(q=>Math.hypot(q.x-px,q.z-pz)>.013)){const q={x:px,z:pz,y:height(px,pz)};occupied.push(q);return q;}}return null;}
 for(let i=0;i<3;i++){
  const q=site(origin.x-.033+i*.033,origin.z+.018);if(!q)continue;
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.00014,.0002,.01,10),poleMaterial);pole.position.set(q.x,q.y+.005,q.z);root.add(pole);
  const cloth=new THREE.Mesh(new THREE.PlaneGeometry(.006,.003,20,10),clothMaterial);cloth.geometry.setAttribute('uv',cloth.geometry.attributes.uv.clone());root.add(cloth);flags.push({q,cloth,index:i});
 }
 for(let i=0;i<6;i++){
  const q=site(origin.x-.046+(i%3)*.043,origin.z-.03-Math.floor(i/3)*.024);if(!q)continue;
  const tree=new THREE.Group();tree.position.set(q.x,q.y,q.z);root.add(tree);const h=.010+(i%3)*.001;
  const geometry=new THREE.CylinderGeometry(.00013,.00035,h,8,8);geometry.translate(0,h/2,0);const trunk=new THREE.Mesh(geometry,trunkMaterial);tree.add(trunk);const rest=Float32Array.from(geometry.attributes.position.array),crowns=[];
  for(let j=0;j<7;j++){const angle=j*2.399,base={x:Math.cos(angle)*.0013,z:Math.sin(angle)*.0013,y:h-.0018+(j%3)*.001};const leaf=new THREE.Mesh(crownGeometry,foliage[(i+j)%3]);leaf.position.set(base.x,base.y,base.z);leaf.scale.set(.0021,.0024,.0021);tree.add(leaf);crowns.push({leaf,base});}
  trees.push({q,tree,trunk,rest,crowns,h,index:i});
 }
 const count=48,segments=7,geometry=new THREE.BufferGeometry(),positions=new Float32Array(count*segments*6),alphas=new Float32Array(count*segments*2);geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('opacity',new THREE.BufferAttribute(alphas,1));
 const trails=new THREE.LineSegments(geometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{tint:{value:new THREE.Color('#d2f0f2')}},vertexShader:'attribute float opacity;varying float alpha;void main(){alpha=opacity;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying float alpha;uniform vec3 tint;void main(){gl_FragColor=vec4(tint,alpha);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));trails.frustumCulled=false;root.add(trails);
 const span=.18,windSites=occupied.length?occupied:[{...origin,y:height(origin.x,origin.z)}],xs=windSites.map(q=>q.x),zs=windSites.map(q=>q.z),ys=windSites.map(q=>q.y+.012);
 const center={x:(Math.min(...xs)+Math.max(...xs))/2,z:(Math.min(...zs)+Math.max(...zs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};const radius=Math.max(.065,Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),Math.max(...zs)-Math.min(...zs))/2+.018);
 let lastMetrics=null;
 function update(frame,unknown=false,camera=null,viewport=null){
  root.visible=true;const {vector:d}=frame,side={x:-d.z,z:d.x};let flagDelta=0,treeBend=0,pinnedError=0;
  for(const {q,cloth,index} of flags){const p=cloth.geometry.attributes.position,uv=cloth.geometry.attributes.uv;for(let j=0;j<p.count;j++){const u=uv.getX(j),v=1-uv.getY(j),r=flagVertex(u,v,index,frame);p.setXYZ(j,q.x+d.x*r.along+side.x*r.side,q.y+.0096+r.y,q.z+d.z*r.along+side.z*r.side);if(u===0)pinnedError=Math.max(pinnedError,Math.hypot(p.getX(j)-q.x,p.getZ(j)-q.z)*1000);if(u===1)flagDelta=Math.max(flagDelta,Math.hypot(r.along,r.side)*1000);}p.needsUpdate=true;cloth.geometry.computeVertexNormals();cloth.geometry.computeBoundingSphere();cloth.geometry.computeBoundingBox();}
  for(const item of trees){const r=treeResponse(item.index,frame),p=item.trunk.geometry.attributes.position;treeBend=Math.max(treeBend,r.bend);for(let j=0;j<p.count;j++){const y=item.rest[j*3+1],amount=r.bend*item.h*(y/item.h)**2;p.setXYZ(j,item.rest[j*3]+d.x*amount,y,item.rest[j*3+2]+d.z*amount);}p.needsUpdate=true;item.trunk.geometry.computeVertexNormals();item.trunk.geometry.computeBoundingBox();item.trunk.geometry.computeBoundingSphere();for(const {leaf,base} of item.crowns){const amount=r.bend*item.h*(base.y/item.h)**2;leaf.position.set(base.x+d.x*amount,base.y,base.z+d.z*amount);leaf.rotation.set(d.z*r.bend,0,-d.x*r.bend+r.flutter);}}
  const visibleCount=frame.active?Math.round(12+36*frame.strength):0,length=.008+frame.strength*.025;let v=0,a=0;
  for(let i=0;i<visibleCount;i++){
    const phase=(i*.61803398875%1)*span,along=((phase+frame.distance/1000)%span+span)%span-span/2,cross=Math.sin(i*12.9898)*.067,fade=Math.min(1,(span/2-Math.abs(along))/.015),altitude=.004+(i%5)*.003;
    for(let k=0;k<segments;k++)for(const tail of [k,k+1]){const t=tail/segments,forward=along-(1-t)*length,x=center.x+d.x*forward+side.x*cross,z=center.z+d.z*forward+side.z*cross;positions[v++]=x;positions[v++]=height(x,z)+altitude+.0008*Math.sin(t*Math.PI+i);positions[v++]=z;alphas[a++]=fade*t*(.35+.55*frame.strength);}
  }
  const treeTips=trees.map(item=>{let j=0;for(let k=1;k<item.rest.length/3;k++)if(item.rest[k*3+1]>item.rest[j*3+1])j=k;const p=item.trunk.geometry.attributes.position;return {x:(p.getX(j)-item.rest[j*3])*1000,z:(p.getZ(j)-item.rest[j*3+2])*1000};});
  const flagDirections=flags.map(({q,cloth})=>{const p=cloth.geometry.attributes.position,uv=cloth.geometry.attributes.uv;let x=0,z=0,n=0;for(let j=0;j<p.count;j++)if(uv.getX(j)===1){x+=p.getX(j)-q.x;z+=p.getZ(j)-q.z;n++;}return {x:x/n*1000,z:z/n*1000};});
  geometry.setDrawRange(0,visibleCount*segments*2);geometry.attributes.position.needsUpdate=true;geometry.attributes.opacity.needsUpdate=true;
  const signature=JSON.stringify([frame.time,frame.speed,frame.direction,frame.distance]);
  lastMetrics={visible:true,unknown,time:frame.time,speed:frame.speed,base:frame.base,peak:frame.peak,direction:frame.direction,vector:frame.vector,from:frame.from,toward:frame.toward,distanceMeters:frame.distance,trailCount:visibleCount,flagCount:flags.length,treeCount:trees.length,flagStretchMeters:flagDelta,treeBendRadians:treeBend,roots:trees.map(q=>q.tree.position.toArray()),treeTipsMeters:treeTips,flagDirectionsMeters:flagDirections,flagPinnedErrorMeters:pinnedError,rootsFixed:true,flagEdgesPinned:pinnedError<.003,ended:frame.ended,signature};
  if(camera&&viewport){
    root.updateMatrixWorld(true);
    const framing=object=>{const box=new THREE.Box3().setFromObject(object),projected=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])projected.push(new THREE.Vector3(x,y,z).project(camera));return {widthPixels:(Math.max(...projected.map(p=>p.x))-Math.min(...projected.map(p=>p.x)))*viewport.clientWidth/2,heightPixels:(Math.max(...projected.map(p=>p.y))-Math.min(...projected.map(p=>p.y)))*viewport.clientHeight/2,inFrame:projected.every(p=>Math.abs(p.x)<.97&&Math.abs(p.y)<.97&&p.z<1&&p.z>-1)};};
    lastMetrics.flagFraming=flags.map(q=>framing(q.cloth));lastMetrics.treeFraming=trees.map(q=>framing(q.tree));
  }
  window.__windVisual=lastMetrics;return lastMetrics;
 }
 return {bounds:{center,radius,flag:flags[1]?{center:{...flags[1].q,y:flags[1].q.y+.0077},radius:.012}:null,tree:trees[2]?{center:{...trees[2].q,y:trees[2].q.y+.006},radius:.015}:null},update,hide(){root.visible=false;window.__windVisual={visible:false};},dispose(){scene.remove(root);const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
