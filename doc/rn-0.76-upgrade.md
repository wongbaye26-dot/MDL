# RN 0.76.9 升级记录：RNN 8 + SVG 15 + 原生库矩阵

- 分支：`upgrade/rn-0.76`（基于 `master` / v3.40.0）
- 目标：React Native 0.73.11 → **0.76.9**（旧架构 `newArchEnabled=false`，Hermes）
- 配套：react-native-navigation 7.x → **8.0.0**、react-native-svg 14.x → **15.12.1**，其余原生库保持版本（矩阵见 §3）
- 交付版本：**v3.41.0 / versionCode 331**
- Android 基线：compileSdk/targetSdk 36、minSdk 24、Kotlin 1.9.25、AGP 8.6.0（由 RNGP 提供）、Gradle 8.10.2、NDK 26.1.10909125

> 为什么锁定 0.76 + 旧架构：RNN（react-native-navigation）是硬约束。
> - RNN 8.0.0（2025-02）是**最后一个支持 RN 0.76 + 旧架构**的 8.x；
> - RNN 8.1.0 起只支持 RN 0.77 + 新架构，旧架构被完全移除；
> - RNN 7.46.0 起主动 revert 了 RN 0.76 支持（7.51.2 的验证基线是 RN 0.73）。
> 因此本分支 = RN 0.76.9 + RNN 8.0.0；升级新架构是下一阶段的事（见 §6）。

---

## 1. 版本矩阵

| 包 | 升级前 | 升级后 | 说明 |
|---|---|---|---|
| react-native | 0.73.11 | **0.76.9** | 0.76 线最后一个 patch（`0.76.9`） |
| react | 18.2.0 | **18.3.1** | RN 0.76 模板版本 |
| @types/react | ^18.3.31 | **18.3.12** | 与 RN 0.76 的 TS 定义对齐（19 会冲突） |
| react-native-navigation | 7.39.2 | **8.0.0（精确）** | 唯一支持 RN 0.76 旧架构的 8.x；无 8.0.x patch 版 |
| react-native-svg | ^14.1.0（14.2.0） | **15.12.1（精确）** | 15.8.0 起支持 RN 0.76；15.13.0 起 drop RN<0.78，故 15.12.1 是上限 |
| @react-native/babel-preset | ^0.74.89 | **0.76.9** | |
| @react-native/metro-config | ^0.74.89 | **0.76.9** | |
| @react-native/typescript-config | ^0.74.89 | **0.76.9** | |
| @react-native-community/cli（+platform-android/ios） | 隐式 | **15.0.1（显式）** | RN 0.76 对应 CLI 15 |

**其余原生库全部保持原版本**（矩阵与证据见 §3）。不做「顺手升大版本」——每个库的最新版基本都要求 RN 0.78+ 甚至新架构。

---

## 2. 工程改动清单

### 2.1 JS / TS

- `package.json`：按 §1 升版本；`scripts` 不变。
- **RNN 8 的 JS API 无破坏性变更**：`lib/dist/src` 与 7.51.2 相比只有 3 个文件差异（2 个纯 TS 类型写法 + `Options.ts` 少了 7.48+ 才有的可选字段）。本仓库用到的 `setRoot` / `push` / `pop` / `showOverlay` / `dismissOverlay` / `mergeOptions` / `setDefaultOptions` / `registerComponent` / `events().register*Listener` 全部不需要改。
- **SVG 14 → 15 无 Android breaking change**：本仓库只用了 `Svg/Circle/Path/Ellipse/Rect/Defs/LinearGradient/Stop`，类型检查一次通过。
- RN 0.76 的 TS 类型变化（`TouchableOpacity` 实例类型不再可直接 `useRef<TouchableOpacity>`）修了 4 处：
  `OnlineList/ListItem.tsx`、`Download/TaskItem.tsx`、`Mylist/MusicList/ListItem.tsx`、`Mylist/MyList/List.tsx` → `useRef<ComponentRef<typeof TouchableOpacity>>(null)`。
- RN 0.76 类型收紧后两处多余断言被 lint 判为 `no-unnecessary-type-assertion`，已删：
  `Player/index.tsx`（`raw as LX.Music.MusicInfoLocal`）、`Player/LyricQuickMenu.tsx`（`row.icon as ...`）。
- `tests/db-row.test.js` 按 `object-property-newline` 规则格式化（存量 lint error，无逻辑变化）。

