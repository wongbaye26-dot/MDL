# EmoMusic v3.8.6 功能完成度审计报告

- 审计对象：`EmoMusic`（Android 客户端，基于 lx-music-mobile v1.9.2 二次开发）
- 代码基线：`f722339a`（v3.8.6，versionCode 188；HEAD 2026-11-05 22:31 +07）
- 审计时间：2026-11-06（Asia/Bangkok）
- 审计方式：仓库静态审计 + 代码路径核验 + 文档/发布物核对 + 静态检查复跑（tsc / eslint / vendor check）+ APK 元数据与签名核验
- 审计边界：本轮 `adb devices` 为空，**未做新的真机功能复测**；真机结论引用既有 `doc/qa-3.7.0.md`、`doc/qa-3.8.0.md` 与 `.tmp-verify/` 截图证据
- 结论一句话：**核心功能交付度很高（约 89%），但“上线完成度”被 6 个断链点和发布/质量门禁问题拉低；当前最大问题不是功能没做，而是“做了但没接线、没更新、没验证”。**

---

## 1. 总体评分

| 维度 | 得分 | 主要依据 |
|---|---:|---|
| 功能交付（已承诺/已上线） | **89** | 播放、本地曲库、在线检索/榜单/歌单、下载、歌词、搜索、收藏、主题、横屏均可到达；桌面歌词等 6 处断链单列 |
| 视觉 / 交互一致性 | **90** | Material You 主题、横屏/竖屏、播放器转场、胶囊/圆环、3.8.x 的列表与页头统一 |
| 稳定性 | **82** | 3.7.0/3.8.0 真机无 P0/FATAL；但原生补丁、第三方音源、音频输出是外部风险 |
| 代码质量 / 可维护性 | **74** | tsc 0、TS/TSX eslint 0；但全量 lint 失败、巨型文件、159 处 `any`、477 处 console |
| 测试 / 自动化 | **30** | 无单元/集成测试；`smoke.js` 需真机 adb；CI 只有静态检查 |
| 文档 | **75** | release notes 完整；README 停在 3.6.15，审计/已知限制滞后 |
| 发布 / 签名 | **85** | 3.8.6 三包齐全、签名正常、versionCode 单调；更新链路和 tag 有缺口 |
| 安全 / 合规 | **60** | `MANAGE_EXTERNAL_STORAGE`、`SYSTEM_ALERT_WINDOW`、`REQUEST_INSTALL_PACKAGES`；隐私政策/协议页不可达 |
| **综合（个人侧载）** | **78 / 100** | 可用，但“更新、CI、测试、死功能”四项拉低 |
| **综合（应用商店）** | **约 52 / 100** | 权限、隐私、测试、无人值守更新是硬伤 |

> 计分口径：功能完成度按“用户能从 UI 到达并使用”计算；只有代码、没有入口的功能记 0。若把仓库残留但不可达的功能计入分母，全仓库功能完成度约 **80%**。

---

## 2. 功能完成度总览

### 2.1 已交付 / 基本可用

