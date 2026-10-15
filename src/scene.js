import {buildingHeight} from './geometry-audit.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createMapNavigation} from './map-navigation.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {roadWaterCrossings,corridorMask} from './asset-relations.js';
import {createRegionalWater} from './regional-water.js';
import {surfaceHeight,createRoadBuilder} from './city-geometry.js';
import {hazards,project,unproject,interpolateHeight,levels} from './model.js';
import {createLightningLayer} from './lightning-layer.js';
import {lightningRegions,channelShape} from './lightning-model.js';
import {effectSettings,downhillPath} from './hazard-effects-model.js';
import {arrangeLabels} from './map-labels.js';
import {createMapFallback} from './map-fallback.js';
import {createHazardEffectsLayer} from './hazard-effects-layer.js';
export async function createScene(container,getState,onSelect){
 const terrain=await fetch(import.meta.env.BASE_URL+'data/terrain.json').then(r=>{if(!r.ok)throw Error('高程数据加载失败');return r.json()});
 const b=terrain.bounds,n=terrain.size;const width=project(b.east,b.north,b).x*2,depth=project(b.east,b.south,b).z*2,min=terrain.heights.reduce((a,v)=>Math.min(a,v),Infinity);
 const elevation=(lon,lat)=>(surfaceHeight(lon,lat,terrain)-min)/1000*1.8+.18;
 let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch(e){return createMapFallback(container,terrain,getState,onSelect)}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor('#e9efdf');container.prepend(renderer.domElement);
 const scene=new THREE.Scene();scene.fog=new THREE.Fog('#e9efdf',60,120);const camera=new THREE.PerspectiveCamera(38,1,.01,200);camera.position.set(23,24,27);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=.012;controls.maxDistance=68;controls.maxPolarAngle=Math.PI*.48;controls.target.set(0,1.1,0);
 scene.add(new THREE.HemisphereLight('#e9f2ff','#8b9272',1.25));const sun=new THREE.DirectionalLight('#fff3d6',1.9);sun.position.set(-12,18,-10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:.5,far:70});sun.shadow.bias=-.00001;sun.shadow.normalBias=.0005;scene.add(sun.target);scene.add(sun);
 const geom=new THREE.PlaneGeometry(width,depth,n-1,n-1);geom.rotateX(-Math.PI/2);const p=geom.attributes.position;const colors=[],commandColors=[];
 for(let i=0;i<p.count;i++){const h=terrain.heights[i];p.setY(i,(h-min)/1000*1.8+.18);const stops=[[650,'#dad4b1'],[850,'#a4b87b'],[1300,'#6f8e58'],[1800,'#5f7a50'],[2300,'#92927a'],[3100,'#c4bda2']];let band=0;while(band<stops.length-2&&h>stops[band+1][0])band++;const c=new THREE.Color(stops[band][1]).lerp(new THREE.Color(stops[band+1][1]),Math.max(0,Math.min(1,(h-stops[band][0])/(stops[band+1][0]-stops[band][0]))));colors.push(c.r,c.g,c.b);const dark=new THREE.Color('#172b30').lerp(new THREE.Color('#385047'),(h-min)/2300);commandColors.push(dark.r,dark.g,dark.b);}
 geom.computeVertexNormals();
 // Slope/valley shading uses the DEM itself; no synthetic displacement of geography.
 for(let i=0;i<p.count;i++){const slope=1-geom.attributes.normal.getY(i),row=Math.floor(i/n),col=i%n,h=terrain.heights[i];const around=[Math.max(0,row-2)*n+col,Math.min(n-1,row+2)*n+col,row*n+Math.max(0,col-2),row*n+Math.min(n-1,col+2)].reduce((a,k)=>a+terrain.heights[k],0)/4;const valley=THREE.MathUtils.clamp((around-h)/85,0,.22);const c=new THREE.Color().fromArray(colors,i*3);c.lerp(new THREE.Color('#b8af92'),THREE.MathUtils.smoothstep(slope,.12,.55)*.7);c.multiplyScalar(1-valley);c.toArray(colors,i*3);}
 geom.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const terrainMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:false});
 // Fine mineral grain is material detail, not invented terrain height.
 terrainMaterial.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 terrainPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nterrainPosition = position;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 terrainPosition;\nfloat grain(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}').replace('#include <color_fragment>','#include <color_fragment>\nfloat g=grain(floor(terrainPosition.xz*1100.0));\nfloat filterWidth=max(fwidth(terrainPosition.x),fwidth(terrainPosition.z))*1100.0;\ndiffuseColor.rgb *= 1.0 + (g-.5)*.035*(1.0-smoothstep(.5,2.0,filterWidth));');};
 const terrainMesh=new THREE.Mesh(geom,terrainMaterial);terrainMesh.castShadow=false;terrainMesh.receiveShadow=true;scene.add(terrainMesh);
 // Geological slab follows the sampled edge, rather than a flat pedestal.
 const border=[];for(let x=0;x<n;x++)border.push(x);for(let y=1;y<n;y++)border.push(y*n+n-1);for(let x=n-2;x>=0;x--)border.push((n-1)*n+x);for(let y=n-2;y>0;y--)border.push(y*n);
 const sides=[];for(let i=0;i<border.length;i++){const a=border[i],d=border[(i+1)%border.length],ax=p.getX(a),az=p.getZ(a),ay=p.getY(a),dx=p.getX(d),dz=p.getZ(d),dy=p.getY(d);sides.push(ax,ay,az,ax,-.35,az,dx,dy,dz,dx,dy,dz,ax,-.35,az,dx,-.35,dz);}
 const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(sides,3));sg.computeVertexNormals();scene.add(new THREE.Mesh(sg,new THREE.MeshStandardMaterial({color:'#829073',roughness:1,side:THREE.DoubleSide})));
 const contourPoints=[];for(let target=800;target<2900;target+=200){for(let y=0;y<n-1;y+=1)for(let x=0;x<n-1;x+=1){const ids=[y*n+x,y*n+x+1,(y+1)*n+x+1,(y+1)*n+x],hits=[];for(let k=0;k<4;k++){const a=ids[k],d=ids[(k+1)%4],ha=terrain.heights[a],hd=terrain.heights[d];if((ha<target&&hd>=target)||(hd<target&&ha>=target)){const t=(target-ha)/(hd-ha);hits.push([p.getX(a)+(p.getX(d)-p.getX(a))*t,(target-min)/1000*1.8+.195,p.getZ(a)+(p.getZ(d)-p.getZ(a))*t]);}}if(hits.length>=2)contourPoints.push(...hits[0],...hits[1]);}}
 const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(contourPoints,3));const contours=new THREE.LineSegments(cg,new THREE.LineBasicMaterial({color:'#677953',transparent:true,opacity:.19}));scene.add(contours);
 const hydro=new THREE.Group(),roads=new THREE.Group(),buildings=new THREE.Group();const surfaceGrid={minX:-width/2,minZ:-depth/2,dx:width/(n-1),dz:depth/(n-1),cols:n,rows:n};const roadBuilder=createRoadBuilder(b,elevation,1,null,{grid:surfaceGrid});const waterBuilder=createRegionalWater(b,elevation,{terrainGeometry:geom,grid:surfaceGrid});const buildingMeta=[],buildingGeometries=[],geoLabels=[],facadeLines=[],windowVertices=[],landCover=new THREE.Group();scene.add(landCover);scene.add(hydro,roads,buildings);
 const lightningExclusions=[];
 function addBuilding(way){
  const coords=way.geometry.filter(q=>q.lon>=b.west&&q.lon<=b.east&&q.lat>=b.south&&q.lat<=b.north);if(coords.length<4)return;
  lightningExclusions.push({west:Math.min(...coords.map(c=>c.lon))-.0003,east:Math.max(...coords.map(c=>c.lon))+.0003,south:Math.min(...coords.map(c=>c.lat))-.0003,north:Math.max(...coords.map(c=>c.lat))+.0003});
  const lon=coords.reduce((a,q)=>a+q.lon,0)/coords.length,lat=coords.reduce((a,q)=>a+q.lat,0)/coords.length,q=project(lon,lat,b);
  const outline=coords.slice(0,-1).map(c=>project(c.lon,c.lat,b));const contour=outline.map(c=>new THREE.Vector2(c.x-q.x,-c.z+q.z));if(contour.length<3)return;
  const heightEvidence=buildingHeight(way.tags),realHeight=heightEvidence.meters;
  const height=heightEvidence.displayMeters/1000*1.8;
  const grounds=coords.map(c=>elevation(c.lon,c.lat));grounds.push(elevation(lon,lat));
  const base=Math.min(...grounds)-.002, ground=Math.max(...grounds)+.001, top=ground+height;
  const g=new THREE.ExtrudeGeometry(new THREE.Shape(contour),{depth:top-base,bevelEnabled:false,steps:1});g.rotateX(-Math.PI/2);
  const colorArray=[];for(let i=0;i<g.attributes.position.count;i++){const color=new THREE.Color(g.attributes.normal.getY(i)>.9?'#a5b2b5':'#f6f1e6');colorArray.push(color.r,color.g,color.b);}
  g.setAttribute('color',new THREE.Float32BufferAttribute(colorArray,3));g.translate(q.x,base,q.z);g.clearGroups();buildingGeometries.push(g);
  // Roof coping and regular facade windows are generic sandtable styling.
  for(let k=0;k<outline.length;k++){
   const a=outline[k],d=outline[(k+1)%outline.length],dx=d.x-a.x,dz=d.z-a.z,len=Math.hypot(dx,dz);if(len<.003)continue;
   facadeLines.push(a.x,top+.0006,a.z,d.x,top+.0006,d.z);
   let nx=dz/len,nz=-dx/len;if(nx*((a.x+d.x)/2-q.x)+nz*((a.z+d.z)/2-q.z)<0){nx=-nx;nz=-nz;}
   const floors=Math.min(25,Math.max(1,Math.round(realHeight/3))),columns=Math.min(80,Math.max(1,Math.floor(len/.0045)));
   for(let floor=0;floor<floors;floor++)for(let col=0;col<columns;col++){
    const center=(col+.5)/columns,half=Math.min(.001,len/columns*.22),t0=center-half/len,t1=center+half/len;
    const y=ground+(floor+.3)*height/floors,h=height/floors*.38;
    const x0=a.x+dx*t0+nx*.0003,z0=a.z+dz*t0+nz*.0003,x1=a.x+dx*t1+nx*.0003,z1=a.z+dz*t1+nz*.0003;
    windowVertices.push(x0,y,z0,x1,y,z1,x0,y+h,z0,x1,y,z1,x1,y+h,z1,x0,y+h,z0);
   }
  }
  buildingMeta.push({id:way.id,lon,lat,type:way.tags.building,name:way.tags.name??'',sourceHeightMeters:realHeight,renderHeightMeters:height*1000,footprint:'OpenStreetMap',heightSource:heightEvidence.source==='height-tag'?'height tag':heightEvidence.source==='levels-assumed'?'levels × 3m assumed':'12m assumed'});
 }


 try{const osm=await fetch(import.meta.env.BASE_URL+'data/osm.json').then(r=>r.json());const namedWater=new Map();for(const way of osm.elements??[]){if(way.tags?.name&&way.tags?.waterway==='river'){const prev=namedWater.get(way.tags.name);if(!prev||prev.geometry.length<way.geometry.length)namedWater.set(way.tags.name,way);}}for(const [name,way] of namedWater){const mid=way.geometry[Math.floor(way.geometry.length/2)];if(mid.lon<b.west||mid.lon>b.east||mid.lat<b.south||mid.lat>b.north)continue;const q=project(mid.lon,mid.lat,b),el=document.createElement('div');el.className='map-label water-label';el.innerHTML=`<b></b>`;el.firstElementChild.textContent=name;container.append(el);geoLabels.push({el,name,pos:new THREE.Vector3(q.x,elevation(mid.lon,mid.lat)+.05,q.z)});}for(const way of osm.elements??[]){if(!way.geometry)continue;const tags=way.tags??{};if(tags.natural==='wood'||tags.landuse==='residential'||tags.landuse==='industrial'||tags.landuse==='farmland'){const coords=way.geometry.filter(q=>q.lon>=b.west&&q.lon<=b.east&&q.lat>=b.south&&q.lat<=b.north);if(coords.length>3){
 // Tint the terrain vertices inside the OSM polygon. A sparse polygon mesh would bridge valleys.
 const minLon=Math.min(...coords.map(q=>q.lon)),maxLon=Math.max(...coords.map(q=>q.lon)),minLat=Math.min(...coords.map(q=>q.lat)),maxLat=Math.max(...coords.map(q=>q.lat));
 const col0=Math.max(0,Math.floor((minLon-b.west)/(b.east-b.west)*(n-1))),col1=Math.min(n-1,Math.ceil((maxLon-b.west)/(b.east-b.west)*(n-1))),row0=Math.max(0,Math.floor((b.north-maxLat)/(b.north-b.south)*(n-1))),row1=Math.min(n-1,Math.ceil((b.north-minLat)/(b.north-b.south)*(n-1)));
 const tint=new THREE.Color(tags.natural==='wood'?'#53724b':tags.landuse==='residential'?'#c3bfa9':tags.landuse==='industrial'?'#aab3b2':'#ccbd8e');
 for(let row=row0;row<=row1;row++)for(let col=col0;col<=col1;col++){const lon=b.west+col/(n-1)*(b.east-b.west),lat=b.north-row/(n-1)*(b.north-b.south);let inside=false;for(let a=0,d=coords.length-1;a<coords.length;d=a++){const u=coords[a],v=coords[d];if((u.lat>lat)!==(v.lat>lat)&&lon<(v.lon-u.lon)*(lat-u.lat)/(v.lat-u.lat)+u.lon)inside=!inside;}if(inside){const i=row*n+col;new THREE.Color().fromArray(colors,i*3).lerp(tint,.23).toArray(colors,i*3);}}
 geom.attributes.color.copyArray(colors);geom.attributes.color.needsUpdate=true;
 }}else if(tags.building){addBuilding(way);}else if(tags.natural==='water'||tags.waterway)waterBuilder.add(way);else if(tags.highway)roadBuilder.add(way);}}catch{console.warn('公开水系道路数据不可用；保留真实高程场景');}
 if(buildingGeometries.length){const merged=mergeGeometries(buildingGeometries,false);const mesh=new THREE.Mesh(merged,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85}));mesh.castShadow=true;mesh.receiveShadow=true;buildings.add(mesh);for(const g of buildingGeometries)g.dispose();}
 if(facadeLines.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(facadeLines,3));buildings.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:'#b1b8ab',transparent:true,opacity:.5})));}
 roads.add(roadBuilder.mesh(),roadBuilder.structures);hydro.add(waterBuilder.mesh());
 const windowGroup=new THREE.Group();buildings.add(windowGroup);if(windowVertices.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(windowVertices,3));g.computeVertexNormals();windowGroup.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:'#688997',roughness:.55,side:THREE.DoubleSide})));}
 const residential=buildingMeta.filter(m=>['residential','apartments','house','dormitory'].includes(m.type));
 const residenceLabel=document.createElement('div');residenceLabel.className='map-label water-label';residenceLabel.innerHTML='<b>住宅楼群 · OSM轮廓</b>';container.append(residenceLabel);
 geoLabels.push({el:residenceLabel,name:'住宅楼群',nearOnly:true,pos:(()=>{const q=project(103.63664,30.99815,b);return new THREE.Vector3(q.x,elevation(103.63664,30.99815)+.04,q.z)})()});

 // Seeded decorative tree clusters give the sandtable scale. Positions are illustrative.
 const infrastructureMask=corridorMask([...roadBuilder.records,...waterBuilder.records]);
 const forest=new THREE.Group();scene.add(forest);const crownLower=new THREE.ConeGeometry(1,.8,7),crownUpper=new THREE.ConeGeometry(.68,.65,7);crownLower.translate(0,-.1,0);crownUpper.translate(0,.26,0);const canopy=mergeGeometries([crownLower,crownUpper]);crownLower.dispose();crownUpper.dispose();const treeCount=3600,trees=new THREE.InstancedMesh(canopy,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1}),treeCount),trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,5),new THREE.MeshStandardMaterial({color:'#857251',roughness:1}),treeCount);const dummy=new THREE.Object3D();let seed=43127;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};let count=0;
 for(let tries=0;count<treeCount&&tries<22000;tries++){const lon=b.west+random()*(b.east-b.west),lat=b.south+random()*(b.north-b.south),h=interpolateHeight(lon,lat,terrain);if(h<950||h>2400)continue;const q=project(lon,lat,b);if(infrastructureMask(q.x,q.z)||waterBuilder.containsPolygon(q.x,q.z))continue;const cluster=Math.sin(q.x*1.7)+Math.cos(q.z*1.9);if(cluster<.3)continue;const ground=elevation(lon,lat),height=.024+random()*.030,radius=height*.27;dummy.position.set(q.x,ground+height*.55,q.z);dummy.scale.set(radius,height,radius);dummy.rotation.y=random()*Math.PI;dummy.updateMatrix();trees.setMatrixAt(count,dummy.matrix);trees.setColorAt(count,new THREE.Color().setHSL(.23+random()*.07,.22+random()*.15,.3+random()*.12));dummy.position.y=ground+height*.12;dummy.scale.set(radius*.15,height*.24,radius*.15);dummy.updateMatrix();trunks.setMatrixAt(count,dummy.matrix);count++;}trees.count=trunks.count=count;trees.castShadow=false;trees.receiveShadow=true;forest.add(trees,trunks);
 const crossings=roadWaterCrossings(roadBuilder.records,waterBuilder.records);
 const bridgeReview=crossings.filter(q=>q.type==='bridge'&&q.waterWidthMeters>=8&&q.displaySeparationMeters>0&&q.displaySeparationMeters<30).sort((a,d)=>{const ca=unproject(a.x,a.z,b),cd=unproject(d.x,d.z,b);return Math.hypot(ca.lon-103.63664,ca.lat-30.99815)-Math.hypot(cd.lon-103.63664,cd.lat-30.99815)})[0]??crossings.find(q=>q.type==='bridge');
 const reviewLabel=document.createElement('div');reviewLabel.className='bridge-review-label';reviewLabel.hidden=true;container.append(reviewLabel);let reviewingBridge=false;
 const relations=document.querySelector('#map-relations');if(relations){relations.textContent=`已收录 ${roadBuilder.metadata.length} 个路段；桥梁 ${roadBuilder.metadata.filter(q=>q.structure==='bridge').length}、隧道 ${roadBuilder.metadata.filter(q=>q.structure==='tunnel').length}。中心线交叉 ${crossings.length} 处，其中 ${crossings.filter(q=>q.type==='unverified').length} 处缺少过水结构分类，待核实。桥面坡线取端点假定，净空与通行安全未知。地图边界端点 ${roadBuilder.metadata.reduce((n,q)=>n+(q.startKind==='map-boundary')+(q.endKind==='map-boundary'),0)} 个（不是确认的断头路）；其他源端点连接情况未经核查。原始数据仅覆盖两个片区，不能视为完整路网。`;}
 window.__mapData={buildingCount:buildingMeta.length,buildingMeta,terrainSource:terrain.source,terrainGrid:n,decorativeTrees:count,residentialCount:residential.length,roadCount:roadBuilder.metadata.length,roadMeta:roadBuilder.metadata,waterMeta:waterBuilder.metadata,crossings,bridgeReview,waterMode:'terrain footprint',waterOffsetMeters:waterBuilder.offset*1000,roadOffsetMeters:roadBuilder.pavementOffset*1000};
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(170,170),new THREE.MeshStandardMaterial({color:'#e9efdf',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.42;scene.add(floor);
 const markers=new Map(),pickables=[],labels=new Map(),rings=new Map(),patches=new Map();const sharedGeo=new THREE.SphereGeometry(.13,16,12);
 for(const h of hazards){const q=project(h.lon,h.lat,b),height=elevation(h.lon,h.lat);const group=new THREE.Group();group.position.set(q.x,height+.003,q.z);const stick=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.55,8),new THREE.MeshStandardMaterial({color:'#fffef3'}));stick.position.y=.25;group.add(stick);const dot=new THREE.Mesh(sharedGeo,new THREE.MeshStandardMaterial({color:h.color,emissive:h.color,emissiveIntensity:.15}));dot.position.y=.6;dot.userData.hazard=h.id;group.add(dot);const hit=new THREE.Mesh(new THREE.SphereGeometry(.45,12,8),new THREE.MeshBasicMaterial({visible:false}));hit.position.y=.6;hit.userData.hazard=h.id;group.add(hit);pickables.push(hit,dot);const ring=new THREE.Mesh(new THREE.RingGeometry(.18,.26,40),new THREE.MeshBasicMaterial({color:h.color,side:THREE.DoubleSide,transparent:true,opacity:.5,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.01;group.add(ring);rings.set(h.id,ring);scene.add(group);const radius=h.id==='debris'?.32:h.id==='landslide'?.25:.42;const patchGeom=new THREE.CircleGeometry(radius,48);patchGeom.rotateX(-Math.PI/2);const pp=patchGeom.attributes.position;for(let i=0;i<pp.count;i++){const c=unproject(pp.getX(i)+q.x,pp.getZ(i)+q.z,b);pp.setY(i,elevation(c.lon,c.lat)+.045);}patchGeom.computeVertexNormals();const patch=new THREE.Mesh(patchGeom,new THREE.MeshBasicMaterial({color:h.color,transparent:true,opacity:.20,side:THREE.DoubleSide,depthWrite:false}));patch.position.set(q.x,0,q.z);scene.add(patch);patches.set(h.id,patch);markers.set(h.id,{group,dot});const label=document.createElement('div');label.className='map-label';label.innerHTML=`<b>${h.id==='debris'?'黄央沟 · 历史案例':h.name}</b><small></small>`;container.append(label);labels.set(h.id,label);}
 const bridgeVertices=[];for(const road of roadBuilder.records.filter(q=>q.structure==='bridge')){const vertices=road.geometry();for(const value of vertices)bridgeVertices.push(value);}const inspectionGeometry=new THREE.BufferGeometry();inspectionGeometry.setAttribute('position',new THREE.Float32BufferAttribute(bridgeVertices,3));const bridgeInspection=new THREE.Mesh(inspectionGeometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide,visible:false}));
 const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();let pointerStart;
 const navigation=createMapNavigation(controls,camera,renderer.domElement,{minDistance:.012,maxDistance:68,onChange:value=>{window.__mapNavigation=value;},bounds:{minX:-width/2,maxX:width/2,minZ:-depth/2,maxZ:depth/2},ground:(x,z)=>{const q=unproject(x,z,b);return elevation(q.lon,q.lat);},pickPoint:e=>{const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(mouse,camera);return raycaster.intersectObjects([buildings,bridgeInspection,terrainMesh],true)[0]?.point;}});

 renderer.domElement.addEventListener('pointerdown',e=>pointerStart={x:e.clientX,y:e.clientY});renderer.domElement.addEventListener('pointerup',e=>{if(e.button!==0||e.shiftKey||e.ctrlKey||e.metaKey||renderer.domElement.dataset.dragMode==='pan'||!pointerStart||Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>6)return;const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(mouse,camera);const hit=raycaster.intersectObjects(pickables.filter(o=>o.parent?.visible!==false))[0];if(hit)onSelect(hit.object.userData.hazard);});renderer.domElement.addEventListener('pointercancel',()=>pointerStart=null);
 let disposed=false;let compact=false;let frames=0;const started=performance.now();window.__sceneMetrics={frames:0,buildingsVisible:buildings.visible&&buildings.children.length>0,roadsVisible:roads.visible,elapsedMs:0,drawCalls:0,triangles:0,labelCount:0,pixelRatio:renderer.getPixelRatio()};const resize=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;const nextCompact=w/h<1;if(nextCompact!==compact){camera.position.sub(controls.target).multiplyScalar(nextCompact?1.45:1/1.45).add(controls.target);compact=nextCompact;}renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()});resize.observe(container);
 const lightningLayer=createLightningLayer(scene,b,elevation,getState);
 const hazardLayer=createHazardEffectsLayer(scene,b,elevation,getState,container,roadBuilder,(x,z)=>!infrastructureMask(x,z)&&!waterBuilder.containsPolygon(x,z));
 let processFocused=null;
 controls.addEventListener('start',()=>{const s=getState();if(['landslide','debris'].includes(s.selected)&&s.effectSettings?.[s.selected]){s.effectSettings[s.selected].follow=false;const el=document.querySelector('#process-follow');if(el)el.checked=false;}});
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const temp=new THREE.Vector3();
 function render(){
  if(disposed)return;requestAnimationFrame(render);if(document.hidden||container.classList.contains('hydraulic-active'))return;
  navigation.update();window.__mapNavigation=navigation.snapshot();const state=getState(),distance=camera.position.distanceTo(controls.target),entries=[],w=container.clientWidth,h=container.clientHeight;
  windowGroup.visible=distance<2.5&&state.mode!=='2d';
  const shadowRadius=THREE.MathUtils.clamp(distance*.8,.4,18);sun.target.position.copy(controls.target);sun.position.copy(controls.target).add(new THREE.Vector3(-12,18,-10));
  Object.assign(sun.shadow.camera,{left:-shadowRadius,right:shadowRadius,top:shadowRadius,bottom:-shadowRadius});sun.shadow.camera.updateProjectionMatrix();
  function collect(el,pos,priority,eligible){
   temp.copy(pos).project(camera);const visible=eligible&&temp.z<1&&temp.z>-1&&Math.abs(temp.x)<.97&&Math.abs(temp.y)<.97;
   el.style.display=visible?'block':'none';if(!visible)return;
   entries.push({el,x:(temp.x*.5+.5)*w,y:(-temp.y*.5+.5)*h,width:el.offsetWidth,height:el.offsetHeight,priority});
  }
  for(const item of hazards){
   const n=state.states[item.id],m=markers.get(item.id),ring=rings.get(item.id),selected=item.id===state.selected,color=n.unknown?'#8f9692':levels[n.level].color;
   const windClose=['ice','wind','heat','forest','landslide','debris'].includes(state.selected)&&distance<.3;m.group.visible=!windClose;ring.visible=!windClose;
   m.dot.material.color.set(color);m.dot.material.emissive.set(color);ring.material.color.set(color);
   const patch=patches.get(item.id);patch.visible=item.id!=='water'&&state.selected!=='water'&&!(selected&&['ice','wind','heat','forest','landslide','debris'].includes(item.id));patch.material.color.set(color);patch.material.opacity=n.unknown?.08:n.level===2?.3:n.level===1?.2:.09;
   ring.scale.setScalar(selected?1.6:1+n.level*.65);ring.material.opacity=n.level&&!reduced?.4+Math.sin(performance.now()*.002)*.12:.4;
   m.group.scale.setScalar(Math.max(.025,Math.min(1,distance/30)));m.dot.scale.setScalar(selected?1.35:1);m.group.updateMatrixWorld(true);
   const label=labels.get(item.id);label.classList.toggle('selected',selected);label.lastElementChild.textContent=selected?(n.unknown?'数据未知':`${item.id==='lightning'?['无信号','模拟黄','模拟橙','模拟红'][Math.round(n.value)]:Number(n.value.toFixed(1))+item.unit} · ${n.level?'需核查':'模拟输入'}`):'';
   const pos=m.dot.getWorldPosition(new THREE.Vector3());pos.y+=.02;
   collect(label,pos,selected?10:6,(!compact||selected)&&!(['wind','heat','forest','landslide','debris'].includes(state.selected)&&distance<2&&!selected)&&!(distance<3&&selected&&item.id!=='water'));
  }
  for(const item of geoLabels)collect(item.el,item.pos,item.nearOnly?7:3,!(['ice','wind','heat','forest','landslide','debris'].includes(state.selected)&&distance<2)&&(!item.nearOnly||distance<1.5)&&(!compact||distance<8)&&(item.nearOnly||distance<12||['岷江','龙溪河','白沙河','内江'].includes(item.name)));
  const reserved=[{left:0,top:0,right:w,bottom:78},{left:w-62,top:78,right:w,bottom:252}];
  if(state.selected!=='water'&&distance<7)reserved.push({left:8,top:82,right:w-64,bottom:143});
  const placements=arrangeLabels(entries,w,h,reserved);
  for(const {el,box} of placements){el.style.display=box?'block':'none';if(box){el.style.left=`${box.left}px`;el.style.top=`${box.top}px`;}}
  if(reviewingBridge&&bridgeReview){const c=unproject(bridgeReview.x,bridgeReview.z,b);temp.set(bridgeReview.x,elevation(c.lon,c.lat)+.003,bridgeReview.z).project(camera);reviewLabel.hidden=Math.abs(temp.x)>1||Math.abs(temp.y)>1||temp.z>1;reviewLabel.textContent=`${bridgeReview.roadName||'桥梁'} · OSM ${bridgeReview.roadId} · 桥面坡线假定，净空待核实`;reviewLabel.style.left=`${(temp.x*.5+.5)*w}px`;reviewLabel.style.top=`${(-temp.y*.5+.5)*h}px`;}else reviewLabel.hidden=true;
  lightningLayer.update(camera,container);hazardLayer.update(camera);
  const processId=['heat','forest','landslide','debris'].includes(state.selected)?state.selected:null;
  if(!processId){processFocused=null;window.__processCamera={id:null,following:false};}else{
   if(processFocused!==processId&&focusProcess(processId,state.effectSettings?.[processId]?.view??'subject'))processFocused=processId;
   const c=state.effectSettings?.[processId],following=['landslide','debris'].includes(processId)&&c?.follow&&c.view==='subject'&&state.effectPlayback?.[processId]?.running;
   if(following){const frame=hazardLayer.processBounds(processId,'subject');if(frame){const delta=new THREE.Vector3(frame.center.x,frame.center.y,frame.center.z).sub(controls.target);camera.position.add(delta);controls.target.add(delta);controls.update();}}
   window.__processCamera={id:processId,following:!!following,target:controls.target.toArray(),camera:camera.position.toArray()};
  }
  renderer.render(scene,camera);frames++;
  window.__sceneMetrics={frames,buildingsVisible:buildings.visible&&buildings.children.length>0,roadsVisible:roads.visible,elapsedMs:performance.now()-started,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,labelCount:placements.filter(p=>p.box).length,pixelRatio:renderer.getPixelRatio()};
 }

 render();
 function appearance(mode){const command=mode==='2d';renderer.setClearColor(command?'#12252c':'#e9efdf');scene.fog.color.set(command?'#12252c':'#e9efdf');floor.material.color.set(command?'#12252c':'#e9efdf');geom.setAttribute('color',new THREE.Float32BufferAttribute(command?commandColors:colors,3));contours.material.color.set(command?'#789784':'#456847');contours.material.opacity=command?.42:.25;for(const mesh of buildings.children)if(mesh.material)mesh.material.color.set(command?'#658980':'#ffffff');landCover.visible=!command;forest.visible=!command;sun.castShadow=!command;terrainMaterial.flatShading=false;terrainMaterial.needsUpdate=true;container.closest('.map-panel').classList.toggle('command',command);}
 function clearView(center,radius,y,preferred=null){
  controls.target.set(center.x,y,center.z);
  const span=Math.max(.008,radius),clearance=Math.min(.025,Math.max(.0005,span*.08)),fit=span/Math.sin(camera.fov*Math.PI/360)*1.16/Math.min(1,camera.aspect);
  if(getState().mode==='2d'){camera.position.copy(controls.target).add(new THREE.Vector3(0,fit,.001));}
  else {
   let best=null;const horizontal=fit*.56;
   for(let i=0;i<16;i++){const angle=i*Math.PI/8;if(preferred!==null&&Math.abs(Math.cos(angle-preferred))<.92)continue;const dx=Math.cos(angle)*horizontal,dz=Math.sin(angle)*horizontal;let rise=fit*.83;
    for(let j=1;j<=16;j++){const t=j/16,location=unproject(center.x+dx*t,center.z+dz*t,b);rise=Math.max(rise,(elevation(location.lon,location.lat)+clearance-y)/t);}
    if(!best||rise<best.rise)best={dx,dz,rise};
   }
   camera.position.copy(controls.target).add(new THREE.Vector3(best.dx,best.rise,best.dz));
  }controls.update();
 }
 function focusWindDetail(kind='flag',angle='front'){
  const all=hazardLayer.windBounds,view=kind==='field'?all:all[kind]??all,direction=getState().states.wind.extra.direction*Math.PI/180;
  clearView(view.center,view.radius,view.center.y,kind==='flag'?Math.atan2(-Math.sin(direction),-Math.cos(direction))+(angle==='side'?Math.PI/2:0):null);
 }
 function focusProcess(id,view='subject'){const frame=hazardLayer.processBounds(id,view);if(!frame)return false;clearView(frame.center,frame.radius,frame.center.y);return true;}
 function focusEffect(id){
  reviewingBridge=false;const item=hazards.find(h=>h.id===id);if(!item)return;const origin=project(item.lon,item.lat,b);let q={...origin},radius={ice:.17,wind:.22,heat:.22,forest:.24,landslide:.16,debris:.11}[id]??.2;
  const height=(x,z)=>{const c=unproject(x,z,b);return elevation(c.lon,c.lat);};let targetY=height(q.x,q.z)+.025;
  if(['heat','forest','landslide','debris'].includes(id)&&focusProcess(id,getState().effectSettings?.[id]?.view??'subject'))return;
  if(id==='wind'){focusWindDetail(getState().effectSettings?.wind?.view??'flag');return;}
  if(id==='ice'){const attachment=roadBuilder.nearestRoad(q.x,q.z);if(attachment){q={x:attachment.x,z:attachment.z};radius=.23;targetY=attachment.road.height(q.x,q.z)+.01;}}
  if(['landslide','debris'].includes(id)){
   const path=downhillPath(q,height,id==='debris'?50:18,.012),points=[...path];
   if(id==='landslide')for(const center of path.slice(0,4))for(let i=0;i<9;i++){const x=center.x+Math.cos(i*Math.PI*2/9)*.06,z=center.z+Math.sin(i*Math.PI*2/9)*.05;points.push({x,z,y:height(x,z)+.02});}
   if(points.length){const xs=points.map(p=>p.x),ys=points.map(p=>p.y),zs=points.map(p=>p.z),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),z0=Math.min(...zs),z1=Math.max(...zs);
    q={x:(x0+x1)/2,z:(z0+z1)/2};targetY=(y0+y1)/2+.025;radius=Math.max(.085,Math.hypot(x1-x0,y1-y0,z1-z0)/2+.035);
   }
  }
  clearView(q,radius,targetY);
 }

 return {terrain,lightningExclusions,focusIceDetail(){const h=hazards.find(h=>h.id==='ice'),q=project(h.lon,h.lat,b),a=roadBuilder.nearestRoad(q.x,q.z);if(a)clearView({x:a.x,z:a.z},.025,a.road.height(a.x,a.z)+.002);},focusEffect,focusProcess,focusWindDetail,focusLightning(region,radius=1.2,framing='event'){
  const r=lightningRegions[region];if(!r)return;const display=getState().lightningDisplay,event=display?.event,location=event?.location;
  if(location&&framing!=='area'){const q=project(location.lon,location.lat,b),ground=elevation(location.lon,location.lat),shape=channelShape(event,getState().lightningSession?.config.style??'标准'),points=[...shape.points,...shape.branches.flat()],xs=points.map(p=>p.x),ys=points.map(p=>p.y),zs=points.map(p=>p.z);
   const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),minZ=Math.min(...zs),maxZ=Math.max(...zs);
   clearView({x:q.x+(minX+maxX)/2,z:q.z+(minZ+maxZ)/2},Math.max(.46,Math.hypot(maxX-minX,maxY-minY,maxZ-minZ)/2+.09),ground+(minY+maxY)/2,event.type==='云间'?Math.PI/2:null);camera.updateMatrixWorld(true);
   const projected=points.map(p=>new THREE.Vector3(q.x+p.x,ground+p.y,q.z+p.z).project(camera));window.__lightningFraming={type:event.type,inFrame:projected.every(p=>Math.abs(p.x)<.98&&Math.abs(p.y)<.98&&p.z<1),spanX:Math.max(...projected.map(p=>p.x))-Math.min(...projected.map(p=>p.x)),spanY:Math.max(...projected.map(p=>p.y))-Math.min(...projected.map(p=>p.y))};
  }else{const q=project(r.lon,r.lat,b);clearView(q,Math.max(.8,radius+.55),elevation(r.lon,r.lat)+.55);}
 },backend:'WebGL / Three.js r185',setDragMode:navigation.setDragMode,setMode(mode){navigation.setMode(mode);appearance(mode);if(mode==='2d'){camera.position.set(0,compact?62:48,.001);controls.target.set(0,0,0);controls.enableRotate=false}else{camera.position.set(23,24,27);controls.target.set(0,1.1,0);if(compact)camera.position.sub(controls.target).multiplyScalar(1.45).add(controls.target);controls.enableRotate=true}controls.update()},reset(){reviewingBridge=false;this.setMode(getState().mode)},zoom:navigation.zoom,focus(id){const q=markers.get(id).group.position.clone();navigation.focus(q,.3)},region(name){reviewingBridge=name==='bridge';if(reviewingBridge&&bridgeReview){const q=bridgeReview,c=unproject(q.x,q.z,b),y=elevation(c.lon,c.lat)+Math.max(0,q.displaySeparationMeters)/1000;clearView(q,.075,y+.005);return;}const regions={mountain:[103.5608611,31.07125,2.5],city:[103.63664,30.99815,.23],overview:null};const r=regions[name];if(!r){this.reset();return;}const q=project(r[0],r[1],b),y=elevation(r[0],r[1]);controls.target.set(q.x,y,q.z);camera.position.copy(controls.target).add(getState().mode==='2d'?new THREE.Vector3(0,r[2]*2,.001):new THREE.Vector3(r[2],r[2]*1.4,r[2]*1.6));controls.update();},layer(name){contours.visible=name!=='plain';roads.visible=name!=='plain';buildings.visible=name!=='plain';landCover.visible=name!=='plain'&&getState().mode!=='2d';forest.visible=name!=='plain'&&getState().mode!=='2d';if(name==='risk'){terrainMesh.material.color.set('#dbe5cf')}else terrainMesh.material.color.set('#ffffff')},dispose(){disposed=true;inspectionGeometry.dispose();bridgeInspection.material.dispose();reviewLabel.remove();hazardLayer.dispose();lightningLayer.dispose();resize.disconnect();navigation.dispose();controls.dispose();const disposedGeometries=new Set(),disposedMaterials=new Set();scene.traverse(o=>{if(o.geometry&&!disposedGeometries.has(o.geometry)){o.geometry.dispose();disposedGeometries.add(o.geometry)}const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)if(m&&!disposedMaterials.has(m)){m.userData?.maskTexture?.dispose();m.dispose();disposedMaterials.add(m)}});renderer.dispose();}};
}
