# EmoMusic v3.54.0 功能与 UI/UX 完成度审计报告

- **审计对象**：`EmoMusic`（Android 客户端，React Native **0.80.3** 新架构 / React 19.1 / RNN 8.6.2）
- **版本基线**：`package.json` **3.54.0** / versionCode **362**；git HEAD `68cd8622`（tag `v3.53.1`）
- **工作区状态**：仅 3 个文件未提交（`CHANGELOG.md` / `package.json` / `publish/version.json`），较 4 天前干净得多
- **审计时间**：2026-11-10（Asia/Bangkok）
- **方式**：全仓静态取证（导航图 / import 引用图 / 设置项读写点 / 动画与原生实现 / 文档与代码对照）+ 静态检查与单测复跑
- **边界**：**未连接真机**，不做运行时复测；真机结论仅引用 `doc/design-system-implementation.md`、`doc/qa-3.41.0-rn076.md` 等既有记录
- **对照基线**：`doc/audit-report-3.8.8.md`（4 天前，v3.8.8）

---

## 结论速览

> **功能 78 / UI·UX 74 / 工程质量 70 / 文档可信度 58，综合 74（个人侧载），应用商店口径约 58。**
>
> 这 4 天完成了一次大跨度迭代（3.8.8 → 3.54.0，45 个版本）：新架构迁移、设置页结构重做、本地曲库 SQLite 影子双写、下载线程基准、播放器手势与 Sheet 化都落地了，**视觉骨架已经成型**。但**跨版本未闭环的老问题依然在同一位置**（协议弹窗、孤儿开关），且新增了两处「看起来完成、实际没接线」的实现（读源切换、SAF 删除），文档与代码的偏差也在扩大。

| 维度 | 得分 | 主要依据 |
|---|---:|---|
| 功能交付（用户可达口径） | **78** | 本地音乐中心与下载链路显著增强；协议链路、读源切换、SAF 删除三处扣分 |
| UI / UX | **74** | 设置页 S-01~S-04、S-10 真修复；设计系统 token 落地但旧组件未清、交互反馈未铺开 |
| 工程质量 | **70** | typecheck 0、lint 0 error/2 warning、单测 32/32；37 零引用文件、58 处空 catch、巨型文件 |
| 测试 / 自动化 | **65** | 7 文件 32 用例 + CI 接入（较 3.8.8 的 0 是质变）；无 UI/E2E，smoke 仍被常驻动画限制 |
| 文档可信度 | **58** | README 版本/架构/产物名三处滞后；设计系统文档 2 处描述与代码不符；readSource 注释自相矛盾 |
| 发布 / 签名 | **80** | 3.54.0 三 ABI 包齐全 + `SHA256SUMS`；但 CI Secrets 未配置，自动 Release 未启用 |
| 安全 / 合规 | **58** | 首启协议仍不可达；`MANAGE_EXTERNAL_STORAGE` / `REQUEST_INSTALL_PACKAGES` 保留 |
| **综合（个人侧载）** | **74 / 100** | 可日常使用，架构升级成功；短板集中在接线、文档与合规 |
| **综合（应用商店）** | **约 58 / 100** | 协议/隐私链路、权限政策、无障碍与自动化仍是硬伤 |

> **与 3.8.8 的分数不可直接比较**：本次口径扩了「架构迁移、本地库存储、死代码治理、文档可信度」四项，且新增了更严的协议合规项。可比的是**遗留项闭环率**（见 §3）：5 项遗留中 **0 项完全闭环、3 项部分、2 项原样未动**。

---

## 1. 这 4 天发生了什么

| 变化 | 证据 |
|---|---|
| 新架构迁移：RN 0.76 → **0.80.3**、React 19.1、RNN 8.6.2、`newArchEnabled=true` | `package.json:68-82`、`android/gradle.properties:36`、`MainApplication.java:74-77` 用 `DefaultReactHost` |
| 自研模糊：`GlassBlurView`（preDraw 窗口快照 + RenderEffect，SNAPSHOT_SCALE 0.30，空闲/活动双降帧） | `android/.../blur/GlassBlurView.java:24-55` |
| 本地曲库：新增 `src/core/localLibrary/`（SQLite 8 张表、影子双写、迁移、读源开关） | `repository.ts:12-13,149-229`、`shadow.ts`、`migrate.ts`、`readSource.ts` |
| 设置页结构重做 + 设计系统 token | `doc/design-audit-settings-ui.md`、`doc/design-system-implementation.md`、`design/DESIGN-SYSTEM.md` |
| 下载：批量删任务与文件、1~4 线程基准、速度/ETA、原生驱动进度 | `Download/DownloadPage.tsx:109-142`、`core/download/threadStats.ts:49-89` |
| 播放器：封面下滑关闭、三页结构、队列/统计 Sheet 化、倍速 UI | `Player/index.tsx:739-849,1259-1310`、`Refactored/Playback.tsx:29` |
| 测试从 0 到 32 用例，CI 接入 | `tests/*.test.js`、`check.yml:37-38`、`build-test.yml:28-29` |

