import * as THREE from 'three';import {project} from './model.js';import {channelShape,lightningRegions} from './lightning-model.js';
export function createLightningLayer(scene,bounds,elevation,getState){
 const group=new THREE.Group();scene.add(group);let identity='',shapeGroup=new THREE.Group(),cloudGroup=new THREE.Group();group.add(shapeGroup,cloudGroup);let region='',eventCloud;
 const label=document.createElement('div');label.className='lightning-map-label';document.querySelector('#canvas').append(label);label.hidden=true;
 const clear=g=>{for(const child of [...g.children]){child.geometry?.dispose();child.material?.dispose();g.remove(child);}};
 function update(camera,container){const s=getState(),v=s.lightningDisplay??{event:null,static:false,until:0};group.visible=s.selected==='lightning'&&!!s.lightningSession;label.hidden=!group.visible;if(!group.visible)return;
  for(const cloud of cloudGroup.children)cloud.visible=cloud===eventCloud||!v.static;
  const config=s.lightningSession.config,center=lightningRegions[config.region],base=project(center.lon,center.lat,bounds),y=elevation(center.lon,center.lat);
  if(region!==config.region){region=config.region;clear(cloudGroup);for(let i=0;i<7;i++){const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({color:'#a6b3b9',transparent:true,opacity:.22,depthWrite:false}));mesh.position.set(base.x+(i-3)*.17,y+1.15+Math.sin(i)*.08,base.z+Math.cos(i)*.15);mesh.scale.set(.34,.1,.25);cloudGroup.add(mesh);}eventCloud=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({color:'#a6b3b9',transparent:true,opacity:.28,depthWrite:false}));eventCloud.scale.set(.28,.09,.24);cloudGroup.add(eventCloud);}
  const event=v.event,key=event?`${event.id}:${event.seed}:${config.region}:${event.location?.lon}:${event.location?.lat}:${config.style}:${event.type}`:'none';if(identity!==key){identity=key;clear(shapeGroup);if(event?.location){const q=project(event.location.lon,event.location.lat,bounds),ground=elevation(event.location.lon,event.location.lat),shape=channelShape(event,config.style),radius=config.style==='柔和'?.0025:config.style==='鲜明'?.005:.0035;
    eventCloud.position.set(q.x+shape.points[0].x,ground+.95,q.z+shape.points[0].z);
    for(const path of [shape.points,...shape.branches]){const curve=new THREE.CurvePath();for(let i=1;i<path.length;i++)curve.add(new THREE.LineCurve3(new THREE.Vector3(q.x+path[i-1].x,ground+.0004+path[i-1].y,q.z+path[i-1].z),new THREE.Vector3(q.x+path[i].x,ground+.0004+path[i].y,q.z+path[i].z)));
     for(const [r,color,opacity] of [[radius*3,'#77ceef',.16],[radius,'#f1fcff',.94]]){const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,path.length*4,r,5,false),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false}));mesh.userData.baseOpacity=opacity;shapeGroup.add(mesh);}
    }
  }}
  const visible=!!event?.location&&(v.static||performance.now()<v.until);shapeGroup.visible=visible;for(const mesh of shapeGroup.children)mesh.material.opacity=mesh.userData.baseOpacity*(v.unknown?.32:1);
  const point=event?.location??center,q=project(point.lon,point.lat,bounds),pos=new THREE.Vector3(q.x,elevation(point.lon,point.lat)+1.02,q.z).project(camera);label.hidden=!visible||pos.z>1||Math.abs(pos.x)>1||Math.abs(pos.y)>1;label.style.left=`${(pos.x*.5+.5)*container.clientWidth}px`;label.style.top=`${(-pos.y*.5+.5)*container.clientHeight}px`;label.textContent=v.unknown?'事件数据未知 · 保留形态示意':`${v.caption} · ${event?.type??''} · 位置为模拟`;
  window.__lightningLayer={visible,branches:event?3:0,type:event?.type,caption:v.caption,region,fullScreenFlash:false};
 }
 return {update,dispose(){label.remove();clear(shapeGroup);clear(cloudGroup);scene.remove(group);}};
}