| 功能域 | 完成度 | 关键证据 | 备注 |
|---|---:|---|---|
| 播放内核与播放器 | 95% | `src/core/player/*`、`src/plugins/player/*`、`src/screens/Home/Views/Player/index.tsx`；QA 3.8.0 切歌 ≈0.54s | 本地/在线统一、队列、四种播放模式、进度拖动、缓存预取、失败重试/换源 |
| 通知 / 锁屏 / 媒体会话 | 85% | `src/plugins/player/notification.ts` + `dependencies-patch.js` 原生补丁 | 收藏/循环按钮、主题色、Material 图标；依赖 vendor 补丁锚点 |
| 本地导入 / 扫描 / 自动入库 | 93% | `src/core/localMusic/index.ts`、`src/utils/directoryPicker.ts` | SAF 多目录 + MediaStore + 目录直读三路合并；下载完成自动入库 |
| 本地元数据 / 封面 / 标签 | 90% | `vendor/react-native-local-media-metadata`、`src/utils/flacTag.ts`、`LocalMusic/SongInfoPage.tsx` | 读写歌名/歌手/专辑/碟号、内嵌封面、LRC；封面三级兜底 |
| 音乐工具 | 92% | `Setting/settings/Tools/*` | 曲库体检 9 项、一键修复、重复清理、批量重命名、封面/歌词/标签工具 |
| 在线检索 / 榜单 / 歌单 | 88% | `src/utils/musicSdk/{kw,kg,tx,wy,mg}`、`core/leaderboard.ts`、`core/songlist.ts` | 内置适配器负责检索/榜单/歌单；**播放地址依赖用户导入源** |
| 下载 | 92% | `src/core/download/*`、`android/.../download/DownloadTask.java` | 多音质、2~4 连接分段、断点续传、并发自适应、边听边存、格式校验/改名 |
| 歌词 | 90% | `src/plugins/lyric.ts`、`src/core/lyric.ts`、`Player/index.tsx` | 逐行/逐字、翻译、注音、粤拼、繁简、字号、单行、横屏、蓝牙歌词 |
| 搜索 | 90% | `Search/*` | 热词/历史/联想、歌曲与歌单、聚合源、分页 |
| 收藏 / 自建歌单 | 90% | `Mylist/*`、`Backup/actions.ts` | 收藏、试听列表、新建/重命名/排序/移动/导入导出/重复清理、在线歌单同步到本地 |
| 首页 / 主题 / 横屏 | 92% | `Home/Views/Home/*`、`Setting/settings/Basic/ThemeSettings.tsx`、`Horizontal/*` | 最近播放 20、最近添加、四卡动效、Material You 种子色/系统取色、字体、三语 |
| 设置 / 音源管理 | 88% | `Setting/settings/Source/*` | 8 个设置页、源导入（在线/本地）、启停删、音质矩阵、实测、检查更新状态 |
| 系统集成 / Android 16 | 85% | `android/app/build.gradle`、`doc/android-16-compat.md` | targetSdk 36、edge-to-edge、FGS、分屏/小窗、深链/文件打开 |

### 2.2 部分完成 / 有条件

| 功能域 | 完成度 | 说明 |
|---|---:|---|
| 本地库管理 | 88% | 5 个页签、页内搜索；缺排序入口、专辑艺术家、隐藏歌曲/文件夹、文件名搜索、CUE/M3U 导入 |
| 在线播放 / 换源 | 85% | 换源/失败重试/缓存预取已有；QA 3.7.0 对“UI 换源提示”只拿到部分证据 |
| 本地格式兼容 | 55% | `AUDIO_EXT` 收 APE/WMA/DSF/DFF，但播放内核 Media3 1.8 无对应 extractor；存在“能入库、点播放报错”的风险（见 P1-3） |
| 系统集成 | 85% | Android 16 兼容完成；16KB 页大小未处理（文档已列为已知限制）；预测性返回仍靠 opt-out |
| i18n | 75% | 3 语言 × 604 key 完全对齐；但 TS/TSX 中约 1,261 行含中文（含行内注释/Toast），英文体验不完整 |
| 无障碍 | 20% | 全仓 `accessibilityLabel` 仅 12 处；无 TalkBack/大字体验收记录 |

### 2.3 断链 / 未交付（按“用户能否到达”记 0）