---

## 2. 功能完成度

### 2.1 逐模块评分

| 模块 | 分 | 结论与证据 |
|---|---:|---|
| 架构迁移 | 84 | 新架构 + RNN 全链路可跑；**9 个自研 Package 仍 `implements ReactPackage`，无 codegen / TurboModule spec**，JS 全走 `NativeModules.X`；`GlassBlurViewManager.java:8` 自述 legacy ViewManager 靠 Fabric interop；`dependencies-patch.js` 33 个补丁（bridgeless headless `:424-468`、MediaSession `:134-138`、Android16 FGS `:287-340`） |
| 本地库存储 | **72** | SQLite `emomusic_library_v1` v1，tracks 28 列 + playlists/playlist_tracks/scan_roots/recycle/id_map/meta/migration_state；影子双写**真启用**（`localMusic/index.ts:33-36` 保存即 `scheduleShadowSync`，8 个保存点）；**但读源默认仍是 JSON**（`readSource.ts:17-22` 仅 `'repository'` 才切库），**`setReadSource` 全仓零调用**，DB 分支（`localMusic/index.ts:144-153`）实际不可达；迁移只做 dry-run（`migrate.ts:40-48`），`migration_state` 无读写，回滚靠「JSON 不动 + 清库重建」 |
| 本地音乐 UI | 82 | 六页签=歌曲/文件夹/专辑/艺人/风格/最近添加（歌单在「我的」，无独立播放列表页签）；排序 6 键 + 格式/封面筛选（`viewPrefs.ts:64-87`）；M3U 导入导出（`index.tsx:838-866`）、CUE 导入与按起止播放（`:868-920`、`core/player/player.ts:311`）；标签读写限于原生三字段 + FLAC 扩展（`SongInfoPage.tsx:155-213`） |
| 播放器 | 78 | 手势/转场/信息页/队列 Sheet/听歌统计齐全；**倍速终于有 UI**（`Refactored/Playback.tsx:29` → `TrackPlayer.setRate`）；`player.ts:498-530` 的淡入淡出只是切歌音量渐变，**不是 Crossfade**；全仓无 `gapless` / `replaygain` / `equalizer` 命中，三项音效未实现 |
| 下载 | 84 | 批量删任务与文件、1~4 线程基准采样、速度/ETA、Range + `.part/.part.seg` 断点续传均实现；**SAF 边界断链**：`download/index.ts:840-843` 删文件只 `unlink(filePath).catch(()=>{})`，而 SAF 任务 `filePath` 是 `content://`（`:504`），文件删不掉、无失败提示、不回滚、也不移出曲库 |
| 设置体系 | 70 | 8 组可用（`Setting/Main.tsx:18-27`），深链事件 `settingsDeepScreenRequested` 可用；65 个 setting key；**1 个有 UI 无读取**（`allowProgressBarSeek`，`Appearance.tsx:122` 有 ToggleRow，`SeekBar.tsx:32` 的 `disabled` 无人传）+ **10 个有读取无 UI** |
| 协议 / 隐私 | **15** | `PactModal` 已注册（`registerScreens.tsx:43`），`showPactModal` 仅在 `core/common.ts:89` 定义，**全仓零调用**；`common.isAgreePact` 默认 `true`（`defaultSetting.ts:9`） |
| 死代码治理 | 50 | 37 个零引用文件（`PlayerDetailSheet`、`common/Popup`、`Setting/settings/Player/index.tsx`、`localLibrary/idMigration.ts`、`nativeModules/cryptoTest.ts` 等）；58 处空 catch；`musicSdk/xm.js:18-41` 仍 5 个 `Promise.reject(new Error('fail'))` 桩；`Download/index.js` 与 `index.tsx` 并存 |
| 测试 / 验证 | 65 | `tests/` 7 文件 **32 用例**（db-row、http-host、language、local-library-a2、library-index、local-music、tag-compare），实测 32/32；CI 已接入；**无 UI/E2E**，`smoke.js:20-24` 仍写「常驻 loop 永不 idle、下载链路只能手动」 |

