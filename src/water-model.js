// Metres in a deliberately designed street basin; no surveyed drainage model.
export function streetHeight(x,z){
  const ax=Math.abs(x);
  if(ax<=4.5)return .011*x*x+.002*z*z;
  if(ax<=6.5)return .28+.002*z*z;
  return .35+.001*z*z;
}
export function insideBuilding(x,z){return Math.abs(x)>=7&&Math.abs(x)<=11&&[-7,0,7].some(c=>Math.abs(z-c)<=2.5);}
export function waterCoverage(cm){
  if(cm<=0)return 0;let area=0;const step=.25;
  for(let x=-11+step/2;x<11;x+=step)for(let z=-13+step/2;z<13;z+=step)if(!insideBuilding(x,z)&&streetHeight(x,z)<cm/100)area+=step*step;
  return area;
}
export function waterTrend(n){const h=n.history??[];if(h.length<2)return '稳定';const d=h.at(-1).v-h.at(-2).v;return d>0?'上涨':d<0?'回落':'稳定';}
