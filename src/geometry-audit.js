// Audit source geometry in metres. Display exaggeration never enters these values.
export function parseLengthMeters(value) {
 const match=String(value??'').match(/^\s*(\d+(?:\.\d+)?)\s*(m|meters?|metres?|ft|feet)?\s*$/i);
 if(!match)return NaN;
 const meters=Number(match[1])*(/^(ft|feet)$/i.test(match[2]??'')?.3048:1);
 return meters>0?meters:NaN;
}
export function buildingHeight(tags={}) {
 const height=parseLengthMeters(tags.height),levels=Number(tags['building:levels']);
 const source=Number.isFinite(height)&&height>0?'height-tag':Number.isFinite(levels)&&levels>0?'levels-assumed':'default-assumed';
 const meters=source==='height-tag'?height:source==='levels-assumed'?levels*3:12;
 return {meters,displayMeters:Math.min(90,Math.max(3,meters)),source};
}
export function terrainSpacing(terrain) {
 const b=terrain.bounds,lat=(b.north+b.south)/2;
 return {eastWest:(b.east-b.west)*111320*Math.cos(lat*Math.PI/180)/(terrain.size-1),northSouth:(b.north-b.south)*111320/(terrain.size-1)};
}
export function gridCoordinate(data,index) {
 if(!Number.isInteger(index)||index<0||index>=data.nx*data.ny)throw Error('网格索引越界');
 const x=(index%data.nx+.5-data.nx/2)*data.dx,z=(Math.floor(index/data.nx)+.5-data.ny/2)*data.dx;
 return {x,z,lon:data.origin.lon+x/(111320*Math.cos(data.origin.lat*Math.PI/180)),lat:data.origin.lat-z/111320};
}
export function geometryDifference(data,z,tolerance=.01) {
 if(z.length!==data.raw.length)throw Error('高程数组长度不一致');
 let changedCells=0,maxAbs=0,minDelta=Infinity,maxDelta=-Infinity,sumAbs=0,maxIndex=0;
 for(let i=0;i<z.length;i++){
  const delta=z[i]-data.raw[i];if(!Number.isFinite(delta))throw Error('高程包含无效数值');
  const a=Math.abs(delta);if(a>tolerance)changedCells++;if(a>maxAbs){maxAbs=a;maxIndex=i;}minDelta=Math.min(minDelta,delta);maxDelta=Math.max(maxDelta,delta);sumAbs+=a;
 }
 return {tolerance,changedCells,totalCells:z.length,changedArea:changedCells*data.dx**2,maxAbs,maxIndex,minDelta,maxDelta,meanAbs:sumAbs/z.length};
}
export function gridProfile(data,z,row) {
 row=Math.max(0,Math.min(data.ny-1,Math.round(row)));
 return Array.from({length:data.nx},(_,col)=>{const index=row*data.nx+col;return {index,...gridCoordinate(data,index),raw:data.raw[index],used:z[index],delta:z[index]-data.raw[index],distanceToCenterline:data.distance[index]};});
}
export function geometryReadiness(report) {
 const gaps=report.requirements.filter(r=>r.required&&r.status!=='verified');
 return {ready:gaps.length===0,gaps:gaps.map(r=>r.id)};
}
