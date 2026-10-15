# 森林火情第二版素材

工具：Codex 内置 image_gen；新图生成，透明背景，未使用CLI。工具未公开模型版本，不能标称为image2.5。

| 文件 | 尺寸 | 全透明像素 | 部分透明像素 | 用途 |
| --- | --- | --- | --- | --- |
| flame-v2.png | 1254×1254 | 920401 | 652115 | 地表火焰簇；UV变形、尺寸随同一演示时钟变化 |
| smoke-v2.png | 1254×1254 | 811546 | 760970 | 烟团粒子；上升、扩张与风向漂移 |

原PNG及透明度保留，旧版图片保留；生产导入已切换为v2。

## 火焰完整提示词

> Use case: scientific-educational. Asset type: one transparent VFX sprite for a Three.js forest surface-fire demonstration. An isolated small cluster of natural ground-level flame tongues, several irregular narrow orange and amber flames with pale yellow cores, upward curling turbulent fine filaments and glowing embers at the bottom. Side view, no perspective ground, detailed translucent wispy edges. Compact flame cluster in the middle 75 percent of a square canvas with generous transparent margins on every edge. Actual alpha transparent background. No smoke, no tree, no terrain, no people, no buildings, no text, no border, no checkerboard, no black rectangular background. Not an explosion or enormous fireball. Useful reusable animation texture, warm but restrained brightness and crisp filament detail.

## 烟雾完整提示词

> Use case: scientific-educational. Asset type: one transparent smoke VFX sprite for an animated forest fire scene in Three.js. An isolated organically irregular puff of woodland fire smoke, softly turbulent overlapping billows, charcoal gray inner wisps with medium cool gray translucent outer filaments, fine density detail with visible gaps. No flame and no ground. Square canvas, smoke centered inside central 75 percent, outermost 12 percent completely transparent on every edge. Real alpha background, compositable over pale green terrain and dark trees. Moderately transparent density, no solid opaque disk, no sharp crop. Neutral lighting, realistic smoke texture rather than cartoon. No tree, landscape, buildings, text, border, checkerboard or black rectangular backdrop.

图片不包含林地、建筑或真实火灾位置。示意树木与贴地残迹由场景几何表达，火焰、烟雾由实时变量与播放时钟驱动。素材不是一张静态火灾地图，不提供实测火势、火线传播或燃烧参数。