### 2.2 Android 构建（关键）

`android/build.gradle`
- `minSdkVersion 21 → 24`（RN 0.76 起要求 24）。
- `kotlinVersion 1.9.24 → 1.9.25`（RN 0.76.9 的 RNGP 版本目录值；`RNNKotlinVersion` 跟随）。
- buildscript classpath 改为**不写版本号**（AGP / Kotlin / RN Gradle Plugin）：
  RN 0.76 起由 `@react-native/gradle-plugin`（composite build）统一提供版本，模板即如此。
- 移除 `classpath("com.facebook.react:react-native-gradle-plugin")` 的显式版本（写了反而解析失败）与旧的 `apply plugin` 写法，改回模板的 `apply plugin: "com.facebook.react.rootproject"`。

`android/settings.gradle`
- 用 RN 0.76 的 autolink 写法：`pluginManagement { includeBuild(...) }` + `plugins { id("com.facebook.react.settings") }` + `autolinkLibrariesFromCommand()`。
- **必须保留文件末尾的 `includeBuild('../node_modules/@react-native/gradle-plugin')`**：
  只写在 `pluginManagement` 里时，它只用于解析 settings 插件，不会注册为 composite build；
  结果就是 root `buildscript` 里无版本号的 `com.facebook.react:react-native-gradle-plugin` 直接
  「Could not find ...:」构建失败（WIP 提交就是丢在这一行，已实测复现并修复）。

`android/app/build.gradle`
- `react { }` 内新增 `autolinkLibrariesWithApp()`：RN 0.76 由 RNGP 负责把 autolink 的库加进依赖，
  删掉了旧的 `apply from: .../native_modules.gradle; applyNativeModulesAppBuildGradle(project)`。
- 移除 `com.facebook.react:flipper-integration` 依赖；`MainApplication.java` 同步删除 Flipper 初始化（RN 0.76 移除 Flipper 集成）。

`android/gradle/wrapper/gradle-wrapper.properties`
- Gradle 8.8 → **8.10.2**（RN 0.76.9 模板版本）。

其他
- `RNGP 0.76` 会对「缺 namespace」的 autolink 库自动从 `AndroidManifest.xml` 的 `package` 注入 namespace，
  因此 `quick-md5` / `fs` / `exception-handler` 不需要再手补 `namespace`（构建 warning 可忽略）。
- `react-native-linear-gradient 2.8.3` 仍缺 `namespace`，已把它从「手工改 node_modules」补进
  `dependencies-patch.js`，全新安装也会自动打上。
- `signingConfigs.release` 支持三级回退：`-P MYAPP_UPLOAD_*`（CI Secrets）→ `android/keystore.properties`
  （本地）→ `debug.keystore`（无签名材料时仅用于编译校验并打警告）。修复了「缺 keystore.properties
  时 Gradle 在配置阶段直接抛 FileNotFoundException」——这是 CI 与全新 clone 无法构建的根因。

### 2.3 依赖安装方式（重要，影响可复现性）

RN 0.76 的 Metro（0.81）不再跟随 node_modules 里指向仓库外的软链。4 个 vendor fork 是
`file:../vendor/*`，默认装法会生成软链 → **release 打包 Metro 报「Unable to resolve module」**。

- 新增仓库根 `.npmrc`：`install-links=true`，让 `npm install` 把 `file:` 依赖物化为真实目录。
- `scripts/check-vendor.js` 的 track-player 扩展方法检查改为「源码 `src/trackPlayer.ts` 或
  物化后的 `lib/trackPlayer.d.ts` 二选一」——`--install-links` 装法只保留 `files` 白名单里的 `lib/`。
- **track-player 的 lib 改为 postinstall 生成**：`setup-vendor` 去掉它的 `prepare`
  （`rimraf lib && tsc` 在干净环境会因根依赖未就绪而失败，是 CI 一直失败的第二层原因），
  `dependencies-patch.js` 在依赖装好后用根项目的 `tsc -p` 生成 `lib/`。
- **CI 工作流修复**：vendor 拉取收敛进 `.github/actions/setup`（release/beta/build-test/check 共用），
  `build-test` 增加 setup/typecheck/unit，release workflow 删掉永远不存在的 x86 产物引用与无用
  `DISABLE_SVG`；`.nvmrc` 升到 Node 20。已用「空目录 + 重新 clone vendor + npm ci」演练
  （vendor:check / typecheck / lint / test:unit / Metro bundle 全过）。

