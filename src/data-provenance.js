export async function loadGeometryAudit() {
 const response=await fetch(import.meta.env.BASE_URL+'data/geometry-audit.json');
 if(!response.ok)throw Error('几何核查记录未载入，不能确认数据依据');
 return response.json();
}
export function auditMarkup(report) {
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const s=report.terrain.spacingMeters,b=report.buildings.heightSources,check=report.sourceChecks[0];
 return `<div class="audit-status"><strong>关键几何仍待补齐</strong><span>数据核查完成 ≠ 现场准确性通过</span></div>
 <div class="audit-summary"><div><b>${s.eastWest.toFixed(1)} × ${s.northSouth.toFixed(1)} m</b><span>打包DEM采样间距 · 精度未核实</span></div><div><b>${b['levels-assumed']+b['default-assumed']} / ${report.buildings.total}</b><span>使用推算或默认高度的建筑轮廓</span></div><div><b>${report.river.grid.dx} m</b><span>插值计算网格 · 不增加测绘细节</span></div></div>
 <div class="audit-requirements">${report.requirements.map(r=>`<div><b>${escape(r.name)}</b><span class="audit-tag">${r.status==='verified'?'已核实':r.status==='missing'?'缺少资料':'待核实'}</span><p>${escape(r.detail)}</p></div>`).join('')}</div>
 <p class="audit-footnote">建筑高度依据：${b['height-tag']}条有高度标签；${b['levels-assumed']}条按楼层×3m推算；${b['default-assumed']}条默认12m。公开标签均未现场核验。当前地形高程基准尚未核实，不能把图上的高度当成测量结果。</p><p class="audit-footnote">风险点位：黄央沟节点取自2014年文献沟口坐标，坐标基准未注明；其余7个节点为示意布置。八类点位均未现场核实，显示的小数位数不代表定位精度。</p>
 ${check?`<p class="audit-footnote">局部OSM复查：${escape(check.checkedAt.slice(0,10))}，${check.counts.roads}条道路、${check.counts.buildings}条建筑记录。缺少建筑记录不代表现场无建筑。<a href="${escape(check.url)}" target="_blank" rel="noopener">查看查询范围</a>。</p>`:''}
 <div class="audit-links">${report.references.map(r=>`<a href="${escape(r.url)}" target="_blank" rel="noopener">${escape(r.title)}</a>`).join('')}<a href="${import.meta.env.BASE_URL}data/geometry-audit.json" download="几何数据核查.json">下载核查记录</a></div>`;
}
export function mountDataProvenance() {
 const panel=document.createElement('section');panel.className='panel provenance-panel';panel.setAttribute('aria-label','几何数据依据');
 panel.innerHTML='<details id="geometry-data-details"><summary><span><b>几何数据依据</b><small>查看地形、建筑、河槽的来源与缺口</small></span><span id="geometry-readiness">正在核查…</span></summary><div id="geometry-data-content" role="status"></div></details>';
 document.querySelector('.map-panel').after(panel);
 let report=null;
 loadGeometryAudit().then(r=>{report=r;panel.querySelector('#geometry-readiness').textContent=r.readiness.ready?'几何核查通过':'关键数据待补';panel.querySelector('#geometry-data-content').innerHTML=auditMarkup(r);window.__geometryAudit=r;}).catch(e=>{panel.querySelector('#geometry-readiness').textContent='核查记录不可用';panel.querySelector('#geometry-data-content').textContent=e.message;});
 return {get report(){return report}};
}
