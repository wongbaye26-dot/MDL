# 新架构（Fabric/TurboModule）升级评估

- 评估日期：2026-11-09
- 评估对象：`EmoMusic` master（当前 RN 0.76.9 旧架构 + RNN 8.0.0，v3.41.0）
- 评估结论：**Go（技术上可行，但没有捷径）**。推荐目标组合 **RN 0.80.3 + RNN 8.6.2**（选项 B；0.80 线最新 patch）；
  若必须拿到 Android 16 官方支持则用 **RN 0.82.1 + RNN 8.6.3**（选项 B+）；
  不建议为省事停在 0.77（EOL + 无 Android 16 支持）。
- 结论先行：本项目**没有自定义 Fabric 组件 / 自定义 ViewManager**，8 个自研原生模块全是
  `ReactContextBaseJavaModule`（可走 legacy interop），因此新架构迁移的主要工作量在：
  ① RN/RNN/React 大版本升级的连锁改造；② MainApplication/RNN 接入；③ JS 侧 API 修正；
  ④ 少数旧桥库与自研 fork 的 interop 冒烟；⑤ 全量回归。**不是**重写原生 UI。

---

## 1. 为什么必须升（背景约束）

1. **RNN 是硬约束**：RNN 8.1.0 起只支持**新架构**（官方 release notes：old-arch completely removed，
   RN 0.77 是新架构唯一支持版本）；RNN 8.0.0 是最后一个旧架构版本且冻结。要继续维护 RNN，就必须上新架构。