---

## 3. 原生库矩阵（RN 0.76 旧架构）

判定口径：**编译已由 `:app:assembleDebug` + `:app:assembleRelease` 实测通过**；表中「运行期」列为静态审计（对照 RN 0.76.9 AAR 的 `javap` 签名）结论。

| 库 | 版本 | 版本动作 | 运行期结论 |
|---|---|---|---|
| react-native-navigation | **8.0.0** | 升（必须） | 导航/Modal/Overlay/事件全部实测通过 |
| react-native-svg | **15.12.1** | 升（必须） | 图标/矢量图实测正常 |
| @react-native-async-storage/async-storage | 2.1.2 | 保持 | 旧架构 + Room/KSP 编译通过；实测读写正常 |
| @react-native-clipboard/clipboard | 1.16.3 | 保持 | 无 RN0.76 相关 issue |
| @react-native-community/blur | 4.4.1 | 保持 | 旧/新架构双实现，实测 Glass 正常 |
| @react-native-community/slider | 4.5.7 | 保持 | 实测进度条正常 |
| @react-native-masked-view/masked-view | 0.3.2 | 保持 | 实测渐变遮罩正常 |
| react-native-exception-handler | 2.10.10 | 保持（无维护） | 编译通过；未触发异常路径 |
| react-native-fs | 2.20.0 | 保持（无维护） | 编译通过 |
| react-native-linear-gradient | 2.8.3 | 保持 + namespace 补丁 | 实测渐变正常 |
| react-native-pager-view | 6.7.1 | 保持 | 编译通过；6.8.0 才修「卸载崩溃」，暂无升级（基线 RN 0.79） |
| react-native-quick-base64 | 2.2.2 | 保持 | JSI/CMake 编译通过 |
| react-native-quick-md5 | 3.0.9 | 保持 | JSI/CMake 编译通过 |
| react-native-vector-icons | 10.2.0 | 保持 | 字体/图标实测正常 |
| react-native-sqlite-2 | 3.6.3 | 保持 | 旧库，编译通过；曲库索引走 AsyncStorage |
| react-native-background-timer（fork） | 2.4.1 | 保持 | RN API 引用面全部存在 |
| react-native-track-player（fork） | 2.1.2 | 保持 | 实测播放/进度/歌词/通知/MediaSession 正常 |
| react-native-file-system（fork） | 0.1.0 | 保持 | 实测本地曲库扫描正常（含 SAF 代码路径编译） |
| react-native-local-media-metadata（fork） | 0.1.0 | 保持 | 实测 FLAC 标签/采样率/码率读取正常 |

**明确不能用「最新版」的库**（会脱离 RN 0.76 基线）：RNN 8.1+（只支持 RN 0.77 新架构）、
SVG 15.13+（要求 RN≥0.78）、async-storage 3.x（RN 0.79）、slider 5.x（RN 0.81）、pager-view 6.8+（RN 0.79）。

---

## 4. 验证记录

### 4.1 静态门禁

| 项 | 结果 |
|---|---|
| `npm run typecheck` | 0 error |
| `npm run lint` | 0 error（3 条存量 react-hooks warning） |
| `npm run test:unit` | 32/32 pass |
| `npm run vendor:check` | 13/13 pass |
| `node dependencies-patch.js --strict` | 全部锚点命中 |

### 4.2 构建

| 项 | 结果 |
|---|---|
| `:app:assembleDebug -PreactNativeArchitectures=arm64-v8a` | BUILD SUCCESSFUL |
| `:app:assembleRelease` | BUILD SUCCESSFUL（R8/minify 通过） |
| APK | arm64-v8a / armeabi-v7a / universal 三包正常产出并签名 |
| GitHub Actions `Check`（vendor/typecheck/lint/unit） | ✅ 通过（commit `5d45edb6`） |
| GitHub Actions `Build`（无签名 Secrets，降级 debug 签名跑 `assembleRelease`） | ✅ 通过（该工作流历史上 31 次全红，本轮首次绿） |

### 4.3 真机冒烟（SM-S938B，Android 17 / API 37，release 包）

