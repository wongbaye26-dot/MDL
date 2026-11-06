# EMO v3.9–v4.0 立项前难度与风险核验报告

> **阶段 0 输入文档** · 生成时间 2026-11-06（Asia/Bangkok） · 状态：可直接作为立项评审依据

- **输入需求**：`/Users/wangbaye/Downloads/EMO_v3.9-v4.0_本地音乐与专业音频系统升级开发说明书.md`（696 行，下称「说明书」）
- **核验对象**：`MDL/EmoMusic` 工作区 + `MDL/vendor/` 四个原生依赖
- **实际基线**：`package.json` **3.8.8** / versionCode **190**；git HEAD **f722339a**（v3.8.6）；**138 个文件未提交**（+851 / −7,428），无 3.8.8 tag
- **配套事实基线**：`doc/audit-report-3.8.8.md`（本轮重新审计，非说明书所引的 3.8.6 报告）
- **方法**：仓库静态取证（import 引用图、原生 Java 源码、Gradle、vendor 枚举）+ 静态检查复跑；**未连接真机**
- **状态标记**：`VERIFIED` 已定位代码证据 · `PARTIAL` 仅静态证据、需运行时确认 · `NOT VERIFIED` 未核验 · `INFERRED` 基于证据的推断

> 本报告的目的不是重述说明书，而是回答说明书 §12.1「必须先回答的工程问题」，并校正说明书与当前仓库之间的事实偏差。**说明书的分阶段切分、PoC 隔离、能力状态模型、许可证门槛与禁止性要求均成立，建议保留**；需要改的是立项起点与若干能力假设。

---

## 1. 结论

**整体难度 8.5/10（全量做到 v4.0），但难度高度不均：约 1/3 是普通业务开发，真正的难点集中在 4 类不可逆 / 外部依赖上。**

| 判断 | 结论 |
|---|---|
| 文档质量 | 高。需求工程与风险控制写得专业，能显著降低返工概率，**但不降低技术难度** |
| 只做「阶段 0 + 阶段 A 不换存储的子集」 | 难度约 **5/10**，可控，且直接补上 3.8.8 审计的短板（本地格式兼容 55%、缺排序/分类入口） |
| 阶段 B / C | 各相当于一个独立原生音频项目，必须 PoC 先行，不能排进常规迭代 |
| 阶段 D | 研究级，端到端 Bit-Perfect / 原生 DSD 无法由 App 单侧证明，**建议只做技术验证，不做产品承诺** |
| 立项前置条件 | **先提交 3.8.8 并打 tag**。说明书「以 v3.8.6 干净可回退基线为起点」的前提目前不成立 |

---

## 2. 说明书 §12.1 七个待核验问题的回答