### 2.2 关键判断：三处「看起来完成、实际没接线」

这是本轮最需要决策层注意的模式，三处形态一致 —— **代码写好了、开关存在、但没有调用方**：

| 能力 | 完成的外观 | 实际状态 |
|---|---|---|
| SQLite 切读 | 表、影子表、读源开关、对比函数都齐 | `setReadSource` 零调用，永远读 JSON；DB 分支死代码 |
| 底栏拖动进度 | 设置里有「底栏进度条可拖动」开关 | 无任何读取点；`BottomNav.tsx:155-159` 只有滑动切歌，没有拖动进度 |
| 协议弹窗 | 组件注册、导航方法、设置项都在 | `showPactModal` 零调用，默认已同意 |

---

## 3. 3.8.8 遗留项闭环核对

| 遗留项 | 状态 | 证据 |
|---|---|---|
| 协议/隐私弹窗不可达 | ❌ **原样未动**（跨 45 个版本） | 同 §2.1；`isAgreePact` 仍默认 true |
| `allowProgressBarSeek` 孤儿 | ❌ **原样未动**（还新增了一个无效 UI 入口） | `Appearance.tsx:122` 有开关，无读取 |
| APE/WMA/DSF/DFF 能入库不能解码 | 🟡 **部分改善** | 列表已加「可能不支持」角标（`LocalMusic/index.tsx:2300`），解码能力未变 |
| 无自动化测试 | 🟡 **部分闭环** | 0 → 7 文件 32 用例 + CI；仍无 UI/E2E，smoke 限制未解 |
| 32 个零引用 + xm 桩 | ❌ **未收敛**（37 个，反而更多） | 见 §2.1 死代码治理 |

**闭环率 0/5 完全闭环。** 值得肯定的是：3.8.8 的「README 封面取色承诺失实」已诚实修正为「当前**不做封面取色**」，胶囊光带下线也写进了 README（`README.md:85,90`）—— 这说明文档纠错机制是有效的，只是没覆盖到协议与读源。

---

## 4. UI / UX 完成度

### 4.1 设置页 S-01~S-15 逐条核实

`doc/design-audit-settings-ui.md` 列的 15 项，**5 项真修复、9 项部分、1 项未修**：

| ID | 判定 | 证据 |
|---|---|---|
| S-01 首页是「我的」品牌页 | ✅ 已修复 | `Mine/index.tsx:18-42`：64dp 页头 + 22sp「设置」，无 logo/光晕/slogan |
| S-02 8 个彩虹色图标 | ✅ 已修复 | `screenMeta.ts` 已删除，`Grid.tsx:21-29` 无 icon/color 传参 |
| S-03 大卡套控件 | ✅ 已修复 | `Grid.tsx:19-31` 平铺 9 个 Section |
| S-04 二级页 24dp 大卡嵌套 | ✅ 已修复 | Refactored 页 0 处 radius 24；仅旧 `Section.tsx:121` 残留 |
| S-05 字号无 scale | 🟡 部分 | `designTokens.ts:15-23` 有 7 档 Type，设置页仍 18 种 size（13.5/10.5 各 2 处） |
| S-06 新旧组件并存 | 🟡 部分 | 新 79 次 / 旧 22 次；`SettingRow/ChoiceItem/Slider/InputItem` 引用为 0 但**文件未删** |
| S-07 分割线/padding 不统一 | 🟡 部分 | `Section.tsx:127` marginLeft 20 vs `ui/index.tsx:53` Space.lg=16；padding 16×11 / 18×1 / 20×3 |
| S-08 三套页头 | 🟡 部分 | 64/22（设置首页）、58+sb/40 返回/22（深页）、72/21（`PageHeader.tsx:17`） |
| S-09 触控目标 <48dp | 🟡 部分 | `ui/index.tsx:247,279` 32+hitSlop8 达标；`Chip.tsx:103` 高 30 无 hitSlop |
| S-10 权限项重复 | ✅ 已修复 | 仅 `DownloadStorage.tsx:126`；`System.tsx:21` 注释已声明去重 |
| S-11 图标语义混用 | ✅ 已修复 | 分类彩图标源已删，`play` 5 处全实心 |
| S-12 弹窗 5 套 | ❌ 未修 | ActionSheet 16、Modal 54、Dialog 7、AppDialog 2、confirmDialog 63、tipDialog 22；设置内仍 ActionSheet 12 + Modal 20 |
| S-13 玻璃 tint 写死 | 🟡 部分 | `getGlassTint`（`designTokens.ts:57`）**0 引用**；`PageHeader.tsx:71` 仍写死 `rgba(255,255,255,0.34)` |
| S-14 信息架构分散 | 🟡 部分 | `Grid.tsx:21-29` 实际 **9 组**（文档称 11 组）；下载/音源只在页头图标（`Mine:32-34`） |
| S-15 硬编码色 | 🟡 部分 | 设置目录 103 → **19** 处（大幅改善）；全仓 screens+components 仍有 **249** 处 |

