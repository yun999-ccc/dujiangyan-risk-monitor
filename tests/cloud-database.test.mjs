import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const room='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const ids={operator:'20000000-0000-4000-8000-000000000001',sensor:'20000000-0000-4000-8000-000000000002',responder:'20000000-0000-4000-8000-000000000003',viewer:'20000000-0000-4000-8000-000000000004',outsider:'20000000-0000-4000-8000-000000000005'};
const client='30000000-0000-4000-8000-000000000001',client2='30000000-0000-4000-8000-000000000002';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
await db.exec(await readFile(new URL('../supabase/migrations/202610160001_shared_monitor.sql',import.meta.url),'utf8'));
await db.query('insert into sw_rooms(id,name) values ($1,$2),($3,$4)',[room,'本轮演示',other,'另一个团队']);
for(const [role,id] of Object.entries(ids)){await db.query('insert into auth.users values ($1)',[id]);if(role!=='outsider')await db.query('insert into sw_members values ($1,$2,$3)',[room,id,role]);}
const as=async role=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[role]??'']);await db.exec(`set role ${role==='anon'?'anon':'authenticated'}`)};
const packet={value:18,level:1,unknown:false,reason:'test',action:'核查'};
test('真实PostgreSQL权限：未登录、旁观者和其他团队不能越权写入或读取',async()=>{
 await as('anon');await assert.rejects(db.query('select * from sw_risks'),/permission denied/);
 await as('viewer');await assert.rejects(db.query('select sw_submit_water($1,$2,35,\'valid\')',[room,crypto.randomUUID()]),/sensor_role_required/);await assert.rejects(db.query('insert into sw_members values ($1,$2,\'operator\')',[other,ids.viewer]),/permission denied/);
 await as('outsider');assert.equal((await db.query('select * from sw_rooms')).rows.length,0);await assert.rejects(db.query('select sw_claim_control($1,$2)',[room,client]),/operator_required/);
});
test('上报由服务端判断、随机nonce去重，异常输入拒绝，提醒ID按状态转换更新',async()=>{
 await as('sensor');const nonce=crypto.randomUUID();await db.query('select sw_submit_water($1,$2,35,\'valid\')',[room,nonce]);let r=(await db.query('select * from sw_risks')).rows[0];assert.equal(r.packet.level,2);assert.equal(r.revision,1);const event=r.packet.eventId;await db.query('select sw_submit_water($1,$2,8,\'valid\')',[room,nonce]);r=(await db.query('select * from sw_risks')).rows[0];assert.equal(r.revision,1);assert.equal(r.packet.value,35);
 await db.query('select sw_submit_water($1,$2,36,\'valid\')',[room,crypto.randomUUID()]);assert.equal((await db.query('select * from sw_risks')).rows[0].packet.eventId,event);
 await db.query('select sw_submit_water($1,$2,36,\'missing\')',[room,crypto.randomUUID()]);r=(await db.query('select * from sw_risks')).rows[0];assert.equal(r.packet.unknown,true);assert.equal(r.packet.lastKnownLevel,2);assert.notEqual(r.packet.eventId,event);
 await assert.rejects(db.query('select sw_submit_water($1,$2,99,\'valid\')',[room,crypto.randomUUID()]),/invalid_sample/);
});
test('单控制端租约、修订号冲突和终端确认不解除状态',async()=>{
 await as('operator');assert.equal((await db.query('select sw_claim_control($1,$2) as ok',[room,client])).rows[0].ok,true);assert.equal((await db.query('select sw_claim_control($1,$2) as ok',[room,client2])).rows[0].ok,false);
 await db.query('select sw_put_risk($1,$2,\'wind\',0,$3)',[room,client,JSON.stringify({...packet,value:25,level:2})]);
 await assert.rejects(db.query('select sw_put_risk($1,$2,\'wind\',0,$3)',[room,client,JSON.stringify(packet)]),/revision_conflict/);
 await assert.rejects(db.query('select sw_put_risk($1,$2,\'heat\',0,$3)',[room,client2,JSON.stringify(packet)]),/control_lease_required/);
 await assert.rejects(db.query('select sw_put_risk($1,$2,\'water\',3,$3)',[room,client,JSON.stringify(packet)]),/fresh_sensor_owns_water/);
 const before=(await db.query("select * from sw_risks where risk_id='wind'")).rows[0];await as('responder');await db.query('select sw_acknowledge($1,\'wind\',$2)',[room,before.packet.eventId]);await db.query('select sw_acknowledge($1,\'wind\',$2)',[room,before.packet.eventId]);assert.equal((await db.query('select * from sw_acknowledgements')).rows.length,1);assert.equal((await db.query("select * from sw_risks where risk_id='wind'")).rows[0].revision,before.revision);
 await assert.rejects(db.query('select sw_acknowledge($1,\'wind\',$2)',[room,crypto.randomUUID()]),/event_changed/);await as('viewer');await assert.rejects(db.query('select sw_acknowledge($1,\'wind\',$2)',[room,before.packet.eventId]),/responder_required/);
});
test.after(()=>db.close());