| # | 问题 | 核验结果 | 状态 |
|---|---|---|---|
| 1 | 曲库持久化层是什么？schema / migration / 缓存清理入口在哪？ | **没有数据库**。`src/plugins/storage.ts:1-60` 是 AsyncStorage 存一整个 JSON，超过 `limit = 500000` 字符切成多键分片（`@___PART_A___`）；`src/core/localMusic/index.ts:3` 只 import `getData/saveData`，`:117` 读 `STORAGE_KEY`，`:583,642,665,712,762,780` 每次变更后整表 `saveData`。**无 schema、无 migration、无索引**，清理入口是 `storage.ts` 的 `removeData`。 | `VERIFIED` |
| 2 | RNTP fork 里 ExoPlayer 创建 / RenderersFactory / AudioSink / AudioSessionId 暴露点 | **构造点已定位且友好**：`vendor/react-native-track-player/android/.../MusicManager.java:139` 创建 `DefaultRenderersFactory`，`:141-144` 作为第二参数传入 `new ExoPlayer.Builder(service, renderersFactory)` —— FFmpeg `FfmpegAudioRenderer` 有明确注入点。`Track.java:142-163` 有 `DefaultDataSource.Factory` / `DefaultHttpDataSource.Factory`；`LocalPlayback.java:40-69` 有 `SimpleCache` + `CacheDataSource.Factory`（边听边存）。**`setAudioSink` / `getAudioSessionId` / `AudioProcessor` / `AudioEffect` 在 EmoMusic/src 与整个 vendor fork 中零命中** —— 音效链路完全没有基线。 | `VERIFIED`（缺失项亦为静态确认）/ 运行时 session 取值 `NOT VERIFIED` |
| 3 | 在线源与本地文件是否同一 renderer / 输出路径？有无独立缓存或下载代理？ | **同一个 ExoPlayer 实例与 renderer 路径**，差异只在 DataSource：本地绝对路径经 `src/plugins/player/utils.ts:161-162` 的 `toPlayableUrl` 转成 `file://`，在线走 HTTP/HTTPS。播放侧缓存是 `LocalPlayback.java` 的 `SimpleCache`；下载是**另一条原生链路**（`android/.../download/DownloadTask.java`，分段并发 + `.part/.part.seg`），不是播放代理。 | `VERIFIED` |
| 4 | metadata vendor 支持哪些容器/标签帧？写标签是否重写文件、是否保留未知帧？ | `vendor/react-native-local-media-metadata` **内嵌整套 Jaudiotagger**（`org/jaudiotagger/**`）。`audio/SupportedFileFormat.java:9-23` 枚举仅 **15 种**：OGG/MP3/FLAC/MP4/M4A/M4P/WMA/WAV/RA/RM/M4B/AIF/AIFF/AIFC/DSF；`AudioFileIO.java:291-297` 注册 reader。**`AUDIO_EXT`（`localMusic/index.ts:55`）里的 `ape`、`dff`、`aac`、`opus` 不在该枚举中** —— 这四种连标签读取器都没有。README:36-43 提供 `writeMetadata(path, metadata, false)` / `writePic` / `writeLyric`，写入会重写文件；**「保留未知帧」未找到实现证据**。 | 格式枚举 `VERIFIED`；写入语义 `PARTIAL`（需运行时 + 样本验证） |
| 5 | 现有「9 项曲库体检」的规则、修复行为和数据来源 | 规则集中在 `Setting/settings/Tools/health.ts` 的 `LibraryHealth` 接口与常量：缺封面（`missingCovers`）、可本地修复封面（`healableCovers`）、标签不完整（`tagIncomplete`）、缺歌词（`missingLyrics`）、无效条目（`invalid`）、`content://` 歌词未知（`lyricsUnknown`）、重复歌曲（`duplicates`，按**歌名 + 歌手归一化**分组）、低码率（`lowBitrate`，阈值 `LOW_BITRATE_KBPS = 192`）、时长异常（`durationAbnormal`，<15s / >3h）。扫描**只读不写曲库**（文件头注释明确说明），修复动作由各 Section 在用户点击后执行。 | `VERIFIED` |
| 6 | 三路扫描如何去重？SAF URI 权限如何持久化与校验？ | 去重**完全依赖真实路径字符串**：`localMusic/index.ts:342` 建 `msByPath` Map，`:349` 注释「三路结果按真实路径去重，谁先到用谁的文件信息，元数据逐路叠加」，`:547` 用 `scannedPaths` Set 判断增量。SAF 授权：`DirectoryPickerActivity.java:62` 与 `FileSystemModule.java:232` 调 `takePersistableUriPermission`，`src/utils/fs.ts:28-31` 提供 `releasePersistableUriPermission` / `getPersistedUriPermissions`，`DirectoryPickerModule.java:283` 注释已考虑用户撤销授权场景。**这正是说明书第 156 行明确禁止的「只依赖绝对路径作为永久主键」现状**。 | `VERIFIED` |
| 7 | targetSdk 36 下后台播放、文件访问、通知、安装权限与隐私说明是否一致 | `AndroidManifest.xml` 保留 `MANAGE_EXTERNAL_STORAGE`、`REQUEST_INSTALL_PACKAGES`、`POST_NOTIFICATIONS`、`FOREGROUND_SERVICE(_MEDIA_PLAYBACK)` 等；`android/build.gradle:9-12` = minSdk 21 / compileSdk 36 / targetSdk 36，`:14` NDK 26.1；`app/build.gradle:124` 仅 arm64-v8a + armeabi-v7a。**隐私一致性存在缺口**：3.8.8 审计确认 `PactModal` 已注册但 `showPactModal` 全仓零调用、`common.isAgreePact` 默认 true，首启协议/隐私说明不可达；About 页只有静态声明文字。 | `VERIFIED`（一致性的运行时行为 `PARTIAL`） |

