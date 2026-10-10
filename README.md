# 山川守望 都江堰监测模拟

[在线体验](https://yun999-ccc.github.io/dujiangyan-risk-monitor/) · [源码仓库](https://github.com/yun999-ccc/dujiangyan-risk-monitor)

![三维沙盘与监测面板](assets/preview.png)

仅实现第一站：监测模拟页。三维沙盘、俯视指挥地图与八类风险参数均可操作。管理指挥页、现场警示页和跨设备共享后端留待后续。

## 运行

```sh
npm install
npm run dev
npm test
npm run build
```

## 数据真实性

- 高程：Mapzen Terrain Tiles / AWS Open Data，Terrarium，129×129重采样；展示范围103.46—103.73E、30.94—31.17N。垂直夸张1.8倍，非工程测量。
- 水系、道路、建筑、部分用地轮廓：OpenStreetMap API 0.6，2026-10-10取得；仅覆盖两个矩形查询片区，可能不完整。
- 建筑：420条公开轮廓，缺少高度时假定12米。没有真实立面或屋顶数据。
- 黄央沟沟口：按2014年《都江堰市龙池镇黄央沟泥石流特征与防治工程效果分析》的文献坐标定位；坐标基准未注明，定位不能视为测绘级准确。只代表历史案例沟口，不是当前危险范围。
- 其余节点：示意布置。全部读数、阈值与风险状态均为模拟，不是实时预警。
- 预设情景与自动推进用于交互展示，不是经校准的灾害模型。不能推断安全通行或真实灾害概率。
- 道路与河道显示宽度为示意；地形色带按高程，不代表真实植被分类。

## 开源数据许可

OpenStreetMap contributors，ODbL： https://www.openstreetmap.org/copyright
Mapzen Terrain Tiles： https://registry.opendata.aws/terrain-tiles/
论文： https://xbdz.net.cn/cn/article/pdf/preview/20140323.pdf

## 后续联动接口

`src/model.js`中的状态、点位ID和事件可复用。当前数据仅保存于本浏览器；后续应由共享后端处理状态转换、版本和权限，再通过实时连接推送给三个客户端。当前版本没有跨设备同步。

## 使用技能

主技能：cesartevisual/threejs-skills 中的 threejs-web、threejs-spatial-data、threejs-interaction、threejs-testing。
排版补充：anthropics/skills 中的 frontend-design。
技能仅作为开发指导；运行本项目不需要安装技能。

## GitHub Pages

推送 main 后，GitHub Actions 安装依赖、执行逻辑测试、构建并部署 dist。构建资源和数据请求使用相对路径，兼容仓库子目录。

## 浏览器测试

```sh
npx playwright install chromium
npm run dev
# 另开终端
npm run test:browser
```

若使用本机 Chrome，可通过 CHROME_PATH 环境变量指定可执行文件。模拟窄屏检查不能代替真实手机GPU测试。

## 项目结构

```text
src/            界面、三维模型与模拟状态
public/data/    已打包的公开高程和地图矢量
tests/          状态与浏览器测试
scripts/        数据处理与截图辅助
assets/         真实运行截图
```

## 网络依赖与权利说明

核心地形和矢量文件随网站发布，无需地图密钥；字体尝试通过Google Fonts加载，失败时使用系统中文字体。案例来源链接需要网络。

源码暂未授予额外开源许可；公开展示不等于授予任意复用权限。OpenStreetMap衍生数据保留ODbL义务；其他依赖按各自许可证使用。本项目不是政府或景区官方预警系统。
