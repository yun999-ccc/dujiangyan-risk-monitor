// Geographic clipping preserves every crossing, including segments with both ends outside.
export function clipSegment(a,b,bounds) {
  let lo=0,hi=1;const dx=b.lon-a.lon,dy=b.lat-a.lat;
  for(const [p,q] of [[-dx,a.lon-bounds.west],[dx,bounds.east-a.lon],[-dy,a.lat-bounds.south],[dy,bounds.north-a.lat]]) {
    if(Math.abs(p)<1e-15){if(q<0)return null;continue;}
    const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;
  }
  if(hi-lo<1e-12)return null;
  const at=t=>({lon:a.lon+t*dx,lat:a.lat+t*dy});return [at(lo),at(hi)];
}
const same=(a,b)=>Math.abs(a.lon-b.lon)<1e-10&&Math.abs(a.lat-b.lat)<1e-10;
export function clipPolyline(coords,bounds) {
  const parts=[];let part=null;
  for(let i=1;i<coords.length;i++){
    const segment=clipSegment(coords[i-1],coords[i],bounds);
    if(!segment){part=null;continue;}
    if(part&&same(part.at(-1),segment[0]))part.push(segment[1]);else {part=[...segment];parts.push(part);}
  }
  return parts;
}
export function clipPolygon(coords,bounds) {
  let result=coords.slice();if(result.length>1&&same(result[0],result.at(-1)))result.pop();
  for(const [axis,edge,sign] of [['lon',bounds.west,1],['lon',bounds.east,-1],['lat',bounds.south,1],['lat',bounds.north,-1]]){
    const input=result;result=[];if(!input.length)break;
    for(let i=0;i<input.length;i++){
      const a=input[(i+input.length-1)%input.length],b=input[i],ai=sign*(a[axis]-edge)>=0,bi=sign*(b[axis]-edge)>=0;
      if(ai!==bi){const t=(edge-a[axis])/(b[axis]-a[axis]);result.push({lon:a.lon+(b.lon-a.lon)*t,lat:a.lat+(b.lat-a.lat)*t});}
      if(bi)result.push(b);
    }
  }
  return result;
}
export function nearestOnPath(points,x,z) {
  let best=null,total=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
    if(!len)continue;const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(len*len))),px=a.x+t*dx,pz=a.z+t*dz,distance=Math.hypot(x-px,z-pz);
    if(!best||distance<best.distance)best={x:px,z:pz,distance,along:total+t*len};total+=len;
  }
  return best;
}
export function densify(points,step=.006) {
  const out=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/step));for(let j=0;j<n;j++){const t=j/n;out.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}}if(points.length)out.push(points.at(-1));return out;
}
// Both roads and snow use these identical sampled faces. Heights are in scene kilometres.
export function surfaceTriangle(a,b,c,height,emit,{tolerance=.00001,maxEdge=.025,depth=0}={}) {
  const mid=(p,q)=>{const x=(p[0]+q[0])/2,z=(p[2]+q[2])/2;return [x,height(x,z),z];};
  const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a),x=(a[0]+b[0]+c[0])/3,z=(a[2]+b[2]+c[2])/3;
  const error=Math.max(Math.abs(ab[1]-(a[1]+b[1])/2),Math.abs(bc[1]-(b[1]+c[1])/2),Math.abs(ca[1]-(c[1]+a[1])/2),Math.abs(height(x,z)-(a[1]+b[1]+c[1])/3));
  const edge=Math.max(Math.hypot(a[0]-b[0],a[2]-b[2]),Math.hypot(b[0]-c[0],b[2]-c[2]),Math.hypot(c[0]-a[0],c[2]-a[2]));
  if(depth<6&&(error>tolerance||edge>maxEdge)){
    const options={tolerance,maxEdge,depth:depth+1};
    surfaceTriangle(a,ab,ca,height,emit,options);surfaceTriangle(ab,b,bc,height,emit,options);surfaceTriangle(ca,bc,c,height,emit,options);surfaceTriangle(ab,bc,ca,height,emit,options);return;
  }
  emit(a,b,c);
}
// Split each footprint triangle along the actual DEM cell edges and diagonals.
// The output is exactly coplanar with each terrain face; no recursive refinement needed.
export function gridSurfaceTriangle(vertices,height,emit,grid){
  const {minX,minZ,dx,dz,cols,rows}=grid;
  const clip=(poly,distance)=>{
    const result=[];for(let i=0;i<poly.length;i++){const a=poly[(i+poly.length-1)%poly.length],b=poly[i],da=distance(a),db=distance(b),ai=da>=-1e-12,bi=db>=-1e-12;if(ai!==bi){const t=da/(da-db);result.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}if(bi)result.push(b);}return result;
  };
  const polygon=vertices.map(p=>({x:p[0],z:p[2]}));
  const x0=Math.max(0,Math.floor((Math.min(...polygon.map(p=>p.x))-minX)/dx)),x1=Math.min(cols-2,Math.floor((Math.max(...polygon.map(p=>p.x))-minX)/dx));
  const z0=Math.max(0,Math.floor((Math.min(...polygon.map(p=>p.z))-minZ)/dz)),z1=Math.min(rows-2,Math.floor((Math.max(...polygon.map(p=>p.z))-minZ)/dz));
  for(let row=z0;row<=z1;row++)for(let col=x0;col<=x1;col++){
    const x=minX+col*dx,z=minZ+row*dz;
    let cell=polygon;for(const d of [p=>p.x-x,p=>x+dx-p.x,p=>p.z-z,p=>z+dz-p.z])cell=clip(cell,d);
    for(const sign of [-1,1]){
      const face=clip(cell,p=>sign*((p.x-x)/dx+(p.z-z)/dz-1));
      for(let i=1;i<face.length-1;i++){const a=face[0],b=face[i],c=face[i+1];if(Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))<1e-16)continue;emit(...[a,b,c].map(p=>[p.x,height(p.x,p.z),p.z]));}
    }
  }
}
export function corridor(points,width,height,emit,options={}) {
  const pairs=points.map((q,i)=>{
    const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];
    const dir=(a,b)=>{const len=Math.hypot(b.x-a.x,b.z-a.z)||1;return {x:(b.x-a.x)/len,z:(b.z-a.z)/len};};
    const incoming=i?dir(prev,q):dir(q,next),outgoing=i<points.length-1?dir(q,next):incoming;
    let nx=-incoming.z-outgoing.z,nz=incoming.x+outgoing.x,len=Math.hypot(nx,nz);
    if(len<.001){nx=-outgoing.z;nz=outgoing.x;}else{nx/=len;nz/=len;}
    const reach=width/2/Math.max(.625,Math.abs(nx*(-outgoing.z)+nz*outgoing.x));
    return [-1,1].map(sign=>{const x=q.x+nx*reach*sign,z=q.z+nz*reach*sign;return [x,height(x,z),z];});
  });
  for(let i=1;i<pairs.length;i++){const [a,b]=pairs[i-1],[c,d]=pairs[i];if(options.grid){gridSurfaceTriangle([a,b,c],height,emit,options.grid);gridSurfaceTriangle([b,d,c],height,emit,options.grid);}else{surfaceTriangle(a,b,c,height,emit,options);surfaceTriangle(b,d,c,height,emit,options);}}
}
