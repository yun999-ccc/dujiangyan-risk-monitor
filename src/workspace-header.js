// Shared presentation only; navigation keeps the existing three entry points.
export function workspaceNavigation(current){
 return `<nav class="workspace-nav" aria-label="工作空间">${[['monitor','./','监测模拟'],['device','device.html','虚拟监测站'],['terminal','terminal.html','警示终端']].map(([id,href,label])=>`<a href="${href}" ${id===current?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
}
export const workspaceMark='<svg viewBox="0 0 48 36" fill="none" aria-hidden="true"><path d="M3 31 17 8l8 12 7-15 13 26M10 31l9-12 7 9 6-9 8 12" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>';