### 4.2 设计系统落地

- `design/DESIGN-SYSTEM.md`（18KB）存在，`src/theme/designTokens.ts` 被 **18 个文件**引用，方向正确。
- **但两套组件体系仍在**：旧 `Section / CheckBoxItem / SubTitle / Slider / ChoiceItem / InputItem / Toggle` 全部留在 `Setting/components/`，其中 4 个已零引用却未删除；`Vertical/NavList.tsx` 为 0 引用死文件。
- `src/theme/motion.ts` 定义 7 时长 / 5 曲线 / 2 弹簧，**仅 2 个文件 import**（`SeekBar.tsx:4`、`utils/playerTransition.ts:4`），`Setting/Main.tsx:70` 仍写裸 `200`。令牌建了但没成为唯一来源。

### 4.3 动效

| 项 | 结论 | 证据 |
|---|---|---|
| 原生驱动 | 优 | `useNativeDriver` true 82 / false 4（95.3%） |
| 转场与手势 | 优 | 播放器转场三段插值；封面下滑跟手 `setValue`，阈值 70dp / vy 0.45（`Player/index.tsx:806-856`）；返回手势 4dp 捕获、25% 关闭（`useSwipeBack.ts:44-48`） |
| 常驻动画 | 有治理 | `Animated.loop` 12 处（`BigCard.tsx:98,189,268,275,282,399,463`、`AlbumDiscSpin.tsx:136,153`、`AlbumDiscButton.tsx:56`、`MarqueeText.tsx:49`、`Skeleton.tsx:42`）；`useIdleMotion.ts:14` 空闲暂停、`BigCard.tsx:520-525` idleMotion 门控 |
| 减少动态效果 | **已实现** | `Appearance.tsx:91` ToggleRow + `useReducedMotion.ts`（9 个消费点）+ `playerOpen.ts:133` 转场直接切页 |
| 动效覆盖 | 不均 | 仍集中在首页卡片、导航、圆盘、播放器；列表页与设置页几乎无过渡 |

### 4.4 交互反馈与可用性

- **骨架屏**：已有通用组件（`Skeleton.tsx`：SkeletonRows/Grid/Block），是 3.8.8 之后的明确进步。
- **三态容器**：`StateContainer.tsx` 建好了，**全仓仅 1 处引用**（`Songlist/List.tsx:166`），空态仍靠各页自写（「暂无」4 文件、「重试」2 文件）。
- **键盘适配**：`KeyboardAvoidingView` **0 处**，依赖 Manifest `adjustNothing` + 手工 insets，风险仍在。
- **下拉刷新**：实际仅 2 处（本地音乐、歌单）；`onEndReached` 5 处。
- **触控热区**：新组件 32+hitSlop8=48 达标；`Chip` 30 无 hitSlop、`Appearance` 分段 32 无 hitSlop，仍不达标。
- **横屏设置**：**已实现**主从布局（190dp 分类栏 + 内容区，`Vertical/Main.tsx:176-200`），可用；但**不是**设计系统文档 §9 描述的「两列瀑布 5+6 组」。

### 4.5 无障碍与 i18n

- `accessibilityLabel` **86 处**、`accessibilityRole` **80 处**（3.8.8 时为 13 处），是明显进步。
- **无 `allowFontScaling` / `maxFontSizeMultiplier`**（0 处），仅自研倍率（`Text.tsx:55-70`），档位到 130%；固定高 30dp 的 chips + `numberOfLines=1` 在大字号下有裁切风险。
- 三语各 **524 条完全一致**；但界面硬编码中文约 **1,501 行 / 133 文件**，英文/繁体体验仍不完整。

