import * as THREE from 'three';
import {project,unproject} from './model.js';
import {parseLengthMeters} from './geometry-audit.js';
import {clipPolyline,clipPolygon,densify,corridor} from './spatial-geometry.js';

// A geographic footprint on the terrain, never a hydraulic free-surface result.
export function createRegionalWater(bounds,elevation,{terrainGeometry=null,grid=null}={}){
  const positions=[],metadata=[],records=[],polygons=[],offset=.000008;
  const height=(x,z)=>{const p=unproject(x,z,bounds);return elevation(p.lon,p.lat)+offset;};
  const emit=(...vertices)=>vertices.forEach(p=>positions.push(...p));
  const options={tolerance:.000002,maxEdge:.05,grid};
  function add(way){
    const tags=way.tags??{};
    if(tags.natural==='water'){
      const coords=clipPolygon(way.geometry,bounds);if(coords.length<3)return;
      polygons.push(coords);
      metadata.push({id:way.id,kind:'polygon',widthSource:'OSM water outline',surface:'terrain footprint; not computed water level'});
    }else if(tags.waterway){
      const supplied=parseLengthMeters(tags.width),defaults={river:24,stream:3,canal:8,ditch:2,drain:2};
      const meters=Number.isFinite(supplied)&&supplied>0?supplied:defaults[tags.waterway]??3;
      // Source values are retained; very broad rivers should use their mapped outlines.
      const width=Math.min(500,Math.max(.5,meters))/1000;
      for(const coords of clipPolyline(way.geometry,bounds)){const points=densify(coords.map(p=>project(p.lon,p.lat,bounds)),.025);corridor(points,width,height,emit,options);records.push({id:way.id,points,width,height});}
      metadata.push({id:way.id,name:tags.name??'',kind:tags.waterway,widthMeters:width*1000,widthSource:Number.isFinite(supplied)&&supplied>0?'OSM width':'class width assumed',surface:'terrain footprint; not computed water level'});
    }
  }
  function mesh(){
    const group=new THREE.Group(),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
    const material=()=>new THREE.MeshBasicMaterial({color:'#3895aa',side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:0,polygonOffsetUnits:-2});
    if(positions.length)group.add(new THREE.Mesh(geometry,material()));
    // Water polygons use the exact terrain triangles, with a geographic mask.
    // This avoids large polygon faces cutting across valleys or runaway subdivision.
    if(polygons.length&&terrainGeometry&&typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=4096;const ctx=canvas.getContext('2d');
      ctx.fillStyle='#000';ctx.fillRect(0,0,4096,4096);ctx.fillStyle='#fff';
      for(const polygon of polygons){ctx.beginPath();polygon.forEach((p,i)=>{const x=(p.lon-bounds.west)/(bounds.east-bounds.west)*4096,y=(bounds.north-p.lat)/(bounds.north-bounds.south)*4096;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.fill();}
      const mask=new THREE.CanvasTexture(canvas);mask.colorSpace=THREE.NoColorSpace;mask.generateMipmaps=false;mask.minFilter=THREE.LinearFilter;mask.magFilter=THREE.LinearFilter;
      const g=terrainGeometry.clone();g.deleteAttribute('color');
      if(grid){
        // Keep only DEM cells touched by the mask. Do not submit a second full terrain.
        const pixels=ctx.getImageData(0,0,4096,4096).data,indices=[],sx=4096/(grid.cols-1),sz=4096/(grid.rows-1);
        for(let row=0;row<grid.rows-1;row++)for(let col=0;col<grid.cols-1;col++){
          let wet=false;for(let y=Math.floor(row*sz);y<Math.ceil((row+1)*sz)&&!wet;y++)for(let x=Math.floor(col*sx);x<Math.ceil((col+1)*sx);x++)if(pixels[(y*4096+x)*4+1]>0){wet=true;break;}
          if(wet){const a=row*grid.cols+col,b=a+grid.cols,d=a+1,c=b+1;indices.push(a,b,d,b,c,d);}
        }
        g.setIndex(indices);
      }const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+offset);p.needsUpdate=true;
      const m=material();m.alphaMap=mask;m.alphaTest=.5;m.userData.maskTexture=mask;group.add(new THREE.Mesh(g,m));
    }
    group.userData.waterSurface='geographic terrain footprint';return group;
  }
  function containsPolygon(x,z){
    const q=unproject(x,z,bounds);for(const polygon of polygons){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.lat>q.lat)!==(b.lat>q.lat)&&q.lon<(b.lon-a.lon)*(q.lat-a.lat)/(b.lat-a.lat)+a.lon)inside=!inside;}if(inside)return true;}return false;
  }
  return {add,mesh,metadata,records,offset,containsPolygon};
}
