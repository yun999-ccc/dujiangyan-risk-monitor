import xml.etree.ElementTree as E,json,os
ways={};nodesCount=0
source_dir=os.environ.get('OSM_SOURCE_DIR','artifacts/source-data')
for name in ['osm-source.xml','osm-city.xml']:
 p=os.path.join(source_dir,name)
 if not os.path.exists(p):continue
 root=E.parse(p).getroot();nodes={n.attrib['id']:{'lon':float(n.attrib['lon']),'lat':float(n.attrib['lat'])} for n in root.findall('node')};nodesCount+=len(nodes)
 for w in root.findall('way'):
  tags={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')}
  if tags.get('natural')=='wood' or tags.get('landuse') in ('residential','industrial','farmland') or 'building' in tags or tags.get('waterway')=='river' or tags.get('natural')=='water' or tags.get('highway') in ('primary','secondary','tertiary','motorway','trunk','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link','residential','living_street','unclassified','service','pedestrian','footway','path','track','cycleway','steps'):
   geom=[nodes[n.attrib['ref']] for n in w.findall('nd') if n.attrib['ref'] in nodes]
   if len(geom)>1:ways[w.attrib['id']]={'id':int(w.attrib['id']),'tags':tags,'geometry':geom}
result={'source':'OpenStreetMap API 0.6','downloaded':'2026-10-10','coverageNote':'仅抓取河谷与城区两个矩形片区，覆盖不完整；不是行政边界','elements':list(ways.values())}
json.dump(result,open('public/data/osm.json','w'),ensure_ascii=False)
print(json.dumps({'selectedWays':len(ways),'buildings':sum('building' in w['tags'] for w in ways.values()),'nodes':nodesCount},ensure_ascii=False))