### 2.1 核验中新发现、说明书未列入的两项

1. **队列没有分段概念**（影响 A-07 CUE）：`startMs / endMs` 在 `src/screens/Home/Views/Player/index.tsx:175,180,306,1112` 等处**只用于歌词逐字高亮**，播放队列与 `Track` 模型没有任何 `startMs/endMs` 字段。CUE 分轨不是「解析器 + UI」，而是要改 **Track 模型 → 队列项 → seek 边界 → 上一首/下一首 → 循环/后台/蓝牙媒体控制** 的整条链路，并需验证 Media3 侧裁剪方案（如 `ClippingMediaSource`）。**A-07 难度被低估**。
2. **标签能力矩阵与扫描后缀不一致**（影响 §3.5 / A-05）：`AUDIO_EXT` 收录 12 种后缀，但 Jaudiotagger 只认 15 种且不覆盖 `ape/dff/aac/opus`。说明书「按格式解析器能力读取标签」的表述需要在格式矩阵里显式标注「仅索引、无标签」。

---

## 3. 说明书与当前事实的偏差（立项前必须修订）

| # | 说明书内容 | 实际情况 | 修订建议 |
|---|---|---|---|
| 1 | 以 **v3.8.6 / f722339a 干净可回退基线**为起点（文档说明、§2.3、S0-01） | `package.json` 已是 **3.8.8**，HEAD 仍 `f722339a`，**138 文件未提交（+851/−7,428）**，`dist/` 已有 3.8.8 三 ABI 包但仓库无 tag | S0-01 之前**新增 S0-00：提交 3.8.8 + 打 `v3.8.8` tag + 确认 release 资产与版本一致**；否则「可回退」无从谈起 |
| 2 | S0-02「修复全量 lint、让 release 前置检查执行 lint」 | **已完成**：`npm run typecheck` 0 error、`npm run lint` 0 problem（本轮实测 41s）；`check.yml:39,42,45`、`build-test.yml:25`、`release.js:127-132` 均已接入 | 标记为已完成，阶段 0 只保留「lint scope / 忽略文件有明确记录」的文档化要求 |
| 3 | §1.1 版本号核验项：versionCode 188 vs APK 188003 待核对 | 为 **ABI split 编码**（188×1000+3）；当前版本已是 **190**，产物 `EmoMusic-v3.8.8-*` | 关闭该风险项，改为在发布门禁中记录编码规则 |
| 4 | 事实基线引用《v3.8.6 审计报告》 | 已有 `doc/audit-report-3.8.8.md`：桌面歌词/评论/lx 同步等死功能清理完毕、应用内更新链路打通、设置页重做 | 把说明书第 7、25、33、666 行的基线与完成度数字更新为 3.8.8 口径 |
| 5 | §10.1 冒烟测试 / §10.5 发布门禁 | `scripts/smoke.js` 开头注释明确：**首页 BigCard 常驻 `Animated.loop` 使 uiautomator 永远拿不到 idle**，搜索浮层 dump 不到，下载链路只能人工 4 步。`NAV_MARKER.mine` 目前仍与 `zh-cn.json:239,286` 文案匹配，前 3 条用例有效 | S0-05 增加「提供 debug 开关关闭常驻动画」，否则自动化门禁无法落地 |
| 6 | §3.5「APE / WMA / DSF / DFF 按格式解析器能力读取标签」 | vendor 实际无 `ape` / `dff` reader（见 §2 第 4 项） | 格式矩阵增加「标签读取能力」列，未覆盖项标「仅索引」 |
| 7 | A-07「CUE 分轨」按解析 + 队列项描述 | 队列无分段字段（见 §2.1） | 拆成 A-07a（解析器 + 样本）与 A-07b（播放链路改造 + 真机验收），后者单独立项 |

