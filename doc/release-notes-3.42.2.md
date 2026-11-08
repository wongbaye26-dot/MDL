# EmoMusic v3.42.2 发布说明

发布日期：2026-11-09

## 变更

### 玻璃模糊性能优化（自研 `GlassBlurView`）

- 之前：每帧都在 `RenderNode` 上跑 `RenderEffect` 做 GPU 模糊，RenderThread 每帧重复计算。
- 现在：只在本帧**快照更新时**做一次软件 box blur（3 次迭代近似高斯）并把结果缓存为 Bitmap；
  每帧只做一次普通 `drawBitmap` 贴图。同时保留 RenderNode/快照缓存与自适应限帧：
  - 滚动/动画刚发生：50ms 更新一次；
  - 静止：260ms 更新一次；
  - 快照缩放 0.3。
- 附带收益：不再依赖 API 31+ 的 RenderEffect，**低版本 Android 也能显示模糊**（此前 <31 退化为纯色）。

### 实测（SM-S938B / Android 17，本地 FLAC 播放 + 胶囊转盘动画）

| 指标 | v3.42.1 | v3.42.2 |
|---|---|---|
| RenderThread CPU | ~50% | **~28.5%** |
| 进程 CPU | ~65% | **~46%** |
| Janky frames | — | **0.28%**（50th 8ms / 90th 9ms） |

## 版本

- versionName `3.42.2`，versionCode `334`（arm64 包 `334003`）
- 构建链与 v3.42.0/3.42.1 一致（RN 0.80.3 新架构 / RNN 8.6.2）

## 产物

- `EmoMusic-v3.42.2-arm64-v8a.apk`
- `EmoMusic-v3.42.2-armeabi-v7a.apk`
- `EmoMusic-v3.42.2-universal.apk`
- SHA256 见 `dist/SHA256SUMS-v3.42.2.txt`
