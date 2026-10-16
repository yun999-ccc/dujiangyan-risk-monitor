import {readFile,writeFile} from 'node:fs/promises';
import {stationDefinitions} from '../src/station-model.js';
const template=await readFile(new URL('../supabase/templates/stations-upgrade.sql',import.meta.url),'utf8');
const catalog=Object.values(stationDefinitions).map(d=>`insert into public.sw_station_catalog values ('${d.id}',$catalog$${JSON.stringify(d)}$catalog$::jsonb);`).join('\n');
const output=template.replace('-- STATION_CATALOG',catalog),path=new URL('../supabase/migrations/202610160002_eight_stations.sql',import.meta.url);
if(process.argv.includes('--check')){if(await readFile(path,'utf8')!==output)throw Error('采集字段与002迁移不一致，请运行 node scripts/build-station-migration.mjs');}else await writeFile(path,output);