---

## 4. 分阶段难度评估

| 阶段 | 难度 | 主要工作 | 难度来源 | 可降级方案 |
|---|---:|---|---|---|
| **阶段 0** 质量基线 | **2.5** | 提交/tag、源码定位表、样本矩阵、测试框架 | 主要是流程与文档，技术门槛低；唯一障碍是起点不干净 | 无 |
| **阶段 A** Local Music Pro | **6.5** | 曲库模型、三路扫描统一、增量、导航/排序/筛选、标签封面、M3U/CUE、体检整合 | **AsyncStorage 分片 JSON → 关系型存储 + 用户数据全量迁移**（不可逆）；身份模型从路径改为指纹/媒体 ID；CUE 分段要动播放链路 | 先做「不换存储」子集：在内存建索引提供专辑/艺术家/排序/筛选，把 DB 迁移单列里程碑并做回滚演练 |
| **阶段 B** Audio Engine Pro | **8.5** | 格式探测矩阵、Media3 兼容评估、FFmpeg PoC、ALAC/APE/WMA/DSD 验证、音频信息、Gapless/Crossfade/倍速/ReplayGain | FFmpeg decoder 需**本地源码 + 手工 NDK 编译**、锁版本/ABI/`ENABLED_DECODERS`；minSdk 21 与新版 Media3（说明书记录 1.11.1 需 minSdk 24）冲突；**LGPL/GPL 合规**；设备 decoder 碎片化；APE/WMA/DSD 官方映射未列、需独立 PoC | 先只做「能力状态标记 + 音频信息页 + 倍速 UI」；FFmpeg 与替代引擎保持隔离分支 PoC，不进主链路 |
| **阶段 C** Sound Lab | **9.0** | session 盘点、10 段 EQ、预设、Preamp/Limiter、ReplayGain、设备路由、高级 DSP | **音效零基线**：需在原生暴露 `audioSessionId` 并经 RNTP bridge 到 JS；Android 系统 Equalizer 的 band 数/频响/控制权因机型而异，固定十段体验必须走**自研 PCM AudioProcessor / DSP 链**；切歌、焦点变化、输出切换后的状态一致性需真机验证 | 一期只做「系统 AudioEffect + 动态 band 数 UI + 明确标注设备差异」，把固定十段与自研 DSP 延后 |
| **阶段 D** Hi-Fi | **9.5** | USB DAC、高采样率/多声道、DSD 路线、PEQ、Bit-Perfect 文案 | 重采样、系统混音、AudioTrack offload、USB 输出端到端链路**无法由 App 单侧证明** | 仅保留研究性 PoC 与测量记录，**不承诺 Bit-Perfect / 原生 DSD** |

**难度的四个真实来源**（都不是代码量）：① 用户数据迁移不可逆；② Native 编译 / 许可证 / 设备碎片化；③ DSP 跨设备一致性；④ 音频正确性无法由 CI 断言，必须真机 + 固定样本 + 人工试听（说明书 §10.2/10.3 的矩阵本身是长期资产）。

**相对廉价的部分**：倍速 UI（`plugins/player/utils.ts:181` 已封装 `TrackPlayer.setRate`、`defaultSetting.ts:22` 有 key 且启动时读取，只缺控件）、格式能力状态标记、音频信息页、排序/筛选、M3U 导入、专辑/艺术家视图（内存索引版）、曲库体检整合（规则已在 `health.ts` 固化，直接复用即可满足 A-08「不出现第二套规则」）。

---

## 5. 风险登记

