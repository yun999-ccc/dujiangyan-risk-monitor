# 生成素材与使用说明

工具：Codex内置 image_gen。新图生成，无参考图编辑、无CLI或外部Runway生成。工具未公开模型版本，不标称image2.5。

| 文件 | 真实尺寸 | 使用 |
|---|---|---|
| flame-v1.png | 1254×1254 | 透明火焰材质；UV形变与尺寸随时间变化 |
| smoke-v1.png | 1300×1209 | 透明烟雾粒子；位置、尺寸和透明度随时间变化 |
| mud-v1.png | 1254×1254 | 棕色浆体材质；UV随假定流速移动 |
| soil-v1.png | 1254×1254 | 干土、源区与滑移土体材质 |

PNG原图保留。火焰1122206个全透明像素、450296个部分透明像素；烟雾688338个全透明像素、883362个部分透明像素；两张图片角点alpha均为0。图像没有内嵌道路、建筑、河道或灾害发生区域，场景关系由几何处理。

## 提示词

### flame-v1

Use case: stylized-concept. Asset type: single reusable flame particle sprite for a Three.js emergency sandtable, not an illustration of a scene. One isolated upright flame plume, fully transparent background with true alpha, centered in a square canvas with generous transparent padding on all sides. Compact warm yellow core, orange flame tongues, subtle red outer tips, layered curling tongues of fire with refined soft edges and low-poly sandtable compatible stylized realism. Light, readable, crisp at small sizes. Orthographic frontal view. No smoke, no terrain, no building, no objects, no text, no border, no checkerboard painted into the image. Uniform warm light, no dramatic halo or opaque black background. Flame shape should taper gracefully upward, widest at bottom third, suitable to animate by UV deformation and particle scale rather than a baked disaster scene.

### smoke-v1

Use case: stylized-concept. Asset type: a single reusable soft smoke puff particle texture for a Three.js forest-fire sandtable. One isolated irregular gray smoke cloud puff centered, viewed orthographically, clean neutral medium gray with subtly modeled rolling wisps, readable at small sizes, soft translucent feathered edges fading to true transparent alpha. No opaque background, no fire, no terrain, no sky, no trees, no text, no checkerboard painted into image. Generous transparent margin all around. Not a full plume: compact roughly round puff that can be emitted and scaled in 3D to construct an upward plume. Slight sandtable stylized realism, nondramatic light, no baked directional shadows.

### mud-v1

Use case: stylized-concept. Asset type: seamless repeating diffuse texture for a 3D mud/debris flow surface, square. Orthographic perfectly top-down close view of muddy brown flowing slurry with fine grit, scattered small gravel, subtle elongated ripple streaks roughly bottom to top. Medium chocolate brown and ochre, low contrast, natural fine granular detail, refined stylized sandtable realism. Even diffuse lighting, no cast shadows, no horizon, no riverbank, no roads, no scenery, no text, no borders, no black background. Tileable all edges seamlessly. No giant boulders, no white foam. Used on real 3D terrain-following geometry, so avoid any baked perspective or depth. Flow texture will scroll in UVs at runtime.

### soil-v1

Use case: stylized-concept. Asset type: seamless repeating diffuse albedo texture for a 3D landslide soil block in a geographic sandtable. Orthographic flat top-down square field of dry exposed earth, warm muted ochre and taupe with subtle granular clay, fine cracks and occasional small angular gray tan stones. Refined natural detail but compatible with a stylized low-poly sandtable. Neutral uniform diffuse light, low contrast with no baked shadows. Tile seamlessly on all four edges. No horizon, no perspective, no scene, no vegetation, no text, no roads, no mountains, no borders, no stripe diagrams, no large recognizable rocks. Clearly dry compact earth unlike wet brown slurry. This will be mapped onto a moving mesh and a stationary exposed source scar.