| # | 功能 | 完成度 | 证据 | 影响 |
|---|---|---:|---|---|
| 1 | 应用内更新 / 协议弹窗 | **0** | `src/core/init/index.ts:18` 注释明确“不再展示首次启动的协议与提示弹窗”；`checkUpdate` 仅在 `PactModal.tsx:91` 调用，而 `PactModal` 无调用方；`publish/version.json` 停在 **3.6.4** | 用户无法在 App 内检查更新；协议/隐私提示也不可达 |
| 2 | 评论 | **0** | `navigation.ts:254` 定义 `pushCommentScreen`，全仓 0 调用；`registerScreens.tsx:46` 仍注册 `Comment` | 完整评论页 + 各源 comment 适配器成为死代码 |
| 3 | 桌面歌词 | **0** | `Setting/settings/LyricDesktop/*` 不在 `SETTING_SCREENS`（`Setting/Main.tsx:16`）；`DesktopLyricEnable` 只被这个死页面引用；`core/desktopLyric.ts` + 原生 `LyricModule` 仍在 | README:44 仍写“支持桌面歌词”；`SYSTEM_ALERT_WINDOW` 权限为死功能保留 |
| 4 | 同步（lx sync） | **0** | `sync.enable` 默认 false（`defaultSetting.ts:75`）；8 个设置页无同步入口；`SyncModeModal` 无触达路径；`plugins/sync` 整套客户端保留 | 上游同步能力不可用，属于死代码/半成品 |
| 5 | 定时退出 / 睡眠定时 | **0** | `components/TimeoutExitEditModal.tsx` 全仓无引用；`core/player/timeoutExit.ts` 只被该组件引用 | 设置项 `player.timeoutExit` 无 UI，功能不可达 |
| 6 | 备份 / 恢复设置页 | **0** | `Setting/settings/Backup/index.tsx` 未被任何页面 import；`SETTING_SCREENS` 不含 `backup` | 备份页不可达；`Backup/actions.ts` 被歌单导入导出复用，属“半死” |
| 7 | 倍速播放 | **0** | `player.playbackRate` 只在 `core/player/player.ts:396` 初始化读取；无设置项/控件 | 底层支持但用户无法调整 |

> 另有 4 个零引用死设置：`common.showBackBtn`、`common.showExitBtn`、`list.isShowSource`、`list.isSaveScrollLocation`（`defaultSetting.ts` 中仍保留，类型/迁移也在）。

### 2.4 验证完成度（不是功能完成度）

| 验证项 | 状态 | 证据 |
|---|---|---|
| 3.7.0 真机验收 | ✅ 164 文件证据 | `doc/qa-3.7.0.md`、`.tmp-verify/qa-3.7.0/`；P1×2、P2×2 |
| 3.8.0 真机验收 | ✅ 144 文件证据 | `doc/qa-3.8.0.md`、`.tmp-verify/qa-3.8.0/`；10 项、P1×1（下载徽章截断） |
| 3.8.1–3.8.6 验收 | ⚠️ 仅 release notes + 截图 | 7 份 `doc/release-notes-3.8.*.md`；`.tmp-verify/v3.8.1…v3.8.6`；无正式 QA 文档 |
| 3.8.0 遗留 P1 闭环 | ⚠️ 代码已修，缺正式复测 | `TaskItem.tsx` 的 `getQualityTextWidth` 显式宽度已上线；3.8.1 notes 声称修复 |
| 3.8.0 遗留 P3 闭环 | ⚠️ 未见逐条说明 | 下载历史升级后清空、重命名预览、空结果“清空搜索”按钮；release notes 未逐项闭环 |
| 自动化回归 | ❌ 无 | 无 Jest/集成测试；`smoke.js` 依赖 adb 真机，未进 CI |

---

## 3. 关键发现

### P1-1 应用内更新链路完全不可达（且数据源过期）

- `src/core/init/index.ts:18` 明确注释“下载器定位：不再展示首次启动的协议与提示弹窗”。
- 全仓唯一会主动调用 `checkUpdate()` 的是 `PactModal.tsx:91`，但 `PactModal` / `showPactModal()` 没有任何调用方；`VersionModal` 又只在“已发现更新”后才会出现，形成闭环。
- 即使入口存在，`src/utils/version.js:10` 读取的 `publish/version.json` 内容仍是 **3.6.4**，而 App 是 3.8.6，比较结果会直接判定“已是最新”。
- `publish/version.json` 最后一次变更在 **v3.6.5** 提交；`scripts/release.js` 的出包流程不会更新它，`publish/index.js` 的更新脚本也不在发布流程里。
- 结论：**更新功能不是“没做好”，而是“没接线 + 数据过期”**。同时协议弹窗也不可达，合规上需要明确这是“主动放弃”还是遗漏。

### P1-2 `npm run lint` 失败，CI 质量门禁与实际发布流程不一致

```
npm run lint  → 1251 problems (1251 errors, 0 warnings)  exit 1
```

