import * as THREE from 'three';
import {project, unproject} from './model.js';

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

export function roadProfile(tags) {
  const kind=tags.highway;
  const walking=['footway','path','pedestrian','steps','cycleway'].includes(kind);
  const major=['motorway','trunk','primary','secondary'].includes(kind);
  const widths={motorway:26,trunk:22,primary:18,secondary:14,tertiary:10,residential:7,living_street:5,unclassified:6,service:4,track:3};
  const supplied=Number.parseFloat(tags.width), lanes=Number.parseFloat(tags.lanes);
  const width=Number.isFinite(supplied)&&supplied>0 ? supplied : Number.isFinite(lanes)&&lanes>0 ? lanes*3.3+1 : widths[kind]??(walking?2:6);
  return {width:THREE.MathUtils.clamp(width,1,40)/1000, walking, major,
    color:walking?'#aa9a7c':kind==='track'?'#96866a':'#42484b',
    widthSource:Number.isFinite(supplied)&&supplied>0?'OSM width':Number.isFinite(lanes)&&lanes>0?'lanes estimate':'class estimate'};
}

// All ribbons are batched into a single colored mesh; no elevated road tubes.
export function createRoadBuilder(bounds, elevation) {
  const positions=[], colors=[], metadata=[];
  function quad(vertices, color) {
    const c=new THREE.Color(color);
    for(const index of [0,1,2,1,3,2]) {positions.push(...vertices[index]);colors.push(c.r,c.g,c.b);}
  }
  function strip(points, width, offset, color) {
    const pairs=points.map((q,i)=>{
      const prev=points[Math.max(0,i-1)], next=points[Math.min(points.length-1,i+1)];
      const dx=next.x-prev.x,dz=next.z-prev.z,len=Math.hypot(dx,dz)||1;
      return [-1,1].map(side=>{
        const x=q.x-dz/len*width/2*side,z=q.z+dx/len*width/2*side;
        const geo=unproject(x,z,bounds);
        return [x,elevation(geo.lon,geo.lat)+offset,z];
      });
    });
    for(let i=1;i<pairs.length;i++)quad([...pairs[i-1],...pairs[i]],color);
  }
  function add(way) {
    const coords=way.geometry.filter(q=>q.lon>=bounds.west&&q.lon<=bounds.east&&q.lat>=bounds.south&&q.lat<=bounds.north);
    if(coords.length<2)return;
    const profile=roadProfile(way.tags), points=[];
    for(let i=1;i<coords.length;i++){
      const a=project(coords[i-1].lon,coords[i-1].lat,bounds),b=project(coords[i].lon,coords[i].lat,bounds);
      const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.012));
      for(let j=0;j<count;j++){const t=j/count;points.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}
    }
    points.push(project(coords.at(-1).lon,coords.at(-1).lat,bounds));
    if(!profile.walking)strip(points,profile.width+.0024,.0014,'#b9b5a5');
    strip(points,profile.width,.0018,profile.color);
    if(profile.major){
      // Illustrative road markings; not surveyed lane geometry.
      for(let i=1;i<points.length;i+=2){const a=points[i-1],b=points[i];strip([a,{x:a.x+(b.x-a.x)*.45,z:a.z+(b.z-a.z)*.45}],.00035,.0022,'#ebd08a');}
    }
    metadata.push({id:way.id,kind:way.tags.highway,widthMeters:profile.width*1000,widthSource:profile.widthSource});
  }
  function mesh() {
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
    const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));m.receiveShadow=true;return m;
  }
  return {add,mesh,metadata};
}
