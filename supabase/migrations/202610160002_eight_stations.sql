-- Generated catalog comes from src/station-model.js. Run after migration 001.
begin;
create table public.sw_station_catalog(risk_id text primary key,definition jsonb not null);
alter table public.sw_station_catalog enable row level security;
create policy sw_station_catalog_read on public.sw_station_catalog for select to authenticated using(true);
revoke all on public.sw_station_catalog from anon,authenticated;
grant select on public.sw_station_catalog to authenticated;
insert into public.sw_station_catalog values ('water',$catalog${"sourceType":"sensor","label":"模拟传感器","fields":[{"key":"secondary","scope":"secondary","label":"模拟涨水速度","unit":"cm/min","min":-5,"max":5,"step":0.1,"value":0.6,"source":"模拟采集"}],"note":"点位水深与涨退速度，不是龙溪河演算结果；不反推真实流量。","id":"water","pointId":"ST-WATER-01","min":0,"max":60,"step":1,"warning":15,"danger":30,"metric":"积水深度","unit":"cm"}$catalog$::jsonb);
insert into public.sw_station_catalog values ('ice',$catalog${"sourceType":"sensor","label":"模拟传感器＋巡查","fields":[{"key":"secondary","scope":"secondary","label":"模拟表面湿度","unit":"%","min":0,"max":100,"step":1,"value":75,"source":"模拟采集"},{"key":"surface","label":"路面情况","options":["未知","干燥","有水","积雪"],"value":"未知","scope":"extra","source":"模拟人工核查"},{"key":"inspection","label":"巡查结果","options":["未巡查","未发现冰","发现结冰"],"value":"未巡查","scope":"extra","source":"模拟人工核查"},{"scope":"context","key":"snowDepth","label":"模拟积雪厚度","unit":"cm","min":0,"max":40,"value":0,"source":"模拟背景，不参与等级计算"}],"note":"温度低只提示核查；发现结冰须明确填写模拟巡查记录。雪深为背景，不是形成速率。","id":"ice","pointId":"ST-ICE-01","min":-12,"max":10,"step":0.5,"warning":1,"danger":-3,"metric":"地表温度","unit":"℃"}$catalog$::jsonb);
insert into public.sw_station_catalog values ('lightning',$catalog${"sourceType":"external_warning","label":"模拟外部预警","fields":[{"key":"validMinutes","label":"模拟信号有效期","unit":"min","min":1,"max":1440,"value":60,"step":1,"scope":"extra","source":"模拟外部预警"}],"note":"这里上报预警等级与有效期，不测量雷击大小，不把动画频率当监测数据。自动转发不会刷新预警发布时间。","id":"lightning","pointId":"ST-LIGHTNING-01","min":0,"max":3,"step":1,"warning":1,"danger":2,"metric":"外部预警等级（模拟）","unit":"级"}$catalog$::jsonb);
insert into public.sw_station_catalog values ('wind',$catalog${"sourceType":"sensor","label":"模拟传感器＋巡查","fields":[{"key":"secondary","scope":"secondary","label":"风过程持续","unit":"s","min":0,"max":3600,"step":1,"value":20,"source":"模拟采集"},{"key":"direction","label":"风向","unit":"°","min":0,"max":360,"value":0,"step":1,"scope":"extra","source":"模拟环境输入"},{"key":"facility","label":"待核查设施","options":["临时设施","树木","建筑附属设施"],"value":"临时设施","scope":"extra","source":"模拟人工核查"},{"key":"inspection","label":"设施巡查","options":["未巡查","未见异常","发现松动"],"value":"未巡查","scope":"extra","source":"模拟人工核查"},{"scope":"context","key":"gust","label":"模拟阵风峰值","unit":"m/s","min":0,"max":35,"value":8,"source":"模拟背景，不参与等级计算"}],"note":"等级按基础风速和巡查；阵风是背景记录，不预测设施倒塌，不直接启动风动画。","id":"wind","pointId":"ST-WIND-01","min":0,"max":35,"step":0.5,"warning":12,"danger":20,"metric":"基础风速","unit":"m/s"}$catalog$::jsonb);
insert into public.sw_station_catalog values ('heat',$catalog${"sourceType":"sensor","label":"模拟传感器＋环境记录","fields":[{"key":"secondary","scope":"secondary","label":"模拟相对湿度","unit":"%","min":0,"max":100,"step":1,"value":55,"source":"模拟采集"},{"key":"shade","label":"遮阴情况","options":["有遮阴","无遮阴","未知"],"value":"未知","scope":"extra","source":"模拟人工核查"},{"scope":"context","key":"heatMinutes","label":"持续高温背景","unit":"min","min":0,"max":1440,"value":30,"source":"模拟背景，不参与等级计算"}],"note":"记录温湿度与遮阴；不诊断中暑，持续时间为背景，不自动控制热浪动画。","id":"heat","pointId":"ST-HEAT-01","min":20,"max":45,"step":0.5,"warning":35,"danger":39,"metric":"环境温度","unit":"℃"}$catalog$::jsonb);
insert into public.sw_station_catalog values ('forest',$catalog${"sourceType":"scenario_index","label":"模拟环境＋人为指数＋巡查","fields":[{"scope":"context","key":"airTemperature","label":"模拟环境温度","unit":"℃","min":-20,"max":55,"value":25,"source":"模拟背景，不参与等级计算"},{"key":"secondary","scope":"secondary","label":"模拟相对湿度","unit":"%","min":0,"max":100,"step":1,"value":40,"source":"模拟采集"},{"key":"wind","label":"背景风速","unit":"m/s","min":0,"max":50,"value":3,"step":0.5,"scope":"extra","source":"模拟环境输入"},{"key":"recentRain","label":"近期降雨","options":["有降雨","无降雨","未知"],"value":"未知","scope":"extra","source":"模拟环境输入"},{"key":"inspection","label":"巡查记录","options":["未巡查","未见烟火","发现烟雾","发现火情"],"value":"未巡查","scope":"extra","source":"模拟人工核查"}],"note":"火险指数是人为设定的演示变量，温湿度不自动换算成正式火险指数；上报烟火不自动点燃三维模型。","id":"forest","pointId":"ST-FOREST-01","min":0,"max":100,"step":1,"warning":55,"danger":80,"metric":"演示火险指数","unit":"/100"}$catalog$::jsonb);
insert into public.sw_station_catalog values ('landslide',$catalog${"sourceType":"sensor","label":"模拟位移＋巡查＋外部信息","fields":[{"key":"secondary","scope":"secondary","label":"模拟累计降雨","unit":"mm","min":0,"max":1000,"step":1,"value":15,"source":"模拟采集"},{"key":"inspection","label":"边坡巡查","options":["未巡查","未见异常","发现裂缝","发现掉块"],"value":"未巡查","scope":"extra","source":"模拟人工核查"},{"key":"external","label":"模拟外部预警","options":["无","需关注","加强核查"],"value":"无","scope":"extra","source":"模拟外部预警"}],"note":"记录位移、雨量和边坡异常，不据此预测真实滑坡路径或发生时间。","id":"landslide","pointId":"ST-LANDSLIDE-01","min":0,"max":20,"step":0.1,"warning":3,"danger":8,"metric":"演示位移变化","unit":"mm/h"}$catalog$::jsonb);
insert into public.sw_station_catalog values ('debris',$catalog${"sourceType":"sensor","label":"模拟雨量＋巡查＋外部信息","fields":[{"key":"secondary","scope":"secondary","label":"模拟前期累计雨量","unit":"mm","min":0,"max":1000,"step":1,"value":40,"source":"模拟采集"},{"key":"inspection","label":"沟道巡查","options":["未巡查","未见异常","发现异常水流","发现堵塞"],"value":"未巡查","scope":"extra","source":"模拟人工核查"},{"key":"external","label":"模拟外部预警","options":["无","需关注","加强核查"],"value":"无","scope":"extra","source":"模拟外部预警"}],"note":"降雨与沟道异常用于核查提醒，不等于泥石流发生；泥流速度、宽度等仍属于动画假定参数。","id":"debris","pointId":"ST-DEBRIS-01","min":0,"max":100,"step":1,"warning":30,"danger":60,"metric":"小时降雨量","unit":"mm/h"}$catalog$::jsonb);
create table public.sw_station_samples(
 room_id uuid not null references public.sw_rooms on delete cascade, nonce uuid not null,
 risk_id text not null references public.sw_station_catalog, actor uuid not null references auth.users,
 sample jsonb not null, received_at timestamptz not null default clock_timestamp(),primary key(room_id,nonce)
);
alter table public.sw_station_samples enable row level security;
create policy sw_station_sample_read on public.sw_station_samples for select to authenticated using(sw_private.member_role(room_id) in ('operator','sensor'));
revoke all on public.sw_station_samples from anon,authenticated;
grant select on public.sw_station_samples to authenticated;

