# EmoMusic v3.50.0 发布说明（新架构正式版）

发布日期：2026-11-09

## 一句话

从 RN 0.76 旧架构正式迁移到 **RN 0.80.3 + 新架构（Fabric / Bridgeless / TurboModule）**，
RNN 升级到 **8.6.2**，自研 `GlassBlurView` 替代 community blur，并完成一轮性能优化。

## 版本矩阵

| 项目 | 上一个大版本（v3.41.0） | v3.50.0 |
|---|---|---|
| React Native | 0.76.9（旧架构） | **0.80.3（新架构强制）** |
| React | 18.3.1 | **19.1.0** |
| react-native-navigation | 8.0.0 | **8.6.2** |
| react-native-svg | 15.12.1 | 15.12.1（interop） |
| Gradle / Kotlin / NDK | 8.10.2 / 1.9.25 / 26.1 | **8.14.1 / 2.1.20 / 27.1** |
| compileSdk / targetSdk / minSdk | 36 / 36 / 24 | 36 / 36 / 24 |
| Hermes | 是 | 是 |
| 16KB 对齐 | 部分 | **全部 arm64 so 对齐** |

## 主要变化

1. **新架构全量启用**：Fabric 渲染、Bridgeless 启动、TurboModule + Legacy Interop（8 个自研旧桥模块与全部第三方原生库继续可用）。
2. **RNN 8.6.2**：`MainApplication` 提供 `ReactHost`，CLI 约定式 autolink；`rn-link` 的 Android 步骤不再需要。
3. **自研 `GlassBlurView`**：preDraw 快照 + 自排除标记，避免递归；v3.42.2 起改为软件 box blur 缓存 +
   自适应限帧（滚动 50ms / 静止 260ms / 长时间空闲 2000ms），每帧只贴图。
   - 效果：RenderThread 从 ~50% 降到 ~28.5%，janky 0.28%；低版本 Android 也支持模糊。
4. **兼容与修复**：
   - track-player fork：bridgeless 下 headless task 走 `ReactHost`；MediaSession 状态同步；
   - track-player 深路径 import、React 19 JSX/useRef、Fabric fontSize 兜底、async-storage KSP、tsconfig customConditions；
   - 设置子页胶囊导航：任意 Tab 可正常切页，再点设置回设置首页；
   - 「首页上下滑动」文案改为「页面左右滑动」；
   - 本地曲库文件被外部删除后无法删除记录：真实路径回退 + 已删除判定 + 「仅从列表移除」兜底。
5. **性能：空闲动画节能（v3.42.3）**：
   - 首页装饰动效只在「首页前台 + App 前台 + 8s 内有交互」时运行，空闲停、触摸 1s 内恢复；
   - 暂停后胶囊进度环不再呼吸空转；
   - 实测：暂停 + 空闲 RenderThread **45% → 0%**，进程 CPU **~66% → ~0–4%**；
     播放 + 空闲仅剩胶囊圆盘自转（~25% RenderThread，属可见播放动画）。

## 已验证（release 包，SM-S938B / Android 17）

- Fabric/Bridgeless 启动，首页/播放页/歌词/进度/SVG/封面渲染正常。
- 本地 FLAC 播放、MediaSession=PLAYING、通知栏媒体卡（封面/标题/进度/5 个 action）与自定义按钮正常。
- 玻璃模糊：底部胶囊/搜索胶囊/页头可见真实模糊。
- 16 个 arm64 so 全部 `p_align=0x4000`。
- 无崩溃、无 `NoSuchMethodError`、无 `No task registered`。

## 已知限制

- API < 31 设备玻璃为软件模糊（可用，视觉一致；未单独在低版本真机验证）。
- 播放中胶囊圆盘自转仍持续 60fps（~25% RenderThread），如需要可再做「播放中长时间无操作暂停自转」。
- 新架构首次大版本，建议继续按 `doc/qa-3.41.0-rn076.md` 跑一遍剩余真机回归项。

## 产物

- `EmoMusic-v3.50.0-arm64-v8a.apk`（覆盖升级）
- `EmoMusic-v3.50.0-armeabi-v7a.apk`
- `EmoMusic-v3.50.0-universal.apk`
- SHA256 见 `dist/SHA256SUMS-v3.50.0.txt`