- 错误全部来自 `src/utils/jyutping/index.js`（388 KB 压缩词典）：`.eslintignore` 不存在，`.eslintrc.cjs` 的 `ignorePatterns` 也未排除它。
- `npx eslint src --ext .ts,.tsx` 是 0 问题——说明 **TS/TSX 代码本身是干净的**；问题在“全量 JS 也被 lint”。
- `.github/workflows/check.yml:45` 明确执行 `npm run lint`；按当前仓库内容，CI 的 Check 工作流应当失败。
- `scripts/release.js` 的前置检查只跑 `tsc` 和 `dependencies-patch --strict`，不跑 eslint，所以 CI 红灯并不阻塞出包——质量门禁名存实亡。
- 修正成本很低：把 `src/utils/jyutping/index.js` 加进 `ignorePatterns`/`.eslintignore`，或对单文件 `/* eslint-disable */`；再把 lint 加进 `release.js` 前置检查。

### P1-3 本地扫描格式与解码能力不一致

- `src/core/localMusic/index.ts:55`：
  `AUDIO_EXT = ['mp3','flac','m4a','aac','wav','ogg','ape','wma','opus','dsf','dff']`
- 播放内核是 RNTP 2.1.2 fork + **Media3 1.8.0**（`vendor/react-native-track-player/android/build.gradle:64`），没有 FFmpeg 扩展。
- Media3 官方 progressive 容器支持列表不含 **APE / ASF(WMA) / DSF / DFF**（[Android Media3 supported formats](https://developer.android.com/media/media3/exoplayer/supported-formats)）。
- 结果：这 4 类文件可以被扫描入库，但点播放会走“音频加载出错，5 秒后切换下一首”（`src/lang/zh-cn.json:205`）。
- 这与 Salt Player 的“格式矩阵”形成对比：对方是用自研 extractor/decoder 补的（12.6.0 才补 WMA），不是加扩展名就能解决。建议先做“可播放格式”标注/移除，再谈解码扩展。

### P1-4 桌面歌词：README 承诺 vs 实现不可达

- `README.md:44` 仍写“歌词页：逐行高亮、字号可调、**支持桌面歌词**”。
- 实际 `SETTING_SCREENS` 只有 8 项（`Setting/Main.tsx:16`），没有 `LyricDesktop`；`components/DesktopLyricEnable.tsx` 只被这个死页面引用。
- `src/core/desktopLyric.ts` + `android/.../lyric/LyricModule.java` + 悬浮窗权限都还在；`SYSTEM_ALERT_WINDOW` 权限因此成为“为不存在入口保留的权限”。
- 二选一：恢复播放器菜单入口并做真机验证；或删掉 README 承诺、删 `SYSTEM_ALERT_WINDOW` 与死页面。

### P1-5 死功能/死代码堆积，维护成本被低估

- 评论页 + 5 个源的 comment 适配器、lx 同步客户端（auth/client/modules）、桌面歌词一套 native/JS、定时退出、备份设置页。
- 死设置 4 个（零引用）+ 半死设置若干（`player.playbackRate`、`desktopLyric.*`、`sync.enable`）。
- 这些代码会持续被“顺手改到”：改主题、改发送队列、改设置结构时都要为它们做兼容，形成隐性回归面。
- 建议做一次“功能去留”决策：要么接回入口，要么删除代码 + 类型 + 迁移分支 + 权限 + README 承诺。

### P1-6 无自动化测试，回归靠人眼

- `package.json` 无 `test` 脚本；仓库无 `__tests__` / `*.test.*`。
- `scripts/smoke.js` 通过 adb 做启动/扫描/播放三条冒烟，但**依赖真机+已安装+本地有歌**，没进 CI；本轮 `adb devices` 为空，无法复跑。
- 现有 QA 是人工截图 + 日志（3.7.0 / 3.8.0），3.8.1–3.8.6 只有 release notes 声称“tsc 0 / 改动文件 eslint 0 / FATAL 0”。
- 风险最高的链路：原生补丁（通知按钮）、下载格式判定/改名、本地扫描三路合并、歌词时间轴重建——都没有单测或固定回归脚本。

### P2-1 文档/版本漂移

- `README.md:8` 版本徽章仍是 **3.6.15**；功能列表停在 3.6 代，未收录 3.7/3.8 的源管理、音乐工具、搜索、Material You 设置等。
- `README` 的“已知限制”只有 3 条（仅 Android / 第三方音源 / 通知遮挡），未提桌面歌词不可达、更新不可用、APE/WMA/DSD 解码限制。
- `doc/audit-report-3.5.15.md` 已过期；本报告是新的基线。
- 本地 git 没有 v3.x tag（只有上游 v1.8.x/v1.9.2）；发布 workflow 会在 master push 时创建 tag，但仓库内无法直接按版本回溯。

### P2-2 可访问性 / i18n 债务

- `accessibilityLabel` 仅 12 处；无 TalkBack 验收；大字体/颜色对比未覆盖。
- 3 个语言文件 604 key 完全对齐，但约 1,261 行中文散落在 TS/TSX（含 Toast、设置说明、页头文案）；英文/繁体用户会看到中英混排。
- 设置页摘要（`Setting/Vertical/Grid.tsx`）直接写中文，如“逐字歌词开/关”，不走 i18n。

### P2-3 巨型文件 / 类型与日志债务

- `Player/index.tsx` 2,078 行、`LocalMusic/index.tsx` 1,556 行、`Home/BigCard.tsx` 632 行、`Favorites.tsx` 631 行、`Tools/parts.tsx` 611 行。
- 159 处 `any`、114 处 `eslint-disable`、477 处 console（比 3.5.15 审计的 238 处翻倍）。
- 真实 TODO/FIXME 约 9 处（sync 2、music 2、download 1、local 1、list 1、playList 1 等），量不大但集中在数据层/同步。

### P2-4 权限 / 隐私

- `AndroidManifest.xml`：`MANAGE_EXTERNAL_STORAGE`、`SYSTEM_ALERT_WINDOW`、`REQUEST_INSTALL_PACKAGES`、`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` 等。
- 侧载场景合理，但商店审核会重点看；尤其 `SYSTEM_ALERT_WINDOW` 对应的桌面歌词不可达，属于“无使用场景的敏感权限”。
- 无隐私政策页；许可协议弹窗不可达（见 P1-1）；`README`/关于页有免责声明，但不等于隐私政策。

---

## 4. 本次静态检查记录

| 检查 | 结果 | 证据 |
|---|---|---|
| 工作区 | clean，HEAD `f722339a`，v3.8.6 / versionCode 188 | `git status`、`package.json` |
| TypeScript | ✅ `tsc --noEmit` 0 error | `npm run typecheck` |
| ESLint（TS/TSX） | ✅ 0 error | `npx eslint src --ext .ts,.tsx` |
| ESLint（全量） | ❌ 1251 error / exit 1 | `npm run lint`；全部来自 `src/utils/jyutping/index.js` |
| Vendor 补丁 | ✅ 13/13 | `node scripts/check-vendor.js` |
| APK 元数据 | ✅ versionCode 188003 / versionName 3.8.6 / minSdk 21 / targetSdk 36 / arm64-v8a | `aapt dump badging dist/EmoMusic-v3.8.6-arm64-v8a.apk` |
| APK 签名 | ✅ V2，CN=Emo Music | `apksigner verify --print-certs` |
| 产物 | ✅ 3.8.6 arm64 / armeabi-v7a / universal 三包 | `dist/EmoMusic-v3.8.6-*.apk`（17.7 / 16.7 / 21.8 MB） |
| 单元/集成测试 | ❌ 0 | 无 `test` 脚本、无测试目录 |
| 真机 | ⚠️ 本轮不可用 | `adb devices` 为空；引用 3.7.0/3.8.0 QA |

---

## 5. 与 3.5.15 审计的对比

| 维度 | 3.5.15 审计 | 3.8.6 本报告 | 变化 |
|---|---:|---:|---|
| 代码规模 | 530 文件 / 64,611 行 | 665 文件 / 87,017 行 | +25% 文件、+35% 行数 |
| 功能交付 | 92 | 89 | 功能更多，但把断链/死功能纳入口径后下降 |
| 代码质量 | 70 | 74 | tsc/eslint(TS) 保持 0；但 console/any 增加 |
| 测试 | 30 | 30 | 仍无单测；新增 CI 静态检查 |
| 文档 | 78 | 75 | release notes 更完整，README/审计更滞后 |
| 发布 | 88 | 85 | 产物/签名稳定；更新链路与 tag 缺失 |
| 安全 | 60 | 60 | 权限结构未收敛，隐私页缺失 |
| 综合 | 82 | 78 | 更严格、更完整的功能口径 |

---

## 6. 建议路线图

| 优先级 | 动作 | 工作量 | 验收标准 |
|---|---|---|---|
| **P0** | 修更新链路：`release.js` 自动写 `publish/version.json`；在“关于”页加“检查更新”入口，或启动时检查一次 | 1–2 天 | 3.8.6 包能检测到 3.8.7、下载并安装 |
| **P0** | 修 lint 门禁：忽略 `src/utils/jyutping/index.js`；`release.js` 前置加 `npm run lint` | 0.5 天 | `npm run lint` exit 0；CI Check 绿 |
| **P0** | 功能去留：评论/同步/桌面歌词/定时退出/备份页，要么接回入口，要么删代码+类型+权限+README 承诺 | 2–4 天 | 仓库无“注册但不可达”的功能；README 与实现一致 |
| **P1** | 本地格式矩阵：把 `AUDIO_EXT` 与 Media3 能力对齐；UI 标“可播放/仅索引”；加“音频信息/解码能力”页 | 1–2 天 | APE/WMA/DSF/DFF 不再“能扫不能放” |
| **P1** | 补测试：Jest 覆盖文件名/格式/歌词时间轴/下载格式判定；`smoke.js` 进 CI（模拟器/真机池） | 1–2 周 | 核心工具函数有单测；每次发版跑冒烟 |
| **P1** | 每个版本留 QA 文档（3.8.1–3.8.6 只有 release notes） | 0.5 天/版 | 有验收项、证据目录、P0/P1 清单 |
| **P2** | 拆 `Player/index.tsx`、`LocalMusic/index.tsx`；补 i18n、a11y、隐私政策页 | 1–2 周 | 主页面 <800 行；英文路径无明显中文；隐私页可打开 |
| **P2** | 打 v3.8.x tag、更新 README 功能/已知限制 | 0.5 天 | 版本可回溯；README 与 v3.8.6 一致 |

---

## 7. 附录

### 7.1 静态指标

- TS/JS 文件：665；代码行：87,017
- `any`：159；`eslint-disable`：114；`console.*`：477；`accessibilityLabel`：12
- 设置项：79（零引用 4，低引用 12）
- 语言文件：3 × 604 key，缺失 0；TS/TSX 含中文非注释行约 1,261
- 最大文件：`Player/index.tsx` 2,078；`LocalMusic/index.tsx` 1,556；`BigCard.tsx` 632；`Favorites.tsx` 631；`Tools/parts.tsx` 611

### 7.2 死代码/断链证据路径

| 对象 | 路径 |
|---|---|
| 评论页 + 注册 | `src/screens/Comment/*`、`src/navigation/navigation.ts:254`、`src/navigation/registerScreens.tsx:46` |
| lx 同步 | `src/core/init/sync.ts`、`src/core/sync.ts`、`src/plugins/sync/*`、`src/store/sync/*`、`defaultSetting.ts:75` |
| 桌面歌词 | `src/screens/Home/Views/Setting/settings/LyricDesktop/*`、`src/core/desktopLyric.ts`、`src/components/DesktopLyricEnable.tsx`、`android/.../lyric/*` |
| 定时退出 | `src/components/TimeoutExitEditModal.tsx`、`src/core/player/timeoutExit.ts` |
| 备份页 | `src/screens/Home/Views/Setting/settings/Backup/index.tsx`（`actions.ts` 仍被复用） |
| 更新/协议 | `src/core/init/index.ts:18`、`src/navigation/components/PactModal.tsx:91`、`src/utils/version.js`、`publish/version.json` |
| 死设置 | `src/config/defaultSetting.ts` 的 `common.showBackBtn` / `common.showExitBtn` / `list.isShowSource` / `list.isSaveScrollLocation` |

### 7.3 产物与证据

- `dist/EmoMusic-v3.8.6-{arm64-v8a,armeabi-v7a,universal}.apk`
- `doc/release-notes-3.8.0.md` … `doc/release-notes-3.8.6.md`
- `doc/qa-3.7.0.md`、`doc/qa-3.8.0.md`
- `.tmp-verify/qa-3.7.0/`（164 文件）、`.tmp-verify/qa-3.8.0/`（144 文件）、`.tmp-verify/v3.8.6/`（8 张截图）
- `dist-archive/`：3.8.0 及更早版本归档

---

## 8. 一句话总结

**v3.8.6 的核心音乐链路已经“能用且好用”（约 89%），但离“可维护、可发布、可验证”还差三步：把更新和 lint 门禁接上、把死功能做去留、把真机 QA 变成可重复的测试。**

---

## 9. 审计后修复记录（2026-11-06）

本轮已按本报告的 P0/P1 项完成修复，代码不再对应报告中的“断链/过期”状态：

1. **更新链路**
   - `scripts/release.js` 在出包/归档成功后自动生成 `publish/version.json`（从 `CHANGELOG.md` 解析当版说明与最近 5 个历史版本）。
   - `publish/version.json` 已更新到 3.8.6。
   - 设置 → 关于 → 新增「检查更新」入口；`core/version.ts` 增加 `manual` 模式（已是最新/获取失败会直接 Toast，不再被 7 天节流静默）。
   - `.github/workflows/release.yml` 增加 GitHub Release 步骤，上传 `em-music-vX-{abi}.apk`，与 App 内 `downloadNewVersion` 的下载地址匹配。
2. **Lint 门禁**
   - `.eslintrc.cjs` 忽略第三方压缩词典 `src/utils/jyutping/index.js`。
   - `scripts/release.js` 前置检查加入 `npm run lint`；`npm run lint` 现为 0 问题。
3. **断链功能去留**
   - 删除：评论页/评论适配器、lx 同步客户端、桌面歌词（JS 页面 + core + 原生 LyricView/LyricSwitchView/LyricTextView + `SYSTEM_ALERT_WINDOW`）、定时退出、备份设置页（保留 `Backup/actions.ts` 供歌单导入导出复用）。
   - 桌面歌词的 README 承诺、设置项、类型、迁移、i18n key 一并清理；蓝牙/锁屏歌词保留（`core/remoteLyric.ts` + `LyricModule` 最小实现）。
   - 清理零引用死设置：`common.showBackBtn`、`common.showExitBtn`、`list.isShowSource`、`list.isSaveScrollLocation`。
4. **本轮验证**
   - `npm run typecheck`：0 error
   - `npm run lint`：0 problem
   - `node scripts/check-vendor.js`：13/13
   - Metro `react-native bundle`：成功
   - 原生 lyric 包 `javac`：通过
   - Gradle `:app:compileReleaseJavaWithJavac`：**BUILD SUCCESSFUL**（首次因 `~/.gradle` 沙箱只读失败，改用完整权限后通过）
   - 未重新出正式发版 APK；已用本地 `assembleRelease` 包做真机验收
5. **真机验收（SM-S938B / Android 17 / 1080x2340）**
   - 覆盖安装 `versionCode=188003` / `versionName=3.8.6`，签名与旧包一致，数据保留；
   - 冷启动 `FATAL EXCEPTION=0`；`npm run smoke` 启动 / 本地扫描（225 首）/ 播放 **3/3 通过**；
   - 设置 → 关于 → 「更新 / 检查更新」可见；点击后系统弹出 Toast（logcat `VRI-Toast` 计数从 34 增至 51），入口已接线、无崩溃；
   - `aapt dump permissions` 确认新 APK **不含 `SYSTEM_ALERT_WINDOW`**；设置页无桌面歌词/同步入口；音乐工具等子页可正常打开；
   - 未验证：远端有新版本时的下载/安装（当前远端 `publish/version.json` 仍是 3.6.4，且未发布新 Release）、蓝牙歌词、连续长时间播放。
