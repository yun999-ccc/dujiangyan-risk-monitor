-- Generated catalog comes from src/station-model.js. Run after migration 001.
begin;
create table public.sw_station_catalog(risk_id text primary key,definition jsonb not null);
alter table public.sw_station_catalog enable row level security;
create policy sw_station_catalog_read on public.sw_station_catalog for select to authenticated using(true);
revoke all on public.sw_station_catalog from anon,authenticated;
grant select on public.sw_station_catalog to authenticated;
-- STATION_CATALOG
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