### 4.6 性能与视觉一致性

- 巨型文件：`theme/themes/themes.ts` 4,540 行、`LocalMusic/index.tsx` **2,868** 行、`Player/index.tsx` **2,326** 行。
- 硬编码色：screens+components 共 **249 处**，Top 为 `Player/index.tsx:49`、`BigCard.tsx:23`、`Favorites.tsx:15`。
- 图片缓存：`Image.tsx:5` 把 RN `Image` 别名成 `FastImage`，`react-native-fast-image` **被注释**；`:52-58` 传的 `cache: 'force-cache'` 是 fast-image 的 API，对 RN `Image` **无效** —— 实际依赖 Fresco 默认缓存，无显式策略与清理入口。
- 定时器/监听：`setTimeout` 86 vs `clearTimeout` 48、`setInterval` 9/9、`addEventListener` 41 vs remove 35，清理率较 3.8.8 有改善但仍不完整。
- 玻璃：`GlassBlurView` 为真实实现（快照 + RenderEffect + 双档降帧），非伪模糊。

### 4.7 UI/UX 评分

| 维度 | 分 | 依据 |
|---|---:|---|
| 设置页重构 | 82 | S-01/02/03/04/10 真修复，S-05~09 残留，S-12 未修 |
| 设计系统 | 72 | token 18 文件引用；旧组件未删；motion 令牌仅 2 处引用 |
| 动效 | 80 | 转场/手势优秀，95.3% 原生驱动，减少动效+空闲暂停已实现 |
| 交互反馈 | 65 | Skeleton 有了但 StateContainer 仅 1 用；无键盘适配；弹窗 5 套 |
| 无障碍 / i18n | 55 | 标签 86（大幅提升）；无 fontScale 兜底；硬编码中文 1,501 行 |
| 性能 / 玻璃 | 82 | 自研模糊有降帧；图片缓存失效；巨型文件 |
| 文档可信度 | 58 | 见 §5 |
| **综合** | **74** | 视觉骨架成型，系统化与细节未闭环 |

---

## 5. 文档可信度（本轮新增维度）

| # | 文档声称 | 代码实际 | 影响 |
|---|---|---|---|
| 1 | `readSource.ts` 文件头：「R1 起默认读 SQLite」 | 同文件 `:18` 注释与 `:17-22` 代码：**默认 JSON**，需显式切换 | 同一文件自相矛盾，接手者极易误判数据源 |
| 2 | 设计系统 §9：横屏「左列 5 组 + 右列 6 组，两列瀑布」 | `Vertical/Main.tsx:176-200` 是 **190dp 主从导航** | 验收时按文档会判「未实现」，实际是另一种方案 |
| 3 | 设计系统 §9 与 `Grid.tsx` 提及 **11 组** | 实际 **9 组**（`Grid.tsx:21-29`） | 信息架构口径不一致 |
| 4 | README badge 版本 **3.41.0** | 实际 **3.54.0** | 对外展示失真 |
| 5 | README 构建环境「React Native **0.76.9**（旧架构 + Hermes）」 | 实际 **0.80.3 新架构** | 构建指引会误导 |
| 6 | README 产物名 `em-music-v3.6.15-*.apk` | 实际 `EmoMusic-v3.54.0-{arm64-v8a,armeabi-v7a,universal}.apk` | 找不到产物 |
| 7 | README 目录结构仍列 `CapsuleProgress`、`theme/ 主题与播放器取色` | 组件已删；明确「不做封面取色」 | 陈旧 |
| 8 | backlog P0-5「7 个测试文件 / 32 用例」 | 实测 **32/32** | ✅ 属实 |
| 9 | README「不做封面取色」「胶囊光带已下线」 | 与代码一致 | ✅ 已纠错，值得肯定 |

> 结论：**文档在「功能描述」上大体可信，在「版本号、构建环境、产物名、布局方案」上系统性滞后**。建议把 README 的版本号改为从 `package.json` 读取或发版脚本自动替换，否则每版都会漂移。

---

## 6. 静态检查与发布状态（本次实测）

