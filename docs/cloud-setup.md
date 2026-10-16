# 跨设备读数接入 Supabase

本阶段提供接入代码、数据库迁移和本地检查。仓库没有预置真实云项目，也没有云管理员凭据。未配置项目时默认仍是同浏览器本机联调，不能称为已跨设备验收。

## 本阶段同步什么

- 虚拟监测盒的0–60cm模拟水位、质量、采集记录；云端使用固定15/30cm演示阈值。
- 控制账号主动取得控制权后，发布八类风险当前值、演示等级与判断依据。
- 终端查看云端状态、确认已阅，确认记录持久保存并供其他页面读取。
- 监测页单独显示“云端共享读数”，与本机三维动画输入分开。

**本阶段不共享**动画开始时间/暂停/拖动、情景轨迹基线、河谷水动力参数/计算结果或相机位置。另一设备打开场景后不会自动复现控制端动画。下一阶段应使用独立的版本化过程契约，不能靠同步风险颜色冒充。所有读数仍为模拟，不是实体传感器。

## 1 创建你自己的项目

1. 在 https://supabase.com/dashboard 创建账号与一个专用测试项目，保管数据库密码，不发送到聊天或放入仓库。
2. 项目创建后，从连接/API设置取得项目URL和 **Publishable Key（sb_publishable_开头）**。
3. 免费方案可用于评估，额度和暂停规则以官方控制台为准。先用校园网和手机流量测试连接，再决定是否用于答辩。

网页只接受标准 `https://项目编号.supabase.co` 地址和Publishable Key。目前不支持自定义域名、旧anon JWT密钥、第三方代理。不要填Secret Key、service_role或数据库密码。

## 2 执行数据库迁移

打开 Supabase SQL Editor，复制并运行一次：

`supabase/migrations/202610160001_shared_monitor.sql`

在专用新项目执行，避免与其他业务共用表。迁移放在事务中；不要忽略错误后继续粘贴局部语句。它创建 sw_rooms、sw_members、sw_risks、sw_samples、sw_acknowledgements；启用RLS，只允许场景成员读数据，普通浏览器账号没有直接写表权限，写操作必须经过角色检查的函数。

若项目已经有 `supabase_realtime` publication，迁移自动加入风险与确认表。若不存在，需在控制台启用这两张表的Realtime；客户端仍有每5秒快照刷新作为补偿，但轮询不是2秒实时保证。

## 3 建立账号与演示场景

在 Authentication → Users 建立或邀请测试账号，完成邮箱确认。建议至少三个不同账号：

| 角色 | 用途 | 能力 |
|---|---|---|
| operator | 控制电脑 | 查看、取得控制权后发布八类状态，也可上报/确认 |
| sensor | 监测盒手机 | 上报模拟水位，不能控制其他风险或确认 |
| responder | 警示终端 | 查看与确认，不能改风险值 |
| viewer | 观看设备 | 只读 |

在SQL Editor创建场景：

```sql
insert into public.sw_rooms(name) values ('都江堰竞赛演示') returning id;
```

复制返回的场景UUID。再按实际账号邮箱填写以下模板，替换全部占位内容；**不要原样运行占位文本**：

```sql
insert into public.sw_members(room_id,user_id,role)
select '替换为场景UUID'::uuid,id,'operator'
from auth.users where email='替换为控制账号邮箱';

insert into public.sw_members(room_id,user_id,role)
select '替换为场景UUID'::uuid,id,'sensor'
from auth.users where email='替换为监测盒账号邮箱';

insert into public.sw_members(room_id,user_id,role)
select '替换为场景UUID'::uuid,id,'responder'
from auth.users where email='替换为终端账号邮箱';
```

检查每次实际插入1行。账号不存在时SELECT不会产生记录。场景和成员只能由你在控制台管理，用户不能自行加入或提升角色。

## 4 在网页连接

1. 每台设备打开对应网页，点击“跨设备连接 → 设置连接”。
2. 填同一个项目URL、同一个Publishable Key、同一个场景UUID，以及各自账号。
3. 密码直接在网页填写，通过HTTPS交给你指定的Supabase项目；代码不保存密码。SDK会保存本机登录会话，使用公用电脑后点击“清除连接与登录”。
4. 连接成功后，控制电脑须主动点击“取得控制权并共享读数”。未点击时，本地调值不会上传。
5. 监测盒用“上报一次”或2秒定时上报；终端接收并确认。监测盒账户不必先取得控制权。
6. 同一浏览器的标签页共享Supabase账号会话；不同角色请使用不同设备或不同浏览器配置文件/隐私窗口，避免互相切换账号。

设置保存在每台设备本地，配置不会自动传播到其他设备。只有你主动连接后才加载SDK并访问云服务。切回本机模式必须点“返回本机模式”，连接失败不会自动回退成成功。

## 5 冲突与掉线处理

- 控制权租约15秒，只允许一个控制端；共享写入续租。浏览器后台节流或断网可能使租约过期，需重新取得控制权。
- 修订号冲突暂停共享，先读新快照再人工核对，不自动重放旧操作覆盖别人。
- 云端水位由监测盒上报后，本轮监测页不再覆盖它；停止上报会在10秒后显示未知。要改用纯手动水位，请使用新的测试场景。
- 同一nonce重复上报不会生成第二条采集记录。网络超时可能是已写入但未收到响应，因此界面称“未收到确认”，不能据此断言云端没有执行。
- Realtime可用时推送更新；断线重连获取全量快照，每5秒刷新补偿漏事件。连接失败保留末次值并标未知，不自动认为正常。
- 采集时刻由数据库生成；各设备系统时间应准确。当前没有独立的时钟偏差校准，时钟偏差大可能显示未知。
- 已阅绑定提醒eventId；新的等级/未知状态变化产生新的提醒。确认不修改风险值、不解除风险，也不等于现场任务完成。
- 本轮不提供硬件离线告警、离线后台持续运行或短信通知。

## 6 实际项目必须做的验收

以下只有真实项目、不同设备才能验收，本地模拟接口通过不代表这些已完成：

- 手机流量上报35cm，校园网电脑和另一手机收到同一状态；记录实际延迟，正常网络目标2秒，轮询回退另记。
- 关闭监测电脑，监测盒与终端仍可上报、确认；重开电脑能看到保存的记录。
- 无权限账号读不到场景；viewer不能写；sensor不能确认；responder不能改值。
- 拔网/恢复、后台/前台、同时两个控制端、过期提醒确认、反复登录退出。
- 动画同步不在本轮通过项中，后续必须单独完成后再宣传。

## 7 用量与数据维护

采集与确认记录保存在云数据库。2秒上报会持续增长，不应无人使用时整天运行。测试后关闭定时上报；按项目需要制定保留期限，备份后由管理员删除历史数据。当前不包含自动清理计划或服务等级保证。

## 官方参考

- https://supabase.com/docs/guides/realtime/postgres-changes
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/platform/free-project-pausing
