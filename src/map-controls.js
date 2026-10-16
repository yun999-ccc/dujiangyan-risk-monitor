// Move the real controls, retaining one handler and one value per input.
export function createMapControls(title,hint){
 const panel=document.createElement('section');panel.className='map-process-controls';panel.hidden=true;
 const heading=document.createElement('strong');heading.textContent=title;panel.append(heading);
 const text=document.createElement('p');text.textContent=hint;panel.append(text);
 const body=document.createElement('div');body.className='map-process-body';panel.append(body);
 const right=document.querySelector('.reference-process-slot'),playback=document.querySelector('.reference-playback');if(right)right.append(panel);else document.querySelector('#canvas').after(panel);const anchors=new Map();
 return {panel,body,show(nodes){panel.hidden=false;for(const node of nodes){if(!node)continue;if(!anchors.has(node)){const anchor=document.createComment('original control position');node.before(anchor);anchors.set(node,anchor);}const destination=playback&&node.matches('.hydraulic-actions,.hydraulic-seek-label,.effect-actions,.effect-seek-label,.lightning-actions,.lightning-seek-label')?playback:body;if(node.parentNode!==destination)destination.append(node);}},hide(){panel.hidden=true;for(const [node,anchor] of anchors)anchor.after(node);},dispose(){for(const [node,anchor] of anchors){anchor.after(node);anchor.remove();}panel.remove();}};
}