| 项 | 结果 |
|---|---|
| `npm run typecheck` | ✅ **0 error** |
| `npm run lint` | ✅ **0 error / 2 warning**（`Player/index.tsx:461,463` 的 `react-hooks/exhaustive-deps` 多余依赖） |
| `npm run test:unit` | ✅ **32 pass / 0 fail**（8.0s） |
| 代码规模 | 653 个 TS/TSX/JS 文件 / **90,627 行**（3.8.8 时为 638 / 82,055） |
| 文档规模 | `doc/` 199 项，含设计系统、视觉审计、新架构评估、backlog |
| 产物 | `dist/` 中 3.54.0 三 ABI 齐全（2026-11-10 01:24）+ 7 份 `SHA256SUMS-*.txt` |
| 更新元数据 | `publish/version.json` = 3.54.0，与 `package.json` 一致 |
| git | HEAD `68cd8622` = tag `v3.53.1`；3.54.0 **未提交、未打 tag**（仅 3 文件改动） |
| CI | `check.yml`（vendor:check + typecheck + lint + test:unit）、`build-test.yml`（lint + build + test）已接；`release.yml` 有 `HAS_KEYSTORE` 判断 + `softprops/action-gh-release`，但**需配置 Secrets 才生效**，当前仍靠本地发版 |
| 权限 | `MANAGE_EXTERNAL_STORAGE`、`REQUEST_INSTALL_PACKAGES`、`POST_NOTIFICATIONS`、`FOREGROUND_SERVICE(_MEDIA_PLAYBACK)` 等保留 |

---

## 7. 问题清单

| # | 级别 | 问题 | 证据 | 建议 |
|---|---|---|---|---|
| 1 | **P0** | 首启协议/隐私不可达，默认已同意（跨 45 版未修） | `registerScreens.tsx:43`、`core/common.ts:89`、`defaultSetting.ts:9` | 接回 `showPactModal` 到首启或「关于」入口；否则删除组件与设置项，避免假能力 |
| 2 | **P0** | SQLite 切读未接线，DB 分支不可达 | `readSource.ts:17-22`、`setReadSource` 零调用 | 加设置入口 + 迁移完成后自动切换 + 失败回退 JSON + 对比数据看板；先修注释矛盾 |
| 3 | **P0** | SAF `content://` 删除静默失败，文件残留且不回滚 | `download/index.ts:840-843,504` | 走 SAF 文档删除 API；失败提示 + 保留任务 + 不回滚状态；补单测 |
| 4 | P1 | `allowProgressBarSeek` 有 UI 无读取，开关无效 | `Appearance.tsx:122`、`SeekBar.tsx:32` | 接线到 `SeekBar` 或删除开关（连同 `IsAllowProgressBarSeek.tsx` 死文件） |
| 5 | P1 | 10 个设置项「有读取无 UI」 | `isAgreePact/autoHidePlayBar/drawerLayoutPosition/useSystemFileSelector/alwaysKeepStatusbarHeight/togglePlayMethod/volume/hideBgDark/dynamicBg/fontShadow` | 逐项决定「补 UI」或「删 key」，写进设置清单文档 |
| 6 | P1 | 文档系统性滞后（7 处） | §5 | README 版本号/产物名/构建环境改为脚本注入；设计系统文档补「实现方案与文档差异」小节 |
| 7 | P1 | 死代码 37 个零引用 + 58 空 catch + 5 个 xm 桩 + `Download` 双入口 | §2.1 | 分两批删；`xm.js` 桩改为明确「不支持」错误码 |
| 8 | P1 | 交互反馈未铺开：`StateContainer` 仅 1 处、`KeyboardAvoidingView` 0 处、弹窗 6 套 | §4.4 | 三态容器铺到本地音乐/下载/排行榜/歌单广场；键盘用统一 hook；弹窗收敛为 BottomSheet + AppDialog 两套 |
| 9 | P1 | 无障碍缺 fontScale 兜底，固定高 chips 大字号裁切 | `Text.tsx:55-70`、`Chip.tsx:103` | 补 `maxFontSizeMultiplier` 与自适应高度；130% 下逐页走查 |
| 10 | P2 | 图片缓存参数无效（fast-image 被注释回退 RN Image） | `Image.tsx:5,52-58` | 恢复 fast-image 或显式用 Fresco 磁盘缓存 + 清理入口 |
| 11 | P2 | `motion.ts` 令牌仅 2 文件引用 | `SeekBar.tsx:4`、`playerTransition.ts:4`、`Main.tsx:70` | 把时长/曲线改为必须从令牌取，禁止裸数字 |
| 12 | P2 | 巨型文件（2,868 / 2,326 / 4,540 行） | §4.6 | 先拆 `LocalMusic/index.tsx` 的列表与扫描视图 |
| 13 | P2 | 音效三缺一：Gapless / ReplayGain / EQ 未实现 | 全仓零命中 | 与 v3.9–v4.0 说明书的阶段 C 合并规划，不单独排期 |
| 14 | P2 | CI Secrets 未配置，自动 Release 未启用 | `release.yml:18,28-82` | 配置 `KEYSTORE_*` 后跑一次完整发版演练 |
| 15 | P2 | 迁移仅 dry-run，`migration_state` 空转 | `migrate.ts:40-48` | 补迁移状态机 + 中断恢复 + 回滚演练 |

