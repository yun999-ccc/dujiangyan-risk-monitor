import fs from 'node:fs';
import {surfaceHeight} from '../src/city-geometry.js';
const terrain=JSON.parse(fs.readFileSync('public/data/terrain.json')),osm=JSON.parse(fs.readFileSync('public/data/osm.json'));
const nx=96,ny=96,dx=16,lon0=103.562,lat0=31.07225,mx=111320*Math.cos(lat0*Math.PI/180),my=111320;
const xy=p=>({x:(p.lon-lon0)*mx,z:(lat0-p.lat)*my});const geo=(x,z)=>({lon:lon0+x/mx,lat:lat0-z/my});
const river=osm.elements.find(w=>w.id===219484805);if(!river)throw Error('龙溪河中心线缺失');
const line=river.geometry.map(p=>({...xy(p),height:surfaceHeight(p.lon,p.lat,terrain)}));
// Smooth DEM profile and remove local upstream-facing steps, not measured bathymetry.
for(let i=0;i<line.length;i++){const a=Math.max(0,i-2),b=Math.min(line.length-1,i+2);line[i].bank=line.slice(a,b+1).reduce((s,p)=>s+p.height,0)/(b-a+1);if(i)line[i].bank=Math.min(line[i].bank,line[i-1].bank-.01);}
function closest(x,z){let best={distance:Infinity};for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],vx=b.x-a.x,vz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*vx+(z-a.z)*vz)/(vx*vx+vz*vz||1))),px=a.x+vx*t,pz=a.z+vz*t,d=Math.hypot(x-px,z-pz);if(d<best.distance)best={distance:d,bank:a.bank+(b.bank-a.bank)*t,x:px,z:pz};}return best;}
const bounds={west:lon0-nx*dx/2/mx,east:lon0+nx*dx/2/mx,north:lat0+ny*dx/2/my,south:lat0-ny*dx/2/my};
const roads=osm.elements.filter(w=>w.tags.highway&&w.geometry.some(p=>p.lon>=bounds.west&&p.lon<=bounds.east&&p.lat>=bounds.south&&p.lat<=bounds.north)).map(w=>({id:w.id,tags:w.tags,points:w.geometry.map(xy)}));
const buildings=osm.elements.filter(w=>w.tags.building&&w.geometry.some(p=>p.lon>=bounds.west&&p.lon<=bounds.east&&p.lat>=bounds.south&&p.lat<=bounds.north)).map(w=>({id:w.id,points:w.geometry.map(xy)}));
function polygon(x,z,poly){let inside=false;for(let a=0,b=poly.length-1;a<poly.length;b=a++){const u=poly[a],v=poly[b];if((u.z>z)!==(v.z>z)&&x<(v.x-u.x)*(z-u.z)/(v.z-u.z)+u.x)inside=!inside;}return inside;}
const raw=[],distance=[],bank=[],blocked=[],roadCells=[];
for(let row=0;row<ny;row++)for(let col=0;col<nx;col++){const x=(col+.5-nx/2)*dx,z=(row+.5-ny/2)*dx,g=geo(x,z),c=closest(x,z);raw.push(+surfaceHeight(g.lon,g.lat,terrain).toFixed(3));distance.push(+c.distance.toFixed(3));bank.push(+c.bank.toFixed(3));blocked.push(buildings.some(w=>polygon(x,z,w.points))?1:0);}
for(const road of roads)for(let k=1;k<road.points.length;k++){const a=road.points[k-1],b=road.points[k],length=Math.hypot(b.x-a.x,b.z-a.z),n=Math.ceil(length/(dx/2));for(let j=0;j<=n;j++){const x=a.x+(b.x-a.x)*j/n,z=a.z+(b.z-a.z)*j/n,c=Math.floor(x/dx+nx/2),r=Math.floor(z/dx+ny/2);if(c>=0&&c<nx&&r>=0&&r<ny)roadCells.push(r*nx+c);}}
const unique=[...new Set(roadCells)];const candidates=unique.filter(i=>!blocked[i]&&distance[i]>24&&distance[i]<90);const probe=candidates.sort((a,b)=>Math.abs((Math.floor(a/nx)+.5-ny/2)*dx)-Math.abs((Math.floor(b/nx)+.5-ny/2)*dx))[0];if(probe===undefined)throw Error('没有可用的道路观察点');
const data={version:1,name:'龙溪河 · 黄央沟邻近片区',riverId:river.id,nx,ny,dx,origin:{lon:lon0,lat:lat0},bounds,raw,distance,bank,blocked,roads,buildings,roadCells:unique,probe,probeCoordinate:geo((probe%nx+.5-nx/2)*dx,(Math.floor(probe/nx)+.5-ny/2)*dx),source:'公开DEM与OSM中心线；96×96、16m插值计算网格，不代表新增测绘精度',assumptions:'沿公开河道平滑纵剖面，假定河槽宽48m、深3m；岸外96m范围构建平缓过渡，再接回原DEM。不是实测河床、河岸或堤防。'};
fs.writeFileSync('public/data/hydraulic.json',JSON.stringify(data));console.log({bounds,roads:roads.length,buildings:buildings.length,probe:data.probeCoordinate,probeDistance:distance[probe]});