create function public.sw_submit_observation(p_room uuid,p_nonce uuid,p_risk text,p_sample jsonb)
 returns public.sw_risks language plpgsql security definer set search_path='' as $$
declare c jsonb; f jsonb; raw jsonb; k text; v numeric; n numeric; observed numeric; now_ms numeric;
 expires numeric; unknown_data boolean; lev int; extra jsonb; reason text; source text; old public.sw_station_samples; r public.sw_risks;
begin
 if coalesce(sw_private.member_role(p_room),'') not in ('operator','sensor') then raise exception 'sensor_role_required' using errcode='42501'; end if;
 select definition into c from public.sw_station_catalog where risk_id=p_risk;
 if pg_column_size(p_sample)>16384 or jsonb_typeof(p_sample->'schema') is distinct from 'number' or c is null or p_sample->>'schema' is distinct from '2' or p_sample->>'id' is distinct from p_risk or p_sample->>'pointId' is distinct from c->>'pointId' or p_sample->>'sourceType' is distinct from c->>'sourceType'
 or jsonb_typeof(p_sample->'value') is distinct from 'number' or jsonb_typeof(p_sample->'at') is distinct from 'number' or jsonb_typeof(p_sample->'observedAt') is distinct from 'number'
 or jsonb_typeof(p_sample->'extra') is distinct from 'object' or jsonb_typeof(p_sample->'context') is distinct from 'object' or p_sample->>'quality' is null or p_sample->>'quality' not in ('valid','missing','expired') then raise exception 'invalid_observation'; end if;
 for k in select jsonb_object_keys(p_sample) loop
  if k not in ('schema','id','pointId','sourceType','value','secondary','extra','context','quality','at','observedAt','nonce') then raise exception 'unknown_observation_field';end if;
 end loop;
 v:=(p_sample->>'value')::numeric;observed:=(p_sample->>'observedAt')::numeric;now_ms:=extract(epoch from clock_timestamp())*1000;
 if v<(c->>'min')::numeric or v>(c->>'max')::numeric or (p_risk='lightning' and v<>trunc(v)) or observed<0 or observed>now_ms+2000 or (p_sample->>'at')::numeric<0 or (p_sample->>'at')::numeric>now_ms+2000 or observed>(p_sample->>'at')::numeric+2000 then raise exception 'observation_out_of_range'; end if;
 for f in select * from jsonb_array_elements(c->'fields') loop
  raw:=case when f->>'scope'='secondary' then p_sample->'secondary' else p_sample->(f->>'scope')->(f->>'key') end;
  if f ? 'options' then
   if jsonb_typeof(raw) is distinct from 'string' or not exists(select 1 from jsonb_array_elements(f->'options') o where o=raw) then raise exception 'invalid_choice'; end if;
  else
   if jsonb_typeof(raw) is distinct from 'number' then raise exception 'invalid_number'; end if;
   n:=(raw#>>'{}')::numeric;if n<(f->>'min')::numeric or n>(f->>'max')::numeric then raise exception 'field_out_of_range';end if;
  end if;
 end loop;
 for k in select jsonb_object_keys(p_sample->'extra') loop
  if not exists(select 1 from jsonb_array_elements(c->'fields') as cf(def) where cf.def->>'scope'='extra' and cf.def->>'key'=k) then raise exception 'unknown_extra_field';end if;
 end loop;
 for k in select jsonb_object_keys(p_sample->'context') loop
  if not exists(select 1 from jsonb_array_elements(c->'fields') as cf(def) where cf.def->>'scope'='context' and cf.def->>'key'=k) then raise exception 'unknown_context_field';end if;
 end loop;
 extra:=p_sample->'extra';
 expires:=observed+case when p_risk='lightning' then (extra->>'validMinutes')::numeric*60000 else 10000 end;
 unknown_data:=p_sample->>'quality'<>'valid' or now_ms>=expires;
 lev:=case when v>=(c->>'danger')::numeric then 2 when v>=(c->>'warning')::numeric then 1 else 0 end;
 if p_risk='ice' then lev:=case when extra->>'inspection'='发现结冰' then 2 when v<=0 and extra->>'surface' in ('有水','积雪') then 1 when v<=(c->>'warning')::numeric then 1 else 0 end;end if;
 if p_risk='forest' and extra->>'inspection' in ('发现烟雾','发现火情') then lev:=2;end if;
 if p_risk='wind' and extra->>'inspection'='发现松动' then lev:=greatest(lev,1);end if;
 if p_risk in ('landslide','debris') then
  if extra->>'external'<>'无' then lev:=greatest(lev,case when extra->>'external'='加强核查' then 2 else 1 end);end if;
  if extra->>'inspection' not in ('未巡查','未见异常') then lev:=greatest(lev,1);end if;
 end if;
 if unknown_data then lev:=0;end if;
 source:='虚拟监测站 '||(c->>'pointId');
 reason:='固定演示规则（未经现场标定）；'||(c->>'metric')||'='||v||(c->>'unit')||'；'||(c->>'note');
 for f in select * from jsonb_array_elements(c->'fields') loop
  raw:=case when f->>'scope'='secondary' then p_sample->'secondary' else p_sample->(f->>'scope')->(f->>'key') end;
  reason:=reason||'；'||(f->>'label')||'='||(raw#>>'{}')||coalesce(f->>'unit','')||'（'||coalesce(f->>'source','模拟输入')||'）';
 end loop;
 -- A room lock serializes observations with operator writes. Nonce is unique per room, not just per risk.
 perform 1 from public.sw_rooms where id=p_room for update;
 select * into old from public.sw_station_samples where room_id=p_room and nonce=p_nonce;
 if found then
  if old.risk_id<>p_risk then raise exception 'nonce_conflict';end if;
  select * into r from public.sw_risks where room_id=p_room and risk_id=p_risk;return r;
 end if;
 insert into public.sw_station_samples(room_id,nonce,risk_id,actor,sample) values(p_room,p_nonce,p_risk,auth.uid(),p_sample);
 return sw_private.store_packet(p_room,p_risk,jsonb_build_object('value',v,'level',lev,'unknown',unknown_data,'reason',reason,'action',case when unknown_data then '核查数据来源与现场，不能按正常数据使用。' else '按模拟读数与核查证据准备响应，不认定实际灾害已发生。' end,'source',source,'sample',p_sample,'expiresAt',expires));
end $$;
revoke all on function public.sw_submit_observation(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.sw_submit_observation(uuid,uuid,text,jsonb) to authenticated;

create function sw_private.protect_station_reading() returns trigger language plpgsql set search_path='' as $$
begin
 if new.packet->>'source'='云端监测模拟' and old.packet->>'source' like '虚拟监测站 ST-%' and old.updated_at>clock_timestamp()-interval '10 seconds' then raise exception 'fresh_station_owns_reading' using errcode='40001';end if;
 return new;
end $$;
revoke all on function sw_private.protect_station_reading() from public,anon,authenticated;
create trigger sw_preserve_station_reading before update on public.sw_risks for each row execute function sw_private.protect_station_reading();
commit;
