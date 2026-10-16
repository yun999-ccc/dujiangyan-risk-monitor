// Presentation slots only. Real input nodes retain their values and handlers.
export function mountReferenceLayout(getState){
 document.body.classList.add('reference-layout');
 const $=s=>document.querySelector(s),main=$('.maincolumn'),right=$('.rightcolumn'),map=$('.map-panel');
 const process=document.createElement('div');process.className='reference-process-slot';right.prepend(process);
 const playback=document.createElement('div');playback.className='reference-playback';$('#canvas').after(playback);
 const secondary=document.createElement('section');secondary.className='reference-secondary';secondary.innerHTML='<h2>更多配置与演练记录</h2><p>保留全部监测、情景、核查和来源功能。</p>';main.append(secondary);
 const snapshot=document.createElement('section');snapshot.className='panel reference-reading';snapshot.hidden=true;right.insertBefore(snapshot,right.children[1]??null);
 const tools=document.createElement('div');tools.className='reference-scene-tools';map.append(tools);
 for(const n of [...map.children])if(n.matches('.scene-caption,.map-toolbar,.map-footer,.map-context'))tools.append(n);
 tools.classList.add('panel');main.append(tools);
 const intro=$('.intro'),actions=$('.actions');intro.classList.add('reference-intro');$('.workspace-header .headright').prepend(actions);
 const context=document.createElement('details');context.className='reference-context';context.innerHTML='<summary>连接、说明与导出</summary>';$('.workspace-header').after(context);
 context.append($('.navline'),intro,$('.cloud-panel'));
 const plot=$('.timeline-panel');main.insertBefore(plot,map.nextSibling);
 let sideReady=false;
 const boundRanges=new Map();
 const place=(node,parent)=>{if(node&&node.parentNode!==parent)parent.append(node);};
 return {refresh(){
  const s=getState(),id=s.selected,active=document.body.classList.contains('hydraulic-layout');
  for(const n of document.querySelectorAll('.map-process-controls'))place(n,process);
  place($('.process-controls'),process);const hydraulic=$('.hydraulic-panel');if(hydraulic){place(hydraulic,active?right:process);if(active&&hydraulic.previousElementSibling!==snapshot)snapshot.after(hydraulic);}
  place($('.wind-map-transport'),playback);
  for(const n of document.querySelectorAll('.effects-panel,.simulation-workbench,.geometry-provenance,.water-panel'))place(n,secondary);
  const pp=$('.process-controls');
  if(pp&&!pp.hidden){
   for(const n of pp.querySelectorAll('.process-transport,.process-timeline')){n.dataset.referenceProcess='true';place(n,playback);}
  }
  for(const n of playback.querySelectorAll('[data-reference-process]'))n.hidden=!pp||pp.hidden;
  if(!sideReady&&$('.evidence-section')){
   const extra=document.createElement('details');extra.className='reference-monitor-extra';extra.innerHTML='<summary>巡查、质量、阈值与故障设置</summary>';
   const controls=$('.rightpanel .controls');controls.append(extra);
   for(const n of [...controls.children])if(n!==extra&&!n.classList.contains('control'))extra.append(n);
   sideReady=true;
  }
  snapshot.hidden=!active;
  if(active){const n=s.states.water;snapshot.innerHTML=`<h2>监测输入</h2><span class="reading-source">点位读数 · 与河段演算分开</span><div class="snapshot-value">${n.unknown?'—':Number(n.value).toFixed(1)}<small>cm</small></div><p>${n.unknown?'当前数据未知':n.source??'模拟输入'}</p><p>该读数不控制河段演算水面。</p>`;}
  for(const input of document.querySelectorAll('.river-primary-fields input[type=number]')){
   if(!boundRanges.has(input)){const range=document.createElement('input');range.type='range';range.className='reference-bound-range';range.setAttribute('aria-label',input.parentElement.firstChild.textContent.trim()+'滑块');for(const k of ['min','max','step'])range[k]=input[k];range.oninput=()=>{input.value=range.value;};range.onchange=()=>input.dispatchEvent(new Event('change',{bubbles:true}));input.before(range);boundRanges.set(input,range);}
   const range=boundRanges.get(input);if(document.activeElement!==range)range.value=input.value;
  }
  const river=$('.river-results');if(river){
   if(!river.dataset.referenceReady){
    const detail=document.createElement('details');detail.className='reference-river-detail';detail.innerHTML='<summary>道路区段、处置、对照与数值核查</summary>';river.append(detail);
    const observation=document.createElement('details');observation.className='reference-observations';observation.innerHTML='<summary>沿河观察点、当前取值与资料说明</summary>';river.insertBefore(observation,river.querySelector('#river-history'));for(const n of river.querySelectorAll('.river-house-gap,#river-sites,#river-picked'))observation.append(n);river.querySelector('#river-history').after(observation);
    const start=river.querySelector('.river-roads-heading');if(start){let n=start;while(n&&n!==detail){const next=n.nextSibling;detail.append(n);n=next;}}
    river.dataset.referenceReady='true';
   }
   if(river.parentNode!==main)main.insertBefore(river,plot);
  }
  const standard=!!id&&!active;plot.hidden=!standard;
 }};
}
