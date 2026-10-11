export function mountMapShell(){
 const panel=document.querySelector('.map-panel'),footer=panel.querySelector('.map-footer');
 const caption=document.createElement('div');caption.className='scene-caption';caption.id='scene-caption';caption.setAttribute('aria-live','polite');
 const toolbar=document.createElement('div');toolbar.className='map-toolbar';toolbar.append(panel.querySelector('.region-tour'),panel.querySelector('.layer-controls'));
 const context=document.createElement('details');context.className='map-context';context.innerHTML='<summary>图例与模型说明</summary><div class="map-context-body"></div>';context.lastElementChild.append(panel.querySelector('.map-class-legend'),panel.querySelector('.map-note'));
 footer.before(caption,toolbar);footer.after(context);
}
