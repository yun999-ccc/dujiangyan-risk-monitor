import * as THREE from 'three';
import {project, unproject} from './model.js';
import {clipPolyline,densify,nearestOnPath,corridor} from './spatial-geometry.js';
import {parseLengthMeters} from './geometry-audit.js';

// Sample the same diagonal as PlaneGeometry, so thin road ribbons stay on the mesh.
export function surfaceHeight(lon, lat, terrain) {
  const {bounds:b, size:n, heights:h} = terrain;
  const x = THREE.MathUtils.clamp((lon-b.west)/(b.east-b.west)*(n-1),0,n-1);
  const y = THREE.MathUtils.clamp((b.north-lat)/(b.north-b.south)*(n-1),0,n-1);
  const col=Math.min(n-2,Math.floor(x)), row=Math.min(n-2,Math.floor(y));
  const u=x-col, v=y-row, a=h[row*n+col], d=h[row*n+col+1];
  const c=h[(row+1)*n+col+1], bottom=h[(row+1)*n+col];
  return u+v<=1 ? a+(d-a)*u+(bottom-a)*v : c+(bottom-c)*(1-u)+(d-c)*(1-v);
}

export function roadProfile(tags, mountain=false) {
  const kind=tags.highway;
  const walking=['footway','path','pedestrian','steps','cycleway'].includes(kind);
  const major=['motorway','trunk','primary','secondary'].includes(kind);
  const widths={motorway:26,trunk:22,primary:18,secondary:14,tertiary:10,residential:7,living_street:5,unclassified:6,service:4,track:3};
  const supplied=parseLengthMeters(tags.width), lanes=Number(tags.lanes);
  const width=Number.isFinite(supplied)&&supplied>0 ? supplied : Number.isFinite(lanes)&&lanes>0 ? lanes*3.3+1 : widths[kind]??(walking?2:6);
  const estimated=!(Number.isFinite(supplied)&&supplied>0)&&!(Number.isFinite(lanes)&&lanes>0);
  const displayWidth=mountain&&estimated&&!major ? Math.min(width,8) : width;
  return {width:THREE.MathUtils.clamp(displayWidth,1,40)/1000, walking, major, mountain,
    color:walking?'#b6a383':kind==='track'?'#80694d':mountain?'#56615a':'#42484b',
    widthSource:Number.isFinite(supplied)&&supplied>0?'OSM width':Number.isFinite(lanes)&&lanes>0?'lanes estimate':'class estimate'};
}

