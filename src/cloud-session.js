// No SDK/network is used until the user explicitly connects a configured project.
export const cloudAuthPrefix='shanchuan-auth-';
export const cloudConfigKey='shanchuan-cloud-v1';
export const riskIds=['water','ice','lightning','wind','heat','forest','landslide','debris'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateCloudConfig(c){
 let u;try{u=new URL(c.url)}catch{throw Error('请输入有效项目地址')}
 if(u.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/.test(u.hostname)||u.username||u.password||u.port||!['','/'].includes(u.pathname)||u.search||u.hash)throw Error('项目地址应为 https://项目编号.supabase.co');
 if(!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(c.key??''))throw Error('仅接受 Publishable Key，不能填写管理员密钥');
 if(!uuid.test(c.room??''))throw Error('场景编号应为数据库创建的 UUID');
 return {url:u.origin,key:c.key,room:c.room.toLowerCase(),email:String(c.email??'').trim()};
}
export class CloudSession {
 constructor({factory,notify=()=>{},now=()=>Date.now(),clientId=globalThis.crypto.randomUUID()}={}){this.factory=factory;this.notify=notify;this.now=now;this.clientId=clientId;this.enabled=false;this.online=false;this.connected=false;this.controlling=false;this.role=null;this.status='本机联调';this.cache=new Map();this.acks=[];this.generation=0;this.writes=new Set();}
 changed(){this.notify(this)}
 async connect(config,password){
  const c=validateCloudConfig(config);await this.disconnect();this.enabled=true;this.config=c;const g=this.generation;this.status='正在连接云项目';this.changed();
  try{
   const client=await this.factory(c.url,c.key);if(g!==this.generation)return;this.client=client;
   let auth=password?await client.auth.signInWithPassword({email:c.email,password}):await client.auth.getSession();if(auth.error)throw auth.error;
   const user=auth.data?.user??auth.data?.session?.user;if(!user)throw Error('请输入已分配场景权限的账号和密码');this.user=user.id;
   const member=await client.from('sw_members').select('role').eq('room_id',c.room).eq('user_id',user.id).single();if(member.error||!member.data)throw Error('此账号没有该场景的权限');if(g!==this.generation)return;this.role=member.data.role;
   this.channel=client.channel(`sw:${c.room}:${this.clientId}`).on('postgres_changes',{event:'*',schema:'public',table:'sw_risks',filter:`room_id=eq.${c.room}`},()=>this.pull()).on('postgres_changes',{event:'*',schema:'public',table:'sw_acknowledgements',filter:`room_id=eq.${c.room}`},()=>this.pull()).subscribe(status=>{if(g!==this.generation)return;this.connected=status==='SUBSCRIBED';if(this.online){this.status=this.connected?'云端实时连接':'云端轮询接收';this.changed()}if(this.connected)this.pull()});
   this.timer=setInterval(()=>{if(g===this.generation)this.pull()},5000);await this.pull();
  }catch(e){if(g===this.generation){this.online=false;this.status='云连接失败：'+this.describeError(e);this.changed();}throw e;}
 }
 describeError(e){const m=String(e?.message??e);if(/Invalid login credentials/i.test(m))return '账号或密码不正确';if(/Failed to fetch|NetworkError/i.test(m))return '网络不可用，请检查项目地址和连接';return m.slice(0,160);}
 async pull(){
  if(!this.client||this.pulling)return;this.pulling=true;const g=this.generation;
  try{const [risks,acks]=await Promise.all([this.client.from('sw_risks').select('*').eq('room_id',this.config.room),this.client.from('sw_acknowledgements').select('*').eq('room_id',this.config.room).order('created_at',{ascending:false}).limit(80)]);if(g!==this.generation)return;if(risks.error||acks.error)throw risks.error??acks.error;
   // Fetch success, rather than socket state alone, establishes readable connectivity.
   for(const r of risks.data??[])this.accept(r);this.acks=(acks.data??[]).map(a=>({id:a.risk_id,eventId:a.event_id,actor:a.actor,at:Date.parse(a.created_at)}));this.online=true;this.status=this.connected?'云端实时连接':'云端轮询接收';this.changed();
  }catch(e){if(g===this.generation){this.online=false;this.controlling=false;this.status='云连接中断 · 未发送的操作不会重放';this.changed()}}finally{if(g===this.generation)this.pulling=false;}
 }
 accept(r){if(!riskIds.includes(r?.risk_id)||!Number.isSafeInteger(r.revision)||r.revision<=0||!r.packet||!Number.isFinite(r.packet.value)||!Number.isFinite(r.packet.at)||![0,1,2].includes(r.packet.level)||typeof r.packet.unknown!=='boolean'||!uuid.test(r.packet.eventId??''))return false;const old=this.cache.get(r.risk_id);if(old&&r.revision<=old.revision)return false;this.cache.set(r.risk_id,structuredClone(r));return true;}
 read(id){const r=this.cache.get(id);return r?{...r.packet,...(!this.online?{connectionLost:true}:{})}:null;}
 async call(name,args){if(!this.enabled||!this.online||!this.client)throw Error('云端未连接，未提交操作');const client=this.client,g=this.generation;const r=await client.rpc(name,{p_room:this.config.room,...args});if(g!==this.generation)throw Error('连接已变更，未应用旧响应');if(r.error){if(r.error.code==='42501')this.controlling=false;throw Error(this.describeError(r.error))}return Array.isArray(r.data)&&r.data.length===1?r.data[0]:r.data;}
 async claim(){if(this.role!=='operator')throw Error('只有控制账号可以共享状态');const ok=await this.call('sw_claim_control',{p_client:this.clientId});this.controlling=ok===true;this.changed();if(!ok)throw Error('另一台设备正在控制，请先停止共享或等待15秒租约到期');return true;}
 stopSharing(){this.controlling=false;this.changed()}
 async submitSample(m){if(!['sensor','operator'].includes(this.role))throw Error('当前账号没有上报权限');const r=await this.call('sw_submit_water',{p_nonce:m.nonce,p_value:m.value,p_quality:m.quality});if(this.accept(r))this.changed();return r;}
 async acknowledge(m){if(!['operator','responder'].includes(this.role))throw Error('当前账号只有查看权限，不能确认');const a=await this.call('sw_acknowledge',{p_risk:m.id,p_event:m.eventId});await this.pull();return a;}
 async publish(id,packet){
  if(!this.controlling||!this.online||this.role!=='operator'||this.writes.has(id)||packet.source==='虚拟监测盒 WATER-01')return;
  const old=this.cache.get(id),g=this.generation;
  if(id==='water'&&old?.packet.source==='虚拟监测盒 WATER-01')return;
  if(old&&['value','level','unknown','reason','action'].every(k=>old.packet[k]===packet[k])&&this.now()-old.packet.at<4000)return;
  this.writes.add(id);
  try{const r=await this.call('sw_put_risk',{p_client:this.clientId,p_risk:id,p_expected:old?.revision??0,p_packet:packet});if(g===this.generation&&this.accept(r))this.changed();}
  catch(e){if(g===this.generation){if(/revision_conflict|fresh_sensor_owns_water/.test(e.message)){await this.pull();this.controlling=false;this.status='共享已暂停：云端状态已变化，请核对后重新取得控制权';}else{this.controlling=false;this.status='共享已暂停：'+e.message;}this.changed()}}
  finally{if(g===this.generation)this.writes.delete(id)}
 }
 async disconnect(){this.generation++;clearInterval(this.timer);this.enabled=false;this.online=false;this.connected=false;this.controlling=false;this.pulling=false;this.role=null;this.cache.clear();this.acks=[];this.writes.clear();const c=this.client,ch=this.channel;this.client=null;this.channel=null;this.status='本机联调';if(c&&ch)await c.removeChannel(ch);c?.auth?.stopAutoRefresh?.();this.changed();}
}
export const cloud=new CloudSession({factory:async(url,key)=>{const {createClient}=await import('@supabase/supabase-js');return createClient(url,key,{auth:{storageKey:cloudAuthPrefix+new URL(url).hostname,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})},notify:()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('shanchuan-cloud'))}});
