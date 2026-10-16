-- Phase 1: simulated readings and acknowledgements; no physical devices.
-- Run once in a new Supabase project. Browser accounts cannot create rooms/members.
begin;
create schema if not exists sw_private;
revoke all on schema sw_private from public;
grant usage on schema sw_private to authenticated;
create table public.sw_rooms (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 80),
 controller_user uuid, controller_client uuid, lease_until timestamptz
);
create table public.sw_members (
 room_id uuid references public.sw_rooms on delete cascade, user_id uuid references auth.users on delete cascade,
 role text not null check(role in ('operator','sensor','responder','viewer')), primary key(room_id,user_id)
);
create table public.sw_risks (
 room_id uuid references public.sw_rooms on delete cascade,
 risk_id text check(risk_id in ('water','ice','lightning','wind','heat','forest','landslide','debris')),
 revision bigint not null default 0, packet jsonb not null default '{}', updated_at timestamptz not null default clock_timestamp(),
 primary key(room_id,risk_id)
);
create table public.sw_samples (
 room_id uuid references public.sw_rooms on delete cascade, nonce uuid not null,
 actor uuid not null references auth.users, value double precision not null check(value between 0 and 60),
 quality text not null check(quality in ('valid','missing')), received_at timestamptz not null default clock_timestamp(),
 primary key(room_id,nonce)
);
create table public.sw_acknowledgements (
 room_id uuid references public.sw_rooms on delete cascade, event_id uuid not null, risk_id text not null,
 actor uuid not null references auth.users, created_at timestamptz not null default clock_timestamp(),
 primary key(room_id,event_id,actor)
);
create function sw_private.member_role(p_room uuid) returns text
 language sql stable security definer set search_path='' as $$
 select role from public.sw_members where room_id=p_room and user_id=auth.uid()
$$;
revoke all on function sw_private.member_role(uuid) from public;
grant execute on function sw_private.member_role(uuid) to authenticated;
alter table public.sw_rooms enable row level security;
alter table public.sw_members enable row level security;
alter table public.sw_risks enable row level security;
alter table public.sw_samples enable row level security;
alter table public.sw_acknowledgements enable row level security;
create policy sw_room_read on public.sw_rooms for select to authenticated using (sw_private.member_role(id) is not null);
create policy sw_member_read on public.sw_members for select to authenticated using (user_id=auth.uid());
create policy sw_risk_read on public.sw_risks for select to authenticated using (sw_private.member_role(room_id) is not null);
create policy sw_sample_read on public.sw_samples for select to authenticated using (sw_private.member_role(room_id) in ('operator','sensor'));
create policy sw_ack_read on public.sw_acknowledgements for select to authenticated using (sw_private.member_role(room_id) is not null);
revoke all on public.sw_rooms,public.sw_members,public.sw_risks,public.sw_samples,public.sw_acknowledgements from anon,authenticated;
grant select on public.sw_rooms,public.sw_members,public.sw_risks,public.sw_samples,public.sw_acknowledgements to authenticated;