| ID | 风险 | 触发点 | 影响 | 缓解 / 决策门槛 |
|---|---|---|---|---|
| R1 | 曲库数据迁移不可逆 | A-01 换存储引擎 | 用户收藏/歌单/播放记录丢失，回滚代码无法恢复 | 双写 + 影子表 + 迁移前整表快照导出 + 真机回滚演练；迁移单独里程碑、单独 tag |
| R2 | Native 依赖与许可证 | B-03 FFmpeg 编译 / B-02 Media3 升级 | minSdk 21 失守、APK 体积失控、LGPL/GPL 分发义务、补丁锚点失效 | 锁版本/ABI/ENABLED_DECODERS 写 build manifest；许可证与 SBOM 审查通过才进主分支；改 vendor fork 前核对 `dependencies-patch.js` 锚点；形成 ADR |
| R3 | DSP 一致性 | C-02 固定十段 EQ | 不同机型频段数与实际效果不一致，出现「UI 显示生效但听感无变化」 | 能力探测 + `hasControl` 回调 + 失效降级；若必须一致则立 ADR 转自研 AudioProcessor |
| R4 | 验证体系缺口 | §10.1 / §10.5 全部音频门禁 | 静态检查通过 ≠ 功能通过；当前连 uiautomator dump 都拿不到 | S0-05 先解决常驻动画 idle 冲突；明确区分「模拟器可断言」与「真机硬件验收」，未验证项按说明书附录 A 标 `NOT RUN` |
| R5 | 合规一致性 | 阶段 0 / 上架 | `MANAGE_EXTERNAL_STORAGE`、安装权限与首启协议不可达并存 | 补协议链路或明确改为静态声明 + 权限用途说明；上架前单独评审 |

---

## 6. 修订后的阶段 0 任务卡（可直接执行）

| 任务 ID | 任务 | 完成定义 | 验收命令 / 证据 |
|---|---|---|---|
| **S0-00**（新增，前置） | 提交 3.8.8 工作区、打 `v3.8.8` tag、核对发布资产 | 工作区干净；`package.json` 与 tag 一致；三 ABI 产物 SHA-256 入档 | `git status --short`、`git tag v3.8.8`、`shasum -a 256 ../dist/EmoMusic-v3.8.8-*.apk` |
| **S0-01'** | 冻结 **3.8.8** 基线并更新说明书事实基线 | 说明书第 7/25/33/666 行改为 3.8.8 + `audit-report-3.8.8.md`；记录 HEAD/tag/依赖锁 | 本报告 §3 + `git rev-parse HEAD` + `npm ls --depth=0` |
| **S0-02'** | 标记 lint/typecheck 门禁已完成，补齐 lint scope 文档 | 0 problem / 0 error 有本轮记录；忽略文件清单有说明 | `npm run typecheck && npm run lint`；`check.yml:39-45`、`release.js:127-132` |
| **S0-03'** | 源码定位表与架构现状图 | **本报告 §2 已交付 7 项中的 6 项**；剩余 1 项：原生运行时 `audioSessionId` 实测与 bridge 暴露方案 | 补一份原生实测记录（需真机或 instrumentation），标 `PARTIAL → VERIFIED` |
| **S0-04'** | 格式样本清单与播放能力测试脚本 | 覆盖 §10.2 矩阵；额外标注 `ape/dff/aac/opus` **无标签 reader**；每样本记录来源/编码/参数/许可证 | `tests/audio-fixtures/` 清单 + 探测脚本输出 |
| **S0-05'** | 纯逻辑测试框架 + 解除自动化阻断 | Jest（或等效）覆盖探测/映射/M3U/CUE/ReplayGain 纯函数；提供 debug 开关关闭 BigCard 常驻 loop，使 uiautomator 可 idle | `npm test` 有通过数；`node scripts/smoke.js` 能完成 dump；`smoke.js` 的下载链路人工步骤转为自动化或明确列为例外 |

> 阶段 0 完成的判定：**上表 6 项全部 PASS，且没有跨到 A/B 阶段的实现代码**（按说明书 §11.2「禁止全量重构与本阶段目标无关的模块」）。

---

## 7. 建议的立项决策

