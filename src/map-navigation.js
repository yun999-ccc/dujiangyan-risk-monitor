import * as THREE from 'three';
// Shared inspection controls. Units are those of each scene (km in the map scenes).
export function createMapNavigation(controls,camera,canvas,{minDistance=.012,maxDistance=68,ground=null,bounds=null,pickPoint=null,onChange=null}={}){
 let drag='rotate',mode='3d',lastUpdate=performance.now();controls.enablePan=true;controls.enableZoom=true;controls.minDistance=minDistance;controls.maxDistance=maxDistance;controls.zoomToCursor=true;controls.screenSpacePanning=false;controls.maxPolarAngle=Math.PI*.485;
 canvas.tabIndex=0;canvas.setAttribute('aria-label','三维地图：可切换旋转和平移，滚轮缩放，双击聚焦，方向键平移');controls.listenToKeyEvents(canvas);
 function setDragMode(next){const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;drag=next==='pan'?'pan':'rotate';controls.mouseButtons.LEFT=mode==='2d'||drag==='pan'?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;controls.touches.ONE=mode==='2d'||drag==='pan'?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;canvas.dataset.dragMode=mode==='2d'?'pan':drag;}
 function setMode(next){mode=next;controls.enableRotate=next!=='2d';setDragMode(drag);}
 function focus(point,maxFocusDistance=.14){
  const offset=camera.position.clone().sub(controls.target);if(offset.lengthSq()<1e-12)offset.set(1,1,1);
  const distance=THREE.MathUtils.clamp(Math.min(offset.length()*.5,maxFocusDistance),minDistance,maxDistance);
  controls.target.copy(point);camera.position.copy(point).add(offset.normalize().multiplyScalar(distance));controls.update();update();
 }
 function zoom(factor){const direction=camera.position.clone().sub(controls.target),distance=THREE.MathUtils.clamp(direction.length()*factor,minDistance,maxDistance);camera.position.copy(controls.target).add(direction.setLength(distance));controls.update();update();}
 function update(){
  const now=performance.now(),elapsed=Math.min(.25,Math.max(.001,(now-lastUpdate)/1000));lastUpdate=now;controls.dampingFactor=1-Math.pow(.92,elapsed*60);controls.update();
  camera.near=THREE.MathUtils.clamp(camera.position.distanceTo(controls.target)*.02,.0003,.2);camera.updateProjectionMatrix();
  if(bounds){const before=controls.target.clone();controls.target.x=THREE.MathUtils.clamp(controls.target.x,bounds.minX,bounds.maxX);controls.target.z=THREE.MathUtils.clamp(controls.target.z,bounds.minZ,bounds.maxZ);camera.position.add(controls.target.clone().sub(before));}
  if(ground){const floor=ground(controls.target.x,controls.target.z);if(Number.isFinite(floor)&&controls.target.y<floor+.001){const lift=floor+.001-controls.target.y;controls.target.y+=lift;camera.position.y+=lift;}const under=ground(camera.position.x,camera.position.z);if(Number.isFinite(under)&&camera.position.y<under+.001)camera.position.y=under+.001;}
  camera.updateMatrixWorld();onChange?.(snapshot());
 }
 function snapshot(){return {position:camera.position.toArray(),target:controls.target.toArray(),distance:camera.position.distanceTo(controls.target),azimuth:controls.getAzimuthalAngle(),polar:controls.getPolarAngle(),minDistance,maxDistance,near:camera.near,dragMode:canvas.dataset.dragMode,mode};}
 const focusCanvas=()=>canvas.focus({preventScroll:true}),onDouble=e=>{if(e.button!==0||!pickPoint)return;const p=pickPoint(e);if(p)focus(p);};
 canvas.addEventListener('pointerdown',focusCanvas);canvas.addEventListener('dblclick',onDouble);setDragMode(drag);
 return {setDragMode,setMode,focus,zoom,update,snapshot,dispose(){controls.stopListenToKeyEvents();canvas.removeEventListener('pointerdown',focusCanvas);canvas.removeEventListener('dblclick',onDouble);}};
}
