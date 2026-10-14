export function segmentIntersection(a,b,c,d){
  const rx=b.x-a.x,rz=b.z-a.z,sx=d.x-c.x,sz=d.z-c.z,den=rx*sz-rz*sx;
  if(Math.abs(den)<1e-14)return null;
  const t=((c.x-a.x)*sz-(c.z-a.z)*sx)/den,u=((c.x-a.x)*rz-(c.z-a.z)*rx)/den;
  if(t<-1e-9||t>1+1e-9||u<-1e-9||u>1+1e-9)return null;return {x:a.x+t*rx,z:a.z+t*rz};
}
export function roadWaterCrossings(roads,waters){
  const buckets=new Map(),size=.1,key=(x,z)=>`${x}:${z}`;
  const cells=(a,b,fn)=>{for(let x=Math.floor(Math.min(a.x,b.x)/size);x<=Math.floor(Math.max(a.x,b.x)/size);x++)for(let z=Math.floor(Math.min(a.z,b.z)/size);z<=Math.floor(Math.max(a.z,b.z)/size);z++)fn(key(x,z));};
  for(const water of waters)for(let i=1;i<water.points.length;i++){const item={water,a:water.points[i-1],b:water.points[i]};cells(item.a,item.b,k=>{if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(item);});}
  const result=[],seen=new Set();
  for(const road of roads)for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i],candidates=new Set();cells(a,b,k=>buckets.get(k)?.forEach(q=>candidates.add(q)));
    for(const q of candidates){const p=segmentIntersection(a,b,q.a,q.b);if(!p)continue;const id=`${road.id}:${q.water.id}:${Math.round(p.x*100000)}:${Math.round(p.z*100000)}`;if(seen.has(id))continue;seen.add(id);
      const deck=road.height(p.x,p.z),water=q.water.height(p.x,p.z);result.push({...p,roadId:road.id,roadName:road.name,waterId:q.water.id,waterWidthMeters:q.water.width*1000,type:road.structure==='bridge'?'bridge':road.structure==='tunnel'?'tunnel':road.ford&&road.ford!=='no'?'ford':'unverified',displaySeparationMeters:(deck-water)*1000,clearanceVerified:false});
    }
  }
  return result;
}

// Decorative vegetation must not occupy road or mapped-water footprints.
export function corridorMask(records,margin=.025){
  const buckets=new Map(),size=.1;
  for(const record of records)for(let i=1;i<record.points.length;i++){
    const a=record.points[i-1],b=record.points[i],radius=record.width/2+margin;
    for(let x=Math.floor((Math.min(a.x,b.x)-radius)/size);x<=Math.floor((Math.max(a.x,b.x)+radius)/size);x++)for(let z=Math.floor((Math.min(a.z,b.z)-radius)/size);z<=Math.floor((Math.max(a.z,b.z)+radius)/size);z++){const k=`${x}:${z}`;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push({a,b,radius});}
  }
  return (x,z)=>{for(const {a,b,radius} of buckets.get(`${Math.floor(x/size)}:${Math.floor(z/size)}`)??[]){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(x-a.x-t*dx,z-a.z-t*dz)<radius)return true;}return false;};
}
