import * as THREE from 'three';
import {project, unproject} from './model.js';
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
    color:walking?'#aa9a7c':kind==='track'?'#a29d87':mountain?'#85887d':'#42484b',
    widthSource:Number.isFinite(supplied)&&supplied>0?'OSM width':Number.isFinite(lanes)&&lanes>0?'lanes estimate':'class estimate'};
}

// All ribbons are batched into a single colored mesh; no elevated road tubes.
export function createRoadBuilder(bounds, elevation, liftScale=1, mountainOverride=null) {
  const positions=[], colors=[], metadata=[];
  const mountainTint=new THREE.Color('#85887d');
  const ground=(x,z)=>{const geo=unproject(x,z,bounds);return elevation(geo.lon,geo.lat);};
  // Refine inside each ribbon, not just its edges. A coarse face can cut through
  // a terrain ridge even when its four corners sit above the terrain.
  function triangle(a,b,c,color,offset,depth=0) {
    const midpoint=(p,q)=>{const x=(p[0]+q[0])/2,z=(p[2]+q[2])/2;return [x,ground(x,z)+offset,z];};
    const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
    const x=(a[0]+b[0]+c[0])/3,z=(a[2]+b[2]+c[2])/3;
    const error=Math.max(Math.abs(ab[1]-(a[1]+b[1])/2),Math.abs(bc[1]-(b[1]+c[1])/2),Math.abs(ca[1]-(c[1]+a[1])/2),Math.abs(ground(x,z)+offset-(a[1]+b[1]+c[1])/3));
    if(error>.0005*liftScale&&depth<6){
      triangle(a,ab,ca,color,offset,depth+1);triangle(ab,b,bc,color,offset,depth+1);
      triangle(ca,bc,c,color,offset,depth+1);triangle(ab,bc,ca,color,offset,depth+1);return;
    }
    for(const p of [a,b,c]){
      positions.push(...p);
      const tint=color.clone();
      // Gradual valley-to-mountain tint also covers roads that cross both zones.
      if(color.getHexString()==='42484b')tint.lerp(mountainTint,THREE.MathUtils.smoothstep(p[1]-offset,.28,.60));
      colors.push(tint.r,tint.g,tint.b);
    }
  }
  function strip(points, width, offset, color) {
    const c=new THREE.Color(color);
    const pairs=points.map((q,i)=>{
      const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];
      const direction=(a,b)=>{const len=Math.hypot(b.x-a.x,b.z-a.z)||1;return {x:(b.x-a.x)/len,z:(b.z-a.z)/len};};
      const incoming=i?direction(prev,q):direction(q,next),outgoing=i<points.length-1?direction(q,next):incoming;
      let nx=-incoming.z-outgoing.z,nz=incoming.x+outgoing.x;
      const len=Math.hypot(nx,nz);if(len<.001){nx=-outgoing.z;nz=outgoing.x;}else{nx/=len;nz/=len;}
      // Bounded miter joins keep bends joined without long spikes at hairpins.
      const reach=width/2/Math.max(.625,Math.abs(nx*(-outgoing.z)+nz*outgoing.x));
      return [-1,1].map(side=>{const x=q.x+nx*reach*side,z=q.z+nz*reach*side;return [x,ground(x,z)+offset,z];});
    });
    for(let i=1;i<pairs.length;i++){
      const [a,b]=pairs[i-1],[c2,d]=pairs[i];
      triangle(a,b,c2,c,offset);triangle(b,d,c2,c,offset);
    }
  }
  function add(way) {
    const coords=way.geometry.filter(q=>q.lon>=bounds.west&&q.lon<=bounds.east&&q.lat>=bounds.south&&q.lat<=bounds.north);
    if(coords.length<2)return;
    // This is a display classification from the DEM, not a surveyed road surface.
    const heights=coords.map(q=>elevation(q.lon,q.lat)).sort((a,b)=>a-b);
    const mountain=mountainOverride??(heights[Math.floor(heights.length/2)]>.72);
    const profile=roadProfile(way.tags,mountain), points=[];
    for(let i=1;i<coords.length;i++){
      const a=project(coords[i-1].lon,coords[i-1].lat,bounds),b=project(coords[i].lon,coords[i].lat,bounds);
      const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.006));
      for(let j=0;j<count;j++){const t=j/count;points.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}
    }
    points.push(project(coords.at(-1).lon,coords.at(-1).lat,bounds));
    if(!profile.walking)strip(points,profile.width+(mountain?.001:.0024),.0014*liftScale,mountain?'#a5a794':'#b9b5a5');
    strip(points,profile.width,.0018*liftScale,profile.color);
    if(profile.major&&!mountain){
      // Illustrative road markings; not surveyed lane geometry.
      for(let i=1;i<points.length;i+=2){const a=points[i-1],b=points[i];if(ground(a.x,a.z)>.28)continue;strip([a,{x:a.x+(b.x-a.x)*.45,z:a.z+(b.z-a.z)*.45}],.00035,.0022*liftScale,'#ebd08a');}
    }
    metadata.push({id:way.id,kind:way.tags.highway,widthMeters:profile.width*1000,widthSource:profile.widthSource,mountain,color:profile.color});
  }
  function mesh() {
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));return m;
  }
  return {add,mesh,metadata};
}