冷启动 / RNN 底部导航四页切换 / 排行榜与歌单广场 PageModal 打开与返回 / 设置页 RNN push 与返回 /
本地音乐（251 首、7.08GB，FLAC 标签 + 44.1kHz + 码率）/ 下载中心列表 / 播放器（播放暂停、进度、
歌词滚动、通知栏前台服务、MediaSession）/ 搜索（联想 + 结果列表，键盘弹出窗口不误判横屏）——
全部通过，`logcat -b crash` 无记录。

### 4.4 APK 体积

arm64-v8a：18.4MB（RN 0.73）→ **28.1MB**（RN 0.76）。原因不是代码变大，而是打包策略变化：

- minSdk 24 起 AGP 默认 `extractNativeLibs=false`，`.so` 在 APK 内**不压缩**存储（RN 0.73 的
  minSdk 21 走 legacy packaging，所以旧包是压缩的）；
- RN 0.76 默认把原生库合并成 `libreactnative.so`（旧版是十几个小 `.so`）。
  解压后原生库总量反而从 16.05MB 降到 14.92MB，安装/启动更快，但 APK 文件本身变大。

如需回到「小体积下载包」，可在 `android/app/build.gradle` 的 `packaging.jniLibs` 里设
`useLegacyPackaging = true`（代价：安装时解压、启动略慢）。当前保持 RN 0.76 默认行为。

---

## 5. 升级过程中踩到的坑（供后续参考）

1. **`includeBuild` 必须保留两处**：`pluginManagement` 里那份只负责 settings 插件；
   buildscript 无版本号 classpath 依赖的替换依赖文件末尾那份 composite `includeBuild`。漏了就是
   `Could not find com.facebook.react:react-native-gradle-plugin:`。
2. **`--install-links` 不是可选项**：软链装法下 Metro 解析不到 vendor fork，release 打包失败。
   已用 `.npmrc` 固化，避免每次手敲参数。
3. **RN 0.76 移除 Flipper**：app 依赖与 `MainApplication` 初始化都要删，否则 NoClassDefFoundError。
4. **KSP 版本 warning**：async-storage 用 `rootProject.ext.kotlinVersion`(1.9.25) 找 KSP，
   其内置映射表最高只到 1.9.24-1.0.20 → 打 warning 但编译通过（KSP 与 KGP 1.9.25 兼容），未处理。
5. **RNN 8.0.0 的分支关系**：`compare/8.0.0...7.51.2` = diverged（7.51.2 领先 22 个提交）。
   8.0.0 少的是 7.44–7.51 的状态栏 edge-to-edge / 键盘 / 旋转 / TopBar 修复，属已知取舍。

---

## 6. 已知限制与后续

1. **16KB page size 未支持**：实查 RN 0.76.9 的 `libjsi.so` / `libreactnative.so` 与
   `libquick{base64,md5}.so`（arm64）全部 `PT_LOAD align=0x1000`（4KB）；16KB 对齐是 RN 0.77+ 才支持。
   targetSdk 36 若上架 Google Play（要求 16KB 页对齐）会被阻断；本项目为站内/侧载分发，不受影响，
   但这是下一阶段必须解决的项。
2. **RNN 8.0.0 是冻结版本**：没有后续补丁；7.44–7.51 的修复缺失。若必须拿到这些修复，需要
   vendor fork RNN 或等新架构升级后用 RNN 8.1+。
3. **新架构是下一阶段**：RN 0.77+ / RNN 8.1+ / 全库新架构适配是独立的大工程（Fabric、TurboModule、
   codegen、第三方库新架构支持），本轮刻意不混入。
4. **track-player 生命周期 P2**：`MusicModule.java` 的 `onCatalystInstanceDestroy()` 在 RN 0.73/0.76
   都不会被调用（`ModuleHolder` 只调 `invalidate()`），receiver 泄漏/热重载重复事件是存量问题，
   与本次升级无关；后续可改 `invalidate()` 收口。
5. **pager-view 6.7.1**：存在「卸载崩溃/转场冻结」的已知问题（6.8.0 修复），但 6.8.0 基线是 RN 0.79；
   本仓库使用场景（底部导航非 pager）暂未复现，保持观察。

## 7. 回滚

- 升级提交全部在 `upgrade/rn-0.76` 分支；`master` 仍是 RN 0.73.11 / v3.40.0，可直接回退。
- 依赖回滚：`git checkout master -- package.json package-lock.json android/` + `npm install`。
- 产物：v3.40.0 的 dist 包保留在 `dist/v3.40.0/`（SHA256 见 release notes）。
