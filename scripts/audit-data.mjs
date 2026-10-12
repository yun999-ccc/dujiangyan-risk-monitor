import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildingHeight,terrainSpacing,geometryDifference,geometryReadiness} from '../src/geometry-audit.js';
import {geometry,defaults} from '../src/hydraulic-model.js';
import {hazards} from '../src/model.js';
const read=name=>JSON.parse(fs.readFileSync(`public/data/${name}.json`));
const terrain=read('terrain'),osm=read('osm'),river=read('hydraulic'),buildings=osm.elements.filter(w=>w.tags?.building);
if(terrain.heights.length!==terrain.size**2||river.raw.length!==river.nx*river.ny||terrain.heights.some(v=>!Number.isFinite(v)))throw Error('地形数据尺寸或高程无效');
for(const key of ['distance','bank','blocked'])if(river[key].length!==river.raw.length)throw Error(`河谷${key}尺寸不一致`);
const heightSources={'height-tag':0,'levels-assumed':0,'default-assumed':0};
for(const w of buildings)heightSources[buildingHeight(w.tags).source]++;
const files=['terrain','osm','hydraulic'].map(id=>({id,path:`data/${id}.json`,sha256:crypto.createHash('sha256').update(fs.readFileSync(`public/data/${id}.json`)).digest('hex')}));
const report={version:1,scope:'龙溪河黄央沟邻近片区：几何数据核查',files,
 terrain:{source:terrain.source,url:terrain.url,downloaded:terrain.downloaded,size:terrain.size,bounds:terrain.bounds,tileZoom:terrain.tileZoom,spacingMeters:terrainSpacing(terrain),verticalDatum:'当前打包资料没有逐瓦片高程基准和来源映射，尚未核实',accuracyMeters:null},
 buildings:{total:buildings.length,heightSources,fieldVerified:0,note:'标签是公开地图记录；楼层按3m换算和默认12m均为假定，标签高度也未现场核验。展示另有限高和基座处理。'},
 locations:hazards.map(h=>({id:h.id,name:h.name,lon:h.lon,lat:h.lat,fieldVerified:false,source:h.id==='debris'?'2014年黄央沟文献沟口坐标，基准未注明；不是现时影响边界':'示意布置，未现场核实'})),
 river:{bounds:river.bounds,grid:{nx:river.nx,ny:river.ny,dx:river.dx},centerline:{id:river.riverId,url:`https://www.openstreetmap.org/way/${river.riverId}`},roads:river.roads.length,buildings:river.buildings.length,bridgeRoads:river.roads.filter(r=>r.tags.bridge&&r.tags.bridge!=='no').map(r=>r.id),defaultParameters:defaults,modification:geometryDifference(river,geometry(river).z)},
 requirements:[
 {id:'ground',name:'岸外裸土地形与高程基准',required:true,status:'unverified',detail:'已有公开高程，尚未核实当地垂直精度、裸土属性和统一高程基准。'},
 {id:'bed',name:'河床断面与纵剖面',required:true,status:'missing',detail:'缺少实测河床；48m宽、3m深及纵向平滑为假定。'},
 {id:'bank',name:'河岸、堤顶与越岸通道',required:true,status:'missing',detail:'岸外96m过渡为人工修改，尚无实测堤防或护岸控制高程。'},
 {id:'structures',name:'道路、桥梁与建筑阻水结构',required:true,status:'unverified',detail:'局部8条道路包含桥梁标签；桥孔、路面高程及建筑覆盖未核实，当前桥梁按贴地道路展示。'},
 {id:'drain',name:'排水口、管网与排水能力',required:true,status:'missing',detail:'排水量为手动假定，无现场管网和排水能力资料。'}
 ],
 sourceChecks:fs.existsSync('public/data/local-osm-check.json')?[read('local-osm-check')]:[],
 references:[{title:'Terrain Tiles / AWS',url:terrain.url},{title:'数据源说明 / Tilezen',url:'https://github.com/tilezen/joerd/blob/master/docs/data-sources.md'},{title:'水动力地形要求 / HEC-RAS',url:'https://www.hec.usace.army.mil/confluence/rasdocs/rmum/latest/terrain-layer'},{title:'OpenStreetMap / ODbL',url:'https://www.openstreetmap.org/copyright'}]
};
report.readiness=geometryReadiness(report);
fs.writeFileSync('public/data/geometry-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({buildings:report.buildings,spacing:report.terrain.spacingMeters,modification:report.river.modification,readiness:report.readiness},null,2));
