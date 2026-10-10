import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {PNG} from 'pngjs';
const z=12,n=2**z,bounds={west:103.46,east:103.73,south:30.94,north:31.17};
const tx=lon=>(lon+180)/360*n,ty=lat=>(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n;
const cache=new Map();
for(let x=Math.floor(tx(bounds.west));x<=Math.floor(tx(bounds.east));x++)for(let y=Math.floor(ty(bounds.north));y<=Math.floor(ty(bounds.south));y++){
 const dir=process.env.TERRAIN_CACHE_DIR||'artifacts/source-data';fs.mkdirSync(dir,{recursive:true});const p=`${dir}/terrain-${z}-${x}-${y}.png`;const url=`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
 execFileSync('curl',['-fsSL','--max-time','40',url,'-o',p]);cache.set(`${x},${y}`,PNG.sync.read(fs.readFileSync(p)));
}
const size=513,heights=[];
for(let row=0;row<size;row++)for(let col=0;col<size;col++){
 const lon=bounds.west+(bounds.east-bounds.west)*col/(size-1),lat=bounds.north-(bounds.north-bounds.south)*row/(size-1);
 const x=tx(lon),y=ty(lat),tile=cache.get(`${Math.floor(x)},${Math.floor(y)}`),px=Math.min(255,Math.floor((x%1)*256)),py=Math.min(255,Math.floor((y%1)*256)),i=(py*tile.width+px)*4;
 heights.push(Math.round((tile.data[i]*256+tile.data[i+1]+tile.data[i+2]/256-32768)*10)/10);
}
fs.writeFileSync('public/data/terrain.json',JSON.stringify({bounds,size,heights,source:'Mapzen Terrain Tiles / AWS Open Data',url:'https://registry.opendata.aws/terrain-tiles/',format:'Terrarium EPSG:3857 raster sampled on lon/lat grid',tileZoom:z,downloaded:'2026-10-10',verticalExaggeration:1.8,accuracy:'区域展示用；重采样高程，非工程测量'}));
console.log(JSON.stringify({samples:heights.length,min:heights.reduce((a,v)=>Math.min(a,v),Infinity),max:heights.reduce((a,v)=>Math.max(a,v),-Infinity),tiles:cache.size}));