// Preserve road identity alongside batching: effects attach to these exact asphalt faces.
export function createRoadBuilder(bounds,elevation,liftScale=1,mountainOverride=null,{mountainColor='#56615a',mountainCurbColor='#8b9487',grid=null}={}) {
  const positions=[[],[],[]],colors=[[],[],[]],metadata=[],records=[],structures=new THREE.Group(),railVertices=[],tunnelVertices=[];
  const ground=(x,z)=>{const geo=unproject(x,z,bounds);return elevation(geo.lon,geo.lat);};
  const pavementOffset=.00005*liftScale;
  function strip(points,width,height,color,style=null,splitGrid=grid){
    const c=new THREE.Color(color),category=style==='curb'?0:style==='marking'?2:1;
    corridor(points,width,height,(...vertices)=>{for(const p of vertices){positions[category].push(...p);colors[category].push(c.r,c.g,c.b);}}, {tolerance:Math.max(.0000002,pavementOffset*.2),grid:splitGrid});
  }
  function add(way){
    const parts=clipPolyline(way.geometry,bounds),tags=way.tags??{};
    const bridge=!!tags.bridge&&tags.bridge!=='no',tunnel=(!!tags.tunnel&&tags.tunnel!=='no')||tags.covered==='yes';
    for(const [partIndex,coords] of parts.entries()){
      const heights=coords.map(q=>elevation(q.lon,q.lat)).sort((a,b)=>a-b),mountain=mountainOverride??(heights[Math.floor(heights.length/2)]>.72);
      const profile=roadProfile(tags,mountain),points=densify(coords.map(q=>project(q.lon,q.lat,bounds)),.025);
      if(mountain&&!profile.walking&&tags.highway!=='track')profile.color=mountainColor;
      const nearest=(x,z)=>nearestOnPath(points,x,z),length=points.slice(1).reduce((s,q,i)=>s+Math.hypot(q.x-points[i].x,q.z-points[i].z),0);
      const start=points[0],end=points.at(-1),ha=ground(start.x,start.z),hb=ground(end.x,end.z);
      // Bridge decks use a disclosed endpoint grade, never a surveyed clearance.
      const deck=(x,z)=>bridge?ha+(hb-ha)*(nearest(x,z)?.along??0)/Math.max(length,1e-9):ground(x,z);
      const height=(x,z)=>deck(x,z)+pavementOffset;
      const endpointKind=q=>[Math.abs(q.lon-bounds.west),Math.abs(q.lon-bounds.east),Math.abs(q.lat-bounds.south),Math.abs(q.lat-bounds.north)].some(d=>d<1e-10)?'map-boundary':'source-way-end; connectivity unverified';
      const meta={startKind:endpointKind(coords[0]),endKind:endpointKind(coords.at(-1)),id:way.id,part:partIndex,kind:tags.highway,name:tags.name??tags.ref??'',widthMeters:profile.width*1000,widthSource:profile.widthSource,mountain,color:profile.color,structure:tunnel?'tunnel':bridge?'bridge':'surface',layer:tags.layer??null,ford:tags.ford??null,elevationSource:bridge?'endpoint grade assumed; clearance unverified':'DEM surface; road elevation unverified',start:coords[0],end:coords.at(-1),lengthMeters:length*1000};
      if(tunnel){
        for(let i=1;i<points.length;i++)for(const q of [points[i-1],points[i]])tunnelVertices.push(q.x,ground(q.x,q.z)+.0001*liftScale,q.z);
      }else{
        if(!profile.walking)strip(points,profile.width+(tags.highway==='track'?.0003:mountain?.001:.0024),(x,z)=>deck(x,z)+pavementOffset*.55,tags.highway==='track'?'#a18b69':mountain?mountainCurbColor:'#b9b5a5','curb',bridge?null:grid);
        strip(points,profile.width,height,profile.color,null,bridge?null:grid);
        if(profile.major&&!mountain)for(let i=1;i<points.length;i+=2){const a=points[i-1],b=points[i];strip([a,{x:a.x+(b.x-a.x)*.45,z:a.z+(b.z-a.z)*.45}],.00035,(x,z)=>height(x,z)+.000005*liftScale,'#ebd08a','marking',bridge?null:grid);}
        if(bridge){
          const q=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],len=Math.hypot(b.x-a.x,b.z-a.z)||1;return {...p,nx:-(b.z-a.z)/len,nz:(b.x-a.x)/len};});
          for(const sign of [-1,1]){const edge=q.map(p=>{const x=p.x+sign*p.nx*profile.width/2,z=p.z+sign*p.nz*profile.width/2;return [x,height(x,z)+.0008,z];});for(let i=1;i<edge.length;i++)for(const p of [edge[i-1],edge[i]])railVertices.push(...p);}

        }
      }
      metadata.push(meta);records.push({...meta,points,height,width:profile.width,geometry(){const data=[];corridor(points,profile.width,height,(...vertices)=>vertices.forEach(p=>data.push(...p)),{grid:bridge?null:grid,tolerance:Math.max(.0000002,pavementOffset*.2)});return new Float32Array(data);}});
    }
  }
  function mesh(){
    for(const [vertices,material] of [[railVertices,new THREE.LineBasicMaterial({color:'#c4c9bf'})],[tunnelVertices,new THREE.LineDashedMaterial({color:'#b09a78',dashSize:.008,gapSize:.005})]]){
      if(!vertices.length){material.dispose();continue;}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));const line=new THREE.LineSegments(geometry,material);if(material.isLineDashedMaterial)line.computeLineDistances();structures.add(line);vertices.length=0;
    }
    const count=positions.reduce((sum,p)=>sum+p.length,0),p=new Float32Array(count),c=new Float32Array(count),g=new THREE.BufferGeometry();let offset=0;
    for(let i=0;i<3;i++){p.set(positions[i],offset);c.set(colors[i],offset);g.addGroup(offset/3,positions[i].length/3,i);offset+=positions[i].length;positions[i].length=colors[i].length=0;}
    g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.BufferAttribute(c,3));g.computeVertexNormals();
    const materials=[-1,-2,-3].map(factor=>new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:factor,polygonOffsetUnits:factor}));return new THREE.Mesh(g,materials);
  }
  function nearestRoad(x,z){let best=null;for(const road of records){if(road.structure!=='surface'||['path','footway','steps','track','cycleway'].includes(road.kind))continue;const q=nearestOnPath(road.points,x,z);if(q&&(!best||q.distance<best.distance))best={road,...q};}return best;}
  return {add,mesh,metadata,records,structures,nearestRoad,pavementOffset};
}