create function public.sw_claim_control(p_room uuid,p_client uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 if sw_private.member_role(p_room) is distinct from 'operator' then raise exception 'operator_required' using errcode='42501'; end if;
 update public.sw_rooms set controller_user=auth.uid(),controller_client=p_client,lease_until=clock_timestamp()+interval '15 seconds'
 where id=p_room and (lease_until is null or lease_until<clock_timestamp() or (controller_user=auth.uid() and controller_client=p_client));
 return found;
end $$;

create function sw_private.store_packet(p_room uuid,p_risk text,p_packet jsonb,p_expected bigint default null)
 returns public.sw_risks language plpgsql security definer set search_path='' as $$
declare r public.sw_risks; sig text; ev text; known jsonb;
begin
 insert into public.sw_risks(room_id,risk_id) values(p_room,p_risk) on conflict do nothing;
 select * into r from public.sw_risks where room_id=p_room and risk_id=p_risk for update;
 if p_expected is not null and r.revision<>p_expected then raise exception 'revision_conflict' using errcode='40001'; end if;
 sig := (p_packet->>'unknown')||':'||(p_packet->>'level');
 ev := case when r.packet->>'signature'=sig then r.packet->>'eventId' else gen_random_uuid()::text end;
 known := case when (p_packet->>'unknown')::boolean then coalesce(r.packet->'lastKnownLevel',r.packet->'level','null'::jsonb) else p_packet->'level' end;
 update public.sw_risks set revision=revision+1,updated_at=clock_timestamp(),
 packet=p_packet||jsonb_build_object('schema',1,'id',p_risk,'eventId',ev,'signature',sig,'lastKnownLevel',known,'at',extract(epoch from clock_timestamp())*1000)
 where room_id=p_room and risk_id=p_risk returning * into r;
 return r;
end $$;
revoke all on function sw_private.store_packet(uuid,text,jsonb,bigint) from public,authenticated;

create function public.sw_put_risk(p_room uuid,p_client uuid,p_risk text,p_expected bigint,p_packet jsonb)
 returns public.sw_risks language plpgsql security definer set search_path='' as $$
declare room public.sw_rooms; old public.sw_risks; v numeric; lo numeric; hi numeric;
begin
 if sw_private.member_role(p_room) is distinct from 'operator' then raise exception 'operator_required' using errcode='42501'; end if;
 select * into room from public.sw_rooms where id=p_room for update;
 if room.controller_user is distinct from auth.uid() or room.controller_client is distinct from p_client or room.lease_until<clock_timestamp() then raise exception 'control_lease_required' using errcode='42501'; end if;
 if p_expected is null or p_expected<0 then raise exception 'invalid_revision'; end if;
 if jsonb_typeof(p_packet->'value') is distinct from 'number' or jsonb_typeof(p_packet->'unknown') is distinct from 'boolean'
 or (p_packet->>'level') is null or (p_packet->>'level') not in ('0','1','2') or length(coalesce(p_packet->>'reason',''))>2000 or length(coalesce(p_packet->>'action',''))>1000 then raise exception 'invalid_packet'; end if;
 v:=(p_packet->>'value')::numeric;
 select a,b into lo,hi from (values ('water',0,60),('ice',-12,10),('lightning',0,3),('wind',0,35),('heat',20,45),('forest',0,100),('landslide',0,20),('debris',0,100)) t(id,a,b) where id=p_risk;
 if lo is null or v<lo or v>hi or (p_risk='lightning' and v<>trunc(v)) then raise exception 'out_of_range'; end if;
 -- Serialize against sample ingestion on the same room, so a late monitor heartbeat cannot overwrite a fresh sensor sample.
 select * into old from public.sw_risks where room_id=p_room and risk_id=p_risk for update;
 if p_risk='water' and old.packet->>'source'='虚拟监测盒 WATER-01' and old.updated_at>clock_timestamp()-interval '10 seconds' then raise exception 'fresh_sensor_owns_water' using errcode='40001'; end if;
 update public.sw_rooms set lease_until=clock_timestamp()+interval '15 seconds' where id=p_room;
 return sw_private.store_packet(p_room,p_risk,jsonb_build_object('value',v,'level',(p_packet->>'level')::int,'unknown',(p_packet->>'unknown')::boolean,'reason',coalesce(p_packet->>'reason',''),'action',coalesce(p_packet->>'action',''),'source','云端监测模拟'),p_expected);
end $$;

create function public.sw_submit_water(p_room uuid,p_nonce uuid,p_value double precision,p_quality text)
 returns public.sw_risks language plpgsql security definer set search_path='' as $$
declare lev int; r public.sw_risks;
begin
 if coalesce(sw_private.member_role(p_room),'') not in ('operator','sensor') then raise exception 'sensor_role_required' using errcode='42501'; end if;
 if p_value is null or p_value<0 or p_value>60 or p_value::text in ('NaN','Infinity','-Infinity') or p_quality is null or p_quality not in ('valid','missing') then raise exception 'invalid_sample'; end if;
 perform 1 from public.sw_rooms where id=p_room for update;
 insert into public.sw_samples(room_id,nonce,actor,value,quality) values(p_room,p_nonce,auth.uid(),p_value,p_quality) on conflict do nothing;
 if not found then select * into r from public.sw_risks where room_id=p_room and risk_id='water';return r;end if;
 lev:=case when p_quality='missing' then 0 when p_value>=30 then 2 when p_value>=15 then 1 else 0 end;
 -- Canonical demonstration thresholds, not field-calibrated warning criteria.
 return sw_private.store_packet(p_room,'water',jsonb_build_object('value',p_value,'level',lev,'unknown',p_quality='missing','reason','虚拟水位：关注15cm / 高风险30cm；固定演示阈值，未经现场标定','action',case when p_quality='missing' then '核查数据来源与现场。' else '核查道路积水，准备入口警示。' end,'source','虚拟监测盒 WATER-01'));
end $$;

create function public.sw_acknowledge(p_room uuid,p_risk text,p_event uuid)
 returns public.sw_acknowledgements language plpgsql security definer set search_path='' as $$
declare r public.sw_risks; a public.sw_acknowledgements;
begin
 if coalesce(sw_private.member_role(p_room),'') not in ('operator','responder') then raise exception 'responder_required' using errcode='42501'; end if;
 select * into r from public.sw_risks where room_id=p_room and risk_id=p_risk for update;
 if r.packet->>'eventId' is distinct from p_event::text then raise exception 'event_changed' using errcode='40001'; end if;
 insert into public.sw_acknowledgements(room_id,event_id,risk_id,actor) values(p_room,p_event,p_risk,auth.uid()) on conflict do nothing;
 select * into a from public.sw_acknowledgements where room_id=p_room and event_id=p_event and actor=auth.uid();
 return a;
end $$;
revoke all on function public.sw_claim_control(uuid,uuid),public.sw_put_risk(uuid,uuid,text,bigint,jsonb),public.sw_submit_water(uuid,uuid,double precision,text),public.sw_acknowledge(uuid,text,uuid) from public,anon;
grant execute on function public.sw_claim_control(uuid,uuid),public.sw_put_risk(uuid,uuid,text,bigint,jsonb),public.sw_submit_water(uuid,uuid,double precision,text),public.sw_acknowledge(uuid,text,uuid) to authenticated;
-- Realtime is an accelerator; the client also refreshes snapshots after reconnection.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.sw_risks,public.sw_acknowledgements;
 end if;
end $$;
commit;
