export function mountMapShell(){
 const panel=document.querySelector('.map-panel'),footer=panel.querySelector('.map-footer');
 const caption=document.createElement('div');caption.className='scene-caption';caption.id='scene-caption';caption.setAttribute('aria-live','polite');
 const toolbar=document.createElement('div');toolbar.className='map-toolbar';toolbar.append(panel.querySelector('.region-tour'),panel.querySelector('.layer-controls'));
 const navigation=document.createElement('div');navigation.className='map-navigation-controls';navigation.setAttribute('role','group');navigation.setAttribute('aria-label','地图拖动方式');navigation.innerHTML='<button data-map-drag="rotate" class="active" aria-pressed="true">拖动旋转</button><button data-map-drag="pan" aria-pressed="false">拖动平移</button>';toolbar.prepend(navigation);
 const context=document.createElement('details');context.className='map-context';context.innerHTML='<summary>图例与模型说明</summary><div class="map-context-body"></div>';context.lastElementChild.append(panel.querySelector('.map-class-legend'),panel.querySelector('.map-note'));
 footer.lastElementChild.textContent='右键平移 · 滚轮缩放 · 双击聚焦 · 手机双指移动/缩放';footer.before(caption,toolbar);footer.after(context);
}