1. **批准阶段 0** 按 §6 修订版执行，起点改为 3.8.8。
2. **阶段 A 拆两次立项**：A-1「不换存储的曲库体验」（专辑/艺术家/排序/筛选/格式状态/倍速/M3U，难度约 5/10）先行；A-2「关系型曲库 + 迁移 + CUE 分段」待 R1 回滚演练方案评审通过后启动。
3. **阶段 B / C 只批 PoC 预算**：FFmpeg 编译、ALAC/APE/WMA PoC、audioSession 暴露、EQ 能力探测各出独立结论与 ADR，不承诺版本号。
4. **阶段 D 不写入发布计划**，保留为研究方向。
5. 每阶段结束按说明书附录 A 标 `PASS / PARTIAL / FAIL / NOT RUN`，并更新唯一进度文档。

### 待决策项（需 ADR）

| ID | 决策 | 依据 |
|---|---|---|
| D1 | 保留 minSdk 21 还是为新版 Media3 提升到 24 | 说明书 §5.3；`android/build.gradle:9` |
| D2 | 曲库存储选型、迁移窗口、回滚策略 | 本报告 §2 第 1 项、R1 |
| D3 | EQ 走系统 AudioEffect 还是自研 AudioProcessor | 说明书 §6.2、R3 |
| D4 | FFmpeg 编译配置、ABI 体积预算、许可证结论 | 说明书 §5.4 / §11.2、R2 |
| D5 | 阶段 D 是否立项、是否使用 Hi-Res / Bit-Perfect 文案 | 说明书 §5.6 门槛 |

---

## 8. 边界与未验证项

本报告**全部为静态取证**，以下事项未验证，不得当作既有能力或已确认结论：

- 运行时 `audioSessionId` 的实际取值与控制权行为（`NOT VERIFIED`）
- Jaudiotagger `writeMetadata` 是否保留未知帧、写入失败是否原子回滚（`PARTIAL`）
- Media3 1.11.1 各 AAR manifest 的实际 minSdk、与 RNTP fork 的兼容性（沿用说明书记录，未本地复核）
- FFmpeg decoder 在本机 NDK 26.1 下能否按目标 decoder 清单编译通过（`NOT VERIFIED`）
- 任何格式的真实播放 / seek / Gapless / EQ 听感表现（需真机 + 样本矩阵 + 人工试听）
- 许可证法律结论（需法务/合规审查，本报告只标记风险）

---

## 附录 A：本轮核验命令与证据路径

**实测**：`npm run typecheck`（0 error）、`npm run lint`（0 problem，约 41s）、`git status --short`（138 文件变更）、`wc -l src`（82,055 行 / 638 文件）。

**关键证据路径**（相对 `MDL/`）：

```
EmoMusic/package.json                                      版本 / 依赖 / 脚本
EmoMusic/doc/audit-report-3.8.8.md                        本轮事实基线
EmoMusic/src/plugins/storage.ts:1-60                       曲库持久化 = AsyncStorage 分片 JSON
EmoMusic/src/core/localMusic/index.ts:55,342,349,547       AUDIO_EXT / 三路按路径去重
EmoMusic/src/utils/fs.ts:28-31                             SAF 授权读取与释放
EmoMusic/src/plugins/player/utils.ts:161-162,181            本地 file:// / setRate
EmoMusic/src/screens/.../Tools/health.ts                   9 项体检规则
EmoMusic/src/screens/.../Player/index.tsx:175,306          startMs/endMs 仅用于歌词
EmoMusic/scripts/smoke.js                                 uiautomator idle 阻断说明
EmoMusic/android/build.gradle:9-14                        minSdk 21 / SDK 36 / NDK 26.1
EmoMusic/android/app/build.gradle:124                     两个 ABI
EmoMusic/android/.../DirectoryPickerActivity.java:62      takePersistableUriPermission
vendor/react-native-track-player/android/build.gradle:64  Media3 1.8.0
vendor/react-native-track-player/.../MusicManager.java:139-144   ExoPlayer + RenderersFactory 注入点
vendor/react-native-track-player/.../LocalPlayback.java:40-69    SimpleCache
vendor/react-native-local-media-metadata/.../SupportedFileFormat.java:9-23   15 种标签格式
vendor/react-native-local-media-metadata/README.md:36-43         写标签 API
```

**输入需求文档**：`/Users/wangbaye/Downloads/EMO_v3.9-v4.0_本地音乐与专业音频系统升级开发说明书.md`