2. **16KB page size**：Google Play 自 2025-11-01 起要求 16KB 对齐；RN 从 **0.77** 起 16KB 就绪
   （[RN 0.77 blog](https://reactnative.dev/blog/2025/01/21/version-0.77)：*“With the 0.77 release,
   React Native is ready to fully support 16 KB page size”*）。当前 RN 0.76 的 so 仍是 4KB 对齐。
3. **旧架构生命周期**：RN 0.80 官方冻结旧架构（不再修 bug、不再测试，仅允许 opt-out）；
   RN 0.81 是最后一个允许 Legacy Architecture 的版本；**RN 0.82 起 New Architecture only**
   （`newArchEnabled=false` 被忽略）。见
   [0.80 blog](https://reactnative.dev/blog/2025/06/12/react-native-0.80)、
   [0.81 blog](https://reactnative.dev/blog/2025/08/12/react-native-0.81)、
   [0.82 blog](https://reactnative.dev/blog/2025/10/08/react-native-0.82)。
4. **interop 层会保留**：0.82 明确“interop layers 会在代码库中保留 foreseeable future，
   interop 依赖的类/函数不会被移除”，这是本项目 8 个旧桥模块 + 旧桥第三方库能低成本迁移的前提。

---

## 2. 候选组合与推荐

RNN 的版本 ↔ RN 基线（`npm view react-native-navigation@<v> devDependencies.react-native` + release notes）：

| RNN | RN 基线 | 新架构 | 备注 |
|---|---|---|---|
| 8.1.2 | 0.77.2 | 仅新架构 | 第一个新架构 8.x，较早 |
| 8.4.3 | 0.78.3 | 仅新架构 | React 19 |
| 8.6.2 | **0.80.2** | 仅新架构 | 8.6 线稳定版（8.6.3 是 0.82 基线的补丁） |
| 8.6.3 | 0.82.1 | 仅新架构 | 修复 RN 0.79 native modules 加载等 |
| 8.7.6 | 0.84.0 | 仅新架构 | 8.7.0 起支持 RN 0.83 |
| 8.8.11 / 8.9.0 | 0.85.2 | 仅新架构 | 最新维护线 |

候选组合（工具链按官方模板整理；AGP 由 RNGP 提供）：

| 选项 | RN + RNN | 工具链 | 16KB | Android 16 | 升级跨度 | 评价 |
|---|---|---|---|---|---|---|
| A 最小跳 | 0.77.2 + 8.1.2 | Gradle 8.10.2 / Kotlin 2.0.21 / NDK 27.1 / React 18.3 | ✅ | ❌（0.81 才官方支持） | 1 个 minor | 风险在 RN 0.77 已 EOL、RNN 8.1 早期、没有 Android 16 修复 |
| **B 推荐** | **0.80.3 + 8.6.2** | Gradle 8.14.1 / Kotlin 2.1.20 / NDK 27.1 / React 19.1 | ✅ | ⚠️ 非官方（本项目已有 targetSdk 36 兼容层） | 4 个 minor | RNN 8.6 线成熟、旧架构仍可临时回退做对照 |
| B+ | 0.82.1 + 8.6.3 | Gradle 9.0 / Kotlin 2.1+ / React 19.1.1 | ✅ | ✅（0.81+ 官方） | 6 个 minor | 新架构 only；Gradle 9 是额外变量；RNN 8.6.3 基线刚好是 0.82.1 |
| C 最新 | 0.85.2 + 8.9.0/8.8.11 | 最新工具链 | ✅ | ✅ | 9 个 minor | 维护性最好但一次性吸收 React 19.1.1 + Gradle 9 + 多轮 breaking change，不建议作为第一跳 |

**推荐 B**，理由：
- RNN 8.6.2 的 devDependencies 就是 RN 0.80.2（0.80.3 同 patch 线），属“官方验证过的组合”；
- 16KB 已满足（0.77+），不依赖最新的 0.85；
- 相比 0.82+，少掉“Gradle 9 / 新架构 only / 更多 breaking change”三个变量；
- 0.80 仍保留旧架构 opt-out，PoC 阶段可以 `newArchEnabled=false` 先升 RN 再翻新架构，便于二分定位。
- 风险：0.80 不官方支持 Android 16——但本项目已经在 RN 0.76 上自行完成了 targetSdk 36 兼容
  （edge-to-edge、insets、预测性返回 opt-out、键盘 transient resize），需要在 PoC 回归中重点验证。

> 若“必须官方 Android 16 支持”是硬门槛（例如要上架 Play 且不想自己维护 36 适配），选 **B+**
> （0.82.1 + RNN 8.6.3）：RN 0.81 起默认 targetSdk 36，RNN 8.6.3 的 RN 基线正好 0.82.1。
> 代价是 Gradle 9 与 new-arch-only。

---

## 3. 项目侧兼容矩阵

### 3.1 第三方原生库（本地 node_modules 实测 + 版本门槛）

判定依据：`package.json` 是否有 `codegenConfig`、Android 源码是否有 TurboModule/Fabric 标记。

| 库 | 现版本 | 新架构 | 建议 |
|---|---|---|---|
| react-native-svg | 15.12.1 | ✅ codegen + Fabric/TurboModule | 保持（0.80 可继续用；注意 15.13+ 要求 RN≥0.78，0.80 没问题） |
| @react-native-async-storage/async-storage | 2.1.2 | ✅ codegen + TurboModule | 保持；0.80 下可升 2.2.x（按需） |
| @react-native-clipboard/clipboard | 1.16.3 | ✅ codegen + TurboModule | 保持 |
| @react-native-community/blur | 4.4.1 | ✅ codegen + Fabric | 保持 |
| @react-native-community/slider | 4.5.7 | ✅ codegen + Fabric | 保持 |
| react-native-pager-view | 6.7.1 | ✅ codegen + Fabric | 保持 |
| react-native-vector-icons | 10.2.0 | ✅ codegen + TurboModule | 保持 |
| @react-native-masked-view/masked-view | 0.3.2 | ❌ 旧桥 | 走 Fabric/ViewManager interop；可选升级/替换（`@react-native-masked-view` 后续版本） |
| react-native-linear-gradient | 2.8.3 | ❌ 旧桥（3.0 beta 才新架构） | 走 interop；若 interop 有问题再评估 3.0.0-beta |
| react-native-fs | 2.20.0 | ❌ 旧桥（无维护） | 走 TurboModule interop；长期替换（file-system fork 已覆盖大部分能力） |
| react-native-exception-handler | 2.10.10 | ❌ 旧桥（无维护） | 走 interop；若报错考虑去掉/自实现 |
| react-native-sqlite-2 | 3.6.3 | ❌ 旧桥（无维护） | 走 interop；长期随本地库存储方案一起换 |
| react-native-quick-base64 | 2.2.2 | ⚠️ JSI（C++），非 Fabric/TM | 理论上新架构可用；**0.81+ 需要 `target_compile_reactnative_options`/`RN_SERIALIZABLE_STATE` 改 CMake**（0.80 不需要） |
| react-native-quick-md5 | 3.0.9 | ⚠️ JSI（C++） | 同上 |
| react-native-background-timer（fork） | 2.4.1 | ❌ 旧桥 | interop；实现简单，风险低 |
| react-native-file-system（fork） | 0.1.0 | ❌ 旧桥 | interop；重点回归 SAF/file IO |
| react-native-local-media-metadata（fork） | 0.1.0 | ❌ 旧桥 | interop；重点回归标签/封面 |
| react-native-track-player（fork） | 2.1.2 | ❌ 旧桥（含 HeadlessJsTaskService/FGS/通知） | interop；**最高风险**，重点回归播放/通知/MediaSession/后台 |

结论：没有“必须换库”的阻断项；**必须升级的库：无**（RNN 自己升到 8.6.2）。
需要 PoC 实测 interop 的库：masked-view、linear-gradient、fs、exception-handler、sqlite-2、
track-player fork、file-system fork、local-media-metadata fork、background-timer fork。

### 3.2 App 自研原生模块（8 个，全部旧桥）

| 模块 | 方法数 | 关键 API | 新架构影响 |
|---|---|---|---|
| UtilsModule | 31 | LifecycleEventListener、广播、insets、品牌信息 | interop；Lifecycle 事件需回归 |
| CryptoModule | 10 | 加密/JNI | interop，低风险 |
| DirectoryPickerModule | 10 | Activity result + 事件 | interop；SAF 选择器需回归 |
| DownloadModule | 10 | 线程/文件/事件 | interop；真实下载需回归 |
| LyricModule | 9 | 媒体会话歌词/事件 | interop；歌词同步需回归 |
| UserApiModule | 5 | JS 脚本执行/网络 | interop；在线源需回归 |
| CacheModule | 2 | 文件缓存 | interop，低风险 |
| WidgetModule | 2 | AppWidget RemoteViews | interop，低风险 |

- **无自定义 ViewManager / Fabric 组件**（`grep SimpleViewManager|ViewGroupManager` = 0），
  因此不需要写 codegen 规范或 Fabric 组件。
- 事件：原生用 `RCTDeviceEventEmitter` 发事件；JS 用 `new NativeEventEmitter(module)` 订阅，
  4 个模块已实现 `addListener/removeListeners`（之前为兼容 RN 0.65 加过），interop 前提已满足；
  PoC 需验证 bridgeless 下事件仍通。
- `MainApplication` 必改（RNN 8.6.2 要求）：
  - 新增 `getReactHost()`（Java 可写），返回 `DefaultReactHost.getDefaultReactHost(context, reactNativeHost)`；
  - 删除我们自己的 `DefaultNewArchitectureEntryPoint.load()`（RNN 的 NavigationApplication 内部已调用）；
  - `NavigationPackage` 改为无参 `BaseReactPackage`（TurboModule），autolinking 按约定可发现，PoC 验证。
- `MainActivity` 继承 `NavigationActivity`（8.6.2 里已改为 `AppCompatActivity`），现有 inset/窗口代码
  使用普通 Activity API，理论兼容；回归输入法/分屏/挖孔。
- 应用原生模块**不需要**立刻改 TurboModule spec（interop 可用）；后续可选做 codegen，换取性能/类型安全，
  **不在本次 PoC 范围**。

### 3.3 JS 侧需改项（已盘点）

| 项 | 位置 | 说明 |
|---|---|---|
| `BackHandler.removeEventListener` | `src/utils/hooks/useBackHandler.ts` | **RN 0.77 已移除**；改用 `const sub = BackHandler.addEventListener(...); return () => sub.remove()` |
| `UIManager.getViewManagerConfig` | `Glass.tsx`、`FadeMask.tsx` | 新架构下大概率返回 undefined；已 optional chain，会走降级分支（磨砂退纯色/遮罩退普通 View），PoC 确认是否可接受 |
| `NativeEventEmitter(module)` × 5 | utils/userApi/download/lyricRemote | 模块已有 addListener/removeListeners；PoC 验证 bridgeless 事件 |
| `NativeModules.X` 动态访问 | 6 个文件 | RN 0.77 起 NativeModules 可加载 TurboModule，一般兼容；PoC 验证 |
| React 18 → 19.1 | 全仓 | 需回归 RNN/第三方库；本项目无类组件/refs 字符串用法（待 lint） |
| `SafeAreaView` | 无使用 | 无需处理 |
| react-native deep imports | 仅 1 行注释 | 无需处理 |
| `expo`/其它 | 无 | — |

### 3.4 构建链变化（B 选项：RN 0.80.2）

- Gradle 8.10.2 → **8.14.1**；Kotlin 1.9.25 → **2.1.20**；NDK 26.1 → **27.1.12297006**；
  compileSdk 35（我们保持 36）、targetSdk 35（我们保持 36）、buildTools 35.0.0；
  CLI 15 → 19；`newArchEnabled=true`。
- RN 0.80 需要：**React 19.1.0**、Node（0.81 起才强制 20.19.4，0.80 建议同样升到 20.19+）、
  `@react-native/*` 0.80.2、`@types/react` 19。
- `@react-native/gradle-plugin` 由 composite build 提供（当前 settings.gradle 的写法可沿用）。
- AGP 版本由 RNGP 提供（0.80 对应 8.10 左右，PoC 实测确认）。
- 0.81+ 额外要求（若选 B+）：Node ≥20.19.4、`RN_SERIALIZABLE_STATE` CMake 宏（影响 quick-base64/quick-md5
  的自定义 CMakeLists，需要补 `target_compile_reactnative_options`）。

---

## 4. 迁移步骤与工作量

### P0 PoC（1.5–2.5 人日，本次先做）
1. 从 master 拉 `upgrade/rn-0.80-newarch`；
2. 版本矩阵：RN 0.80.2 / React 19.1.0 / RNN 8.6.2 / CLI 19 / @react-native/* 0.80.2；
3. Android 工具链：Gradle 8.14.1、Kotlin 2.1.20、NDK 27.1.12297006、`newArchEnabled=true`；
4. MainApplication 加 ReactHost、去掉重复 load；MainActivity 适配；
5. `npm install` → `npx react-native config`（验证 RNN autolink）→ `:app:assembleDebug`；
6. 真机跑「启动 / 导航 / 播放 / 下载 / 本地库 / 通知」6 条主链路；
7. 输出 PoC 报告（构建错误清单、interop 实测结果、性能/APK 体积对比）。
   验收：debug 包可装可启动，6 条主链路无崩溃（允许个别 UI 降级项记录）。

### P1 全量迁移（5–8 人日）
- 处理 P0 暴露的编译/interop 问题；JSI/CMake 库补丁；旧桥库若有问题逐个替换/补丁；
- RNN 8.6.2 接入（MainApplication/MainActivity/index.js/options 迁移）；
- JS 修正（BackHandler/UIManager/事件）；React 19 兼容；
- 更新 dependencies-patch / vendor 补丁锚点。

### P2 回归与发布（4–6 人日）
- 17 项真机回归矩阵（沿用 v3.41.0 QA 清单 + 新架构专项：interop 事件、Fabric 布局、媒体会话、
  SAF、下载、后台播放、通知自定义按钮）；
- 性能基线（启动、滚动帧率、APK 体积）；16KB 对齐复核（`readelf` 全部 so）；
- release notes/升级文档/回滚方案。

**总计约 11–16 人日**（不含后续把 8 个自研模块改 TurboModule codegen 的 5–8 人日，可延后）。

---

## 5. 风险登记

| # | 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|---|
| R1 | RN 0.80 + targetSdk 36（Android 16）非官方组合出现 edge-to-edge/预测性返回/insets 回归 | 中 | 高 | PoC 真机重点回归；必要时切 B+（0.82.1） |
| R2 | RNN 8.6.2 在 RN 0.80 的行为变化（8.0→8.6 累积变更、overlay/modal/statusbar/keyboard） | 中 | 中 | PoC 用现有 17 项导航/页面清单回归 |
| R3 | 旧桥 interop：bridgeless 下 `NativeEventEmitter`/LifecycleEventListener/ActivityResult 行为变化 | 中 | 高 | PoC 优先验证 8 模块 + 4 事件源 |
| R4 | vendor forks（track-player 2.1.2 等）在 bridgeless 下通知/FGS/Headless 服务异常 | 中 | 高 | PoC 真机回归播放/通知/后台/自定义按钮 |
| R5 | JSI 库（quick-base64/quick-md5）CMake 在新架构下的编译/加载 | 中 | 中 | P0 构建实测；失败则打 `target_compile_reactnative_options` 补丁或换库 |
| R6 | React 19 与三方 JS 库兼容（RNN/播放器/工具库） | 低-中 | 中 | typecheck + 真机回归；必要时锁 React 18 不可能（RN 0.80 强制 19.1） |
| R7 | Kotlin 2.1.20 / Gradle 8.14.1 与 RNN 8.6.2/各库 buildscript 冲突 | 中 | 中 | 以 RNGP 提供的版本为准；PoC 逐个修 buildscript |
| R8 | 16KB：自研 so（quick-*、sqlite）仍是 4KB | 低 | 中 | 升级库或 `-Wl,-z,max-page-size=16384` 重编；发布前 `readelf` 全量核对 |
| R9 | 旧 vendor 补丁（track-player 12 条）在新 RN 上锚点失效 | 中 | 中 | `dependencies-patch --strict` 会暴露；PoC 逐条校准 |
| R10 | 升级窗口内无法回滚 | 低 | 高 | 独立分支 + 保留 v3.41.0 基线；RN 0.80 支持旧架构 opt-out 便于二分 |

---

## 6. PoC 验收标准（P0 门禁）

1. `:app:assembleDebug`（arm64-v8a）成功，`newArchEnabled=true`；
2. 安装到 SM-S938B 可冷启动，无 JS/Native 崩溃；
3. 6 条主链路通过：
   - RNN 四页导航 + 排行榜/歌单广场 PageModal；
   - 本地播放（FLAC）+ 进度/歌词 + MediaSession/通知；
   - 在线源搜索 + 真实下载（含 SAF 路径选测）；
   - 本地曲库体检扫描；
   - 设置页 push + 主题切换（RNN mergeOptions/setDefaultOptions）；
   - 通知自定义按钮（收藏/循环）经 `am startservice` 同路径验证；
4. 记录：构建错误清单、interop 行为差异、APK 体积、启动耗时（与 v3.41.0 对比）；
5. 明确「继续/放弃/换目标版本」的决策建议。

---

## 7. 决策待办（需要人拍板）

1. 目标组合选 **B（0.80.2）** 还是 **B+（0.82.1，官方 Android 16）**？
2. 自研 8 模块：先 interop（推荐，PoC 不改代码）还是一并做 TurboModule codegen（+5–8 人日）？
3. vendor 4 fork：继续自己维护，还是借新架构迁移换成官方/活跃库（track-player 官方 4.x 已支持新架构，但 fork 的自定义能力要重做）？
4. iOS：本轮继续不做（当前项目无 iOS 构建），还是同步升级（+3–5 人日，无法在本机验证）？

---

## 8. P0 PoC 进度记录（2026-11-09，分支 `upgrade/rn-0.80-newarch`）

已按选项 B 起 PoC 分支并完成第一轮：

**已完成**
1. 版本矩阵落地：`react-native@0.80.3`、`react@19.1.0`、`react-native-navigation@8.6.2`、
   `@react-native/*@0.80.3`、CLI `19.0.0`；`npm install` 成功。
2. Android 工具链：Gradle `8.14.1`、Kotlin `2.1.20`、NDK `27.1.12297006`、`newArchEnabled=true`。
3. **RNN 8.6.2 autolink 验证通过**：`npx react-native config` 输出
   `import com.reactnativenavigation.NavigationPackage;` + `new NavigationPackage()`（无参、免
   react-native.config.js），说明 RNN 8.5+ 已改为 CLI 约定式 autolink，不需要 `npx rnn-link` 的 Android 部分。
4. `MainApplication.java` 新架构改造可行（不需要整文件 Kotlin 化）：
   增加 `getReactHost()` → `DefaultReactHost.getDefaultReactHost(context, reactNativeHost)`；
   删除应用自己的 `DefaultNewArchitectureEntryPoint.load()`（RNN 的 NavigationApplication 内部已调用）。
5. **typecheck 迁移项**（RN 0.80/React 19 类型）：
   - `@react-native/typescript-config@0.80` 默认 `customConditions:["react-native"]`，会把 RNN 等库的
     `exports.react-native` 指到 **TS 源码**（RNN 的 src 缺 lodash/prop-types 类型，产生 49 个错误）。
     解决：本项目 tsconfig 覆盖 `"customConditions": []`，让 tsc 走各库 `types`/d.ts；
   - `BackHandler.removeEventListener` 在 RN 0.77 已移除 → 改 `subscription.remove()`（`useBackHandler.ts`）；
   - React 19 移除全局 `JSX` 命名空间 → 4 个文件 `import type { JSX } from 'react'`；
   - React 19 `useRef()` 必须带初值 → `useRef<SelectInfo | undefined>(undefined)`。
   **以上修完后 `npm run typecheck` 0 error。**
6. **KSP/Kotlin 2.1.20**：async-storage 的 KSP 版本映射表不认 2.1.20，默认落到 1.9.24-1.0.20，
   构建报 `Type org.jetbrains.kotlin.incremental.ChangedFiles not present`。
   已加 `AsyncStorage_next_kspVersion=2.1.20-1.0.32`（gradle.properties）。
7. 构建过程已顺利通过 RNGP、AgpConfigurator、RNN 8.6.2、quick-base64/quick-md5 的配置阶段，
   自动安装 NDK 27.1 与 quick 库要求的 NDK 27.0（注意：会同时装两个 NDK，约 4GB）。

**进行中**
- `:app:assembleDebug` 第二轮（修 KSP 后）。第一轮失败点仅为上述 KSP 任务，不是架构级阻断。

**待验证（第二轮之后）**
- 全量 so 编译（含 RNN 8.6.2 codegen/Fabric 部分、quick JSI 库）；
- 安装到真机后的 interop 行为：8 个旧桥模块、5 路事件、track-player 通知/后台、SAF、下载；
- APK 体积/启动对比；16KB 对齐复查。

### P0 PoC 最终结果（release 包，2026-11-09 01:00）

**结论：Go。B 组合（RN 0.80.3 + RNN 8.6.2）在构建与运行层面均已跑通，剩余问题集中在第三方库的新架构适配质量，不是架构性阻断。**

- ✅ `assembleDebug`、`assembleRelease`（含 R8）均成功；release arm64 包 32.2 MB（旧架构 28.1 MB，+4 MB，合并 so/新架构预期内）。
- ✅ release 包（Hermes + R8）真机启动：日志 `Running "lxm.HomeScreen" ... "fabric":true`，
  RNN `NavigationTurboModule.setRoot` 正常，首页数据/封面/SVG 图标/Fabric 布局全部渲染；
  播放页（封面/歌词/进度/控制）正常，本地 FLAC 可播（音频进度从 00:00 前进到 01:11）。
- ✅ 8 个旧桥原生模块在 bridgeless 下可用（启动链已实际调用 UserApi/Lyric/TrackPlayer/Utils 等）；
  `NativeEventEmitter` 事件链（TrackPlayer → JS）工作。

**PoC 中发现并已修的问题**

| # | 问题 | 修复 |
|---|---|---|
| 1 | RNN `Navigation.setDefaultOptions` 在 activity 就绪前调用 → `NavigationTurboModule: current activity is null!` | 移到 `appLaunched` 回调内（`src/navigation/index.ts`） |
| 2 | track-player 2.1.2 `lib` 里 `require("react-native/Libraries/Image/resolveAssetSource")`，RN 0.80 下不是函数 → 启动 TypeError | 改为 `require("react-native").Image.resolveAssetSource`；已加入 `dependencies-patch.js` + vendor src |
| 3 | React 19：全局 `JSX` 命名空间移除、`useRef()` 必须初值 | 4 文件 `import type { JSX }`；`useRef<T \| undefined>(undefined)` |
| 4 | React 19：SVG `Path/Circle` 把 `key` 混在 spread props 里报警 | `TabIcon.tsx` 改为显式 `key={index}` |
| 5 | Fabric 对 `fontSize<=0` 严格校验（启动早期 fontScale=0 抛 `FontSize should be a positive value`） | `Text.tsx` 对 fontScale 做 `>0` 兜底 |
| 6 | async-storage 的 KSP 映射不认 Kotlin 2.1.20 | `AsyncStorage_next_kspVersion=2.1.20-1.0.32` |
| 7 | RN 0.80 的 `@react-native/typescript-config` 会把库的 `exports.react-native` 当类型源 | tsconfig 覆盖 `customConditions: []` |

**PoC 发现但仍未解决（P1 必须处理）**

| # | 问题 | 影响 |
|---|---|---|
| A | `@react-native-community/blur@4.4.1` 的 Fabric 实现与打包的 BlurView 版本 API 不匹配（`NoSuchMethodError: setupWith`）→ 已在 Fabric 下把 Glass 降级为纯色 | 磨砂玻璃视觉降级；需升级/替换 blur 库 |
| B | **MediaSession 状态停在 CONNECTING**（音频实际在播、歌词/进度前进），通知栏媒体卡/锁屏控制可能不更新 | 影响通知栏控制/媒体元数据；需修 track-player fork 的 MediaSession 更新路径 |
| C | 冷启动报 `No task registered for key TrackPlayer`（headless playback service 注册时机） | 可能与 B 同源；需调整注册时序/兼容 bridgeless |
| D | 本地曲库 shadow sync 报 `duplicate column name: language`（疑似初始化被调用两次） | 脏数据/迁移幂等性隐患，需查重入 |
| E | **16KB**：release APK 中除 `libquickjs-android-wrapper.so`（0x1000）外，其余 so 均已是 0x4000（16KB）对齐（含 RN 预编译、quick-base64/quick-md5、sqlite） | 仅剩 quickjs（`wang.harlon.quickjs:wrapper-android:2.4.0`，UserApi 脚本引擎）需换库/重编；换掉即满足 16KB |
| F | 调试包在 Android 17 上弹「16KB 对齐」开发者提示（release 包实际已对齐，属 debug 包/系统提示差异） | 发布前用 release 包 `readelf` 复核即可 |

**修订后的工作量**：P0（已完成）≈ 0.5 人日；剩余 P1（A–D 修复 + RNN/JS 收尾）约 **4–6 人日**；
P2 全量回归（17 项真机 + 新架构专项）约 **4–6 人日**；合计 **8–12 人日**（不含可选的 8 模块 TurboModule codegen 化）。

---

## 9. P1 修复结果（2026-11-09，`upgrade/rn-0.80-newarch`）

### 已修复并实测

| # | 问题 | 修复 | 验证 |
|---|---|---|---|
| 1 | MediaSession 停在 CONNECTING、通知栏不更新 | track-player fork 的 `updatePlayback()` 只重建通知按钮，没同步 `PlaybackStateCompat`；补 `updatePlaybackState(manager.getPlayback())` | 播放中 `dumpsys media_session` 为 `PLAYING(3)`，通知栏媒体卡（标题/封面/进度/5 个 action）正常；本地 FLAC 进度正常前进 |
| 2 | 冷启动 `No task registered for key TrackPlayer`（headless service 在 bridgeless 下找不到任务） | fork 的 `HeadlessJsTaskService`/`MusicService` 改为优先走 `ReactHost.getCurrentReactContext()`（legacy `ReactInstanceManager` 会创建另一个 ReactContext）；无 ReactHost 时才回退 | 冷启动警告 0 次；通知栏收藏/循环按钮（`am startservice -a ...NOTIFY_FAVORITE/NOTIFY_LOOP`）实测生效，无崩溃 |
| 3 | quickjs 的 `libquickjs-android-wrapper.so` 只有 4KB 对齐（唯一一个拖 16KB 后腿的库） | `wang.harlon.quickjs:wrapper-android` 2.4.0 → **3.2.3**（API 兼容：QuickJSContext/Console/QuickJSLoader 不变） | 解析 release APK 全部 **16 个 arm64 so 均为 p_align=0x4000**；UserApi 在线上源/歌词脚本仍正常（首页在线数据可加载） |
| 4 | 本地库迁移在 SQLiteLog 打 `E duplicate column name: language` 噪音 | 迁移前先查 `pragma_table_info('tracks')`，只 ALTER 缺失列 | 日志中 duplicate column 计数 0 |
| 5 | 通知栏收藏/循环触发列表/设置更新时，Fabric 抛 `FontSize should be a positive value: 0` 崩溃 | 字号计算统一兜底：`getTextSize`/`setSpText` 最小 1；`Text` 组件对最终 style 的 fontSize 再兜底；`Icon` size 最小 1 | 连续 5 轮收藏/循环 + 通知栏展开/收起，崩溃 0、JS error 0；收藏态（红心）与播放模式按钮都实时更新 |
| 6 | lint/引擎洁癖 | 合并 React 的重复 import（`type JSX`）、加 `.eslintignore` 排除 `android/` 等生成目录 | `npm run lint` 只剩 3 个与本次无关的历史错误（Modal/Main 的 promise-function-async） |

### 仍保留的已知限制

- **blur 磨砂效果降级**：RNN 8.6.2 依赖 `com.github.Dimezis:BlurView:3.0.0`，而 `@react-native-community/blur@4.4.1` 的 Fabric 实现是按 BlurView **2.0.4** API 编译的（`setupWith(ViewGroup)` vs v3 的 `setupWith(BlurTarget)`），必然 `NoSuchMethodError`。
  当前新架构下 `Glass` 检测到 Fabric 就降级为纯色玻璃（无崩溃、视觉略降级）。
  后续可选：①等 blur 库支持 BlurView 3；②自研 `BlurTarget` 包装 + Fabric view manager；③长期保持纯色玻璃（设计可接受）。
- **通知栏/锁屏文案**：媒体卡标题/歌手/进度正常；展开视图自定义按钮已验证可点；未覆盖完整锁屏（Android 17 锁屏全屏媒体卡属于系统 UI，如需可再补一轮）。

### P1 剩余工作（进入 P2 回归前）

1. 全量 17 项真机回归（参照 `doc/qa-3.41.0-rn076.md`）：下载/SAF、通知栏自定义按钮、横屏播放器、队列恢复、M3U/歌词偏移、弱网、分屏/折叠屏等；
2. 新架构专项：主题切换（RNN `mergeOptions`）、启动耗时/内存/APK 体积对比、16KB 设备实测、低端机（armeabi-v7a）实机；
3. blur 方案决策（见上）；
4. 8 个自研模块是否需要 TurboModule codegen 化（可选，当前 interop 全可用）。
