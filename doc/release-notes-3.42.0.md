# EmoMusic v3.42.0 发布说明（React Native 新架构）

发布日期：2026-11-09

## 一句话

从 RN 0.76 旧架构（Bridge）升级到 **RN 0.80.3 + 新架构（Fabric / Bridgeless / TurboModule）**，
react-native-navigation 升级到 **8.6.2**，并用自研 `GlassBlurView` 替代了与新架构冲突的
`@react-native-community/blur`，磨砂玻璃效果回归。

## 版本矩阵

| 项目 | v3.41.0（旧） | v3.42.0（新） |
|---|---|---|
| React Native | 0.76.9（旧架构） | **0.80.3（新架构，强制）** |
| React | 18.3.1 | **19.1.0** |
| react-native-navigation | 8.0.0 | **8.6.2** |
| react-native-svg | 15.12.1 | 15.12.1（不变，interop） |
| Gradle / AGP | 8.10.2 / RNGP | **8.14.1 / RNGP** |
| Kotlin | 1.9.25 | **2.1.20** |
| NDK | 26.1.10909125 | **27.1.12297006** |
| compileSdk / targetSdk / minSdk | 36 / 36 / 24 | 36 / 36 / 24 |
| Hermes | 是 | 是 |
| 16KB 对齐 | 部分 | **全部 arm64 so 对齐** |

## 主要变化

1. **新架构全量启用**：Fabric 渲染、Bridgeless 启动、TurboModule + Legacy Interop（8 个自研旧桥模块与所有第三方原生库继续可用）。
2. **RNN 8.6.2**：`NavigationApplication` 内建新架构入口；`MainApplication` 改为提供 `ReactHost`；autolink 走 CLI 约定（`new NavigationPackage()`），不再需要 `rnn-link`。
3. **自研 `GlassBlurView`**：在 preDraw 抓窗口快照并用 `RenderEffect` 做硬件高斯模糊，跳过所有玻璃层避免自模糊；替代 community blur，页面布局零改动；API<31 退化为纯色。
4. **兼容修复**：
   - track-player fork：bridgeless 下 headless task 改走 `ReactHost`；`updatePlayback` 同步 MediaSession 状态；
   - track-player 深路径 `react-native/Libraries/Image/resolveAssetSource` 改为公开 `Image.resolveAssetSource`；
   - React 19：`JSX` 命名空间、`useRef` 初值、SVG key-spread 告警；
   - Fabric 严格校验：`fontSize<=0` 统一兜底；
   - async-storage：`AsyncStorage_next_kspVersion=2.1.20-1.0.32`；
   - tsconfig 关闭 `customConditions:["react-native"]`（避免把库源码当类型源）。
5. **16KB**：quickjs `wrapper-android` 2.4.0 → **3.2.3**，release APK 全部 16 个 arm64 so `p_align=0x4000`。
6. **Bug fix**：物理文件已被外部删除的本地歌曲无法删除记录（真实路径回退 + 已删除判定 + 「仅从列表移除」兜底）。

## 已验证（release 包，真机 SM-S938B / Android 17）

- 启动：Bridgeless + Fabric 生效，`Running "lxm.HomeScreen" ... "fabric":true`。
- 首页 / 播放页 / 歌词 / 进度 / 封面 / SVG 图标渲染正常；本地 FLAC 播放正常。
- MediaSession `PLAYING`、通知栏媒体卡（封面/标题/进度/5 action）正常；通知栏收藏/循环按钮可用。
- 本地音乐滚动时底部玻璃导航条、首页搜索胶囊、榜单页头可见真实模糊。
- 无崩溃、无 `NoSuchMethodError`、无 `No task registered`。

## 已知限制

- API < 31 的设备上玻璃层退化为纯色（RenderEffect 不可用）。
- Blur 走窗口快照，玻璃层不在 RN Modal（独立 window）里生效；已有用法均不在 Modal 内。
- 新架构属于大版本迁移，建议首次安装前确认已开启「所有文件访问」权限以保持下载/删除行为一致。

## 产物与校验

- `EmoMusic-v3.42.0-arm64-v8a.apk`（覆盖升级）
- `EmoMusic-v3.42.0-armeabi-v7a.apk`（覆盖升级）
- `EmoMusic-v3.42.0-universal.apk`（全新安装）
- SHA256 见同目录 `SHA256SUMS-v3.42.0.txt`（构建后生成）。
