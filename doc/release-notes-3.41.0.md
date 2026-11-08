# EmoMusic v3.41.0 发行说明（RN 0.76 升级：RNN 8 + SVG 15 + 原生库矩阵）

> 版本 **3.41.0** / versionCode **331**
> 这是**引擎升级版本**：功能与上一版（v3.40.0）一致，目标是换掉已停止维护的 RN 0.73 基线。

## 升级内容

- **React Native 0.73.11 → 0.76.9**（React 18.2.0 → 18.3.1，旧架构 + Hermes 保持不变）。
  - Android 构建链对齐 RN 0.76：Gradle 8.10.2、AGP 8.6.0（由 RN Gradle Plugin 提供）、Kotlin 1.9.25；
  - autolink 改用 RN 0.76 的 RNGP 方案，移除 Flipper 集成；
  - `minSdk 21 → 24`（RN 0.76 最低要求）。
- **react-native-navigation 7.39.2 → 8.0.0**：唯一支持 RN 0.76 旧架构的 8.x 版本；
  JS API 无破坏性变更，导航/Modal/Overlay/设置页 push 全部实测正常。
- **react-native-svg 14.2.0 → 15.12.1**：15.x 中最后一个支持 RN<0.78 的版本；
  图标/矢量元素渲染实测正常。
- **16 个其它原生库全部保持版本**（async-storage / blur / slider / clipboard / pager-view /
  vector-icons / sqlite-2 / quick-base64 / quick-md5 / 4 个 vendor fork 等），
  逐库核对 RN 0.76 兼容性并实测编译与主要运行时路径；矩阵见 `doc/rn-0.76-upgrade.md`。

## 行为与产物变化

- **APK 体积变大（arm64-v8a 18.4MB → 28.1MB）**，不是代码膨胀：
  - `minSdk` 升到 24 后 AGP 默认不再压缩 APK 内的 `.so`（`extractNativeLibs=false`，安装/启动更快）；
  - RN 0.76 默认把原生库合并成 `libreactnative.so`。
  - 解压后的原生库总量反而从 16.05MB 降到 14.92MB。
- 依赖安装方式固化：仓库根新增 `.npmrc`（`install-links=true`），把 `file:../vendor/*` 物化为真实目录；
  RN 0.76 的 Metro 不再跟随指向仓库外的软链，否则 release 打包会解析失败。
- `react-native-linear-gradient` 的 AGP8 namespace 补丁已并入 `dependencies-patch.js`（全新安装自动生效）。

## 验证

- `typecheck` 0 error / `lint` 0 error / `test:unit` 32/32 / `vendor:check` 13/13；
- `assembleDebug`、`assembleRelease`（含 R8）构建通过；
- 真机（SM-S938B / Android 17）release 包冒烟通过：冷启动、底部导航四页、排行榜/歌单广场、
  设置页 push、本地音乐（251 首 / 7.08GB，FLAC 标签与采样率）、下载中心、播放/暂停/进度/歌词/
  通知栏 MediaSession、搜索与键盘布局；`logcat -b crash` 无记录。

## 已知限制

- 16KB page size 仍不支持（RN 0.76 的预编译 `.so` 仍 4KB 对齐，RN 0.77+ 才支持）；
  本项目侧载分发不受影响，待新架构升级一起解决。
- RNN 8.0.0 为冻结版本（8.1+ 只支持 RN 0.77 新架构），缺 7.44–7.51 的部分状态栏/键盘修复；
  本轮实测未见回归。
- 新架构（Fabric/TurboModule）不在本轮范围，是下一阶段的独立工程。

## 回滚

- 源码全部在 `upgrade/rn-0.76` 分支，`master` 仍是 v3.40.0（RN 0.73.11）；
- 不稳定时直接发回 v3.40.0 的 APK（签名一致，可覆盖安装）。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `2806b5705e588577fb388d624d30d23d0f98e737d4ce94af0ad443ffdfa50fac` |
| armeabi-v7a | `2934a1e2ec178ea6db86ae9ed2748970495d498ca337e39a79e4c33d125fca75` |
| universal | `e2b2a4ac125ffdaecf497086d67e36f3f8aa701d58ee43a936ef91637b054fb8` |