---

## 8. 整改路线图

**批次 A · 合规与发布（建议 1 周内）**
协议弹窗接回 → README 版本/构建环境/产物名三处修正（改为脚本注入）→ 配置 CI Secrets 并演练一次自动 Release → 3.54.0 提交打 tag。

**批次 B · 数据层与文件安全（2 周）**
`setReadSource` 接线 + 切读开关 + 自动切换与回退 → 迁移状态机与回滚演练 → SAF 删除走文档 API + 失败提示 + 单测。

**批次 C · 体验一致性（2–3 周）**
`StateContainer` 铺开四页 → 键盘统一 hook → 弹窗收敛 → `fontScale` 兜底与 130% 走查 → 触控热区补齐 → 旧组件删除。

**批次 D · 技术债（穿插）**
37 零引用清理 → `xm.js` 桩转错误码 → `motion.ts` 令牌强制 → 拆 `LocalMusic/index.tsx` → 图片缓存策略。

---

## 9. 附录

### 9.1 静态指标

| 指标 | 值 |
|---|---|
| 版本 / versionCode | 3.54.0 / 362 |
| TS/TSX/JS 文件 / 行数 | 653 / 90,627 |
| 设置 key | 65 |
| 单测文件 / 用例 | 7 / 32（全通过） |
| 零引用文件 / 空 catch / TODO | 37 / 58 / 7 |
| `useNativeDriver` true / false | 82 / 4 |
| `Animated.loop` | 12 |
| `accessibilityLabel` / `accessibilityRole` | 86 / 80 |
| i18n 条目 | 524 × 3（一致） |
| 硬编码色（screens+components） | 249 |
| 硬编码中文 | 约 1,501 行 / 133 文件 |
| 最大文件 | themes.ts 4,540 / LocalMusic 2,868 / Player 2,326 |

### 9.2 审计边界与未验证项

- **未连接真机**：所有运行时行为（新架构首帧、模糊性能、横屏主从、大字号、SAF 删除、读源切换）均只有代码证据，不代表真机通过。`doc/design-system-implementation.md` 自述 ADB 曾掉线、横屏与大字号**未验证**。
- 单测只覆盖纯逻辑（扫描差异、M3U、格式映射、DB 行映射等），**不覆盖 UI 与原生**。
- `smoke.js` 的 idle 限制仍在，端到端冒烟不具备无人值守能力。
- 评分口径为「用户可达 + 代码取证」，不是测试通过率；若按「有自动化覆盖」计分，功能分会显著低于 78。

### 9.3 主要证据路径

`package.json` · `CHANGELOG.md` · `doc/audit-report-3.8.8.md` · `doc/design-audit-settings-ui.md` · `doc/design-system-implementation.md` · `doc/backlog-after-3.50.md` · `design/DESIGN-SYSTEM.md` · `src/core/localLibrary/{repository,migrate,shadow,readSource}.ts` · `src/core/localMusic/index.ts` · `src/core/download/index.ts` · `src/screens/Home/Views/{Mine,Player,LocalMusic,Download,Setting}/*` · `src/components/common/{Image,StateContainer,Skeleton,Text,Chip}.tsx` · `src/theme/{designTokens.ts,motion.ts}` · `src/navigation/{registerScreens.tsx,utils.ts}` · `src/core/common.ts` · `android/.../blur/GlassBlurView.java` · `tests/*.test.js` · `.github/workflows/{check,build-test,release}.yml`

---

**一句话总结**：这 4 天的迭代质量不低 —— 新架构、设置页、曲库影子表、测试从 0 到 32 都是实打实的进步；但项目已经进入「能力越写越多、接线和文档跟不上」的阶段，下一轮的价值不在新增功能，而在**把三个「有开关没接线」补上、把文档拉回与代码一致、把合规链路接回去**。
