# EmoMusic v3.8.8 功能与 UI / 动效完成度审计报告

- **审计对象**：`EmoMusic`（Android 客户端，React Native 0.73.11，基于 lx-music-mobile v1.9.2 二次开发）
- **版本基线**：`package.json` 3.8.8 / versionCode 190；git HEAD `f722339a`（v3.8.6）—— **代码基线与实际版本不一致，见 P0-1**
- **审计时间**：2026-11-06（Asia/Bangkok）
- **审计方式**：全仓静态取证（导航图 / import 引用图 / 设置项读写点 / 动画 API 统计 / 文档与发布物核对）+ 静态检查复跑（`tsc` / `eslint`）+ 产物核对
- **审计边界**：本轮**未连接真机**（无 `adb` 设备），不做运行时功能复测；真机结论引用 `doc/qa-3.7.0.md`、`doc/qa-3.8.0.md`、`.tmp-verify/` 既有截图与 `doc/release-notes-3.8.8.md` 的自述
- **范围界定**：工作区 `MDL/` 下 `EmoMusic/` 为唯一在研主项目；`lx-music-desktop/` 为上游参考副本（`doc/attribution.md:12` 明确「未直接使用」）、`vendor/` 为 4 个原生依赖补丁（`package.json:67-78` 以 `file:` 引用）、`dist/` 与 `dist-archive/` 为发布产物 —— 三者均不计入功能完成度分母

---

## 结论速览

> **核心业务链路是生产级实现（功能完成度约 89/100），UI/动效的「工程质量」很高但「系统性覆盖」不足（约 71/100）；当前最大风险不是功能没做，而是代码基线漂移、协议链路不可达、以及动效把自动化测试挡在门外。**

相比 `doc/audit-report-3.8.6.md`，v3.8.8 修掉了上次 6 个 P1 中的 3 个（应用内更新链路、全量 lint 门禁、桌面歌词文档承诺），并清理了 7,428 行死功能代码；但**自动化测试、本地格式兼容、协议弹窗**三项仍未闭环，且新引入的设置页重做留下了若干孤儿设置项。

### 总体评分

| 维度 | 3.8.8 得分 | 3.8.6 参考 | 主要依据 |
|---|---:|---:|---|
| 功能交付（用户可达口径） | **89** | 89 | 断链从 7 处收敛到 1 处；更新链路端到端打通；核心链路实现深度高 |
| UI / 动效（本次细分口径） | **71** | 90\* | 转场/玻璃/原生驱动工程完成度高；但承诺兑现、无障碍、i18n、设计稿同步、加载态覆盖明显不足 |
| 代码质量 / 可维护性 | **74** | 74 | `tsc` 0、`eslint` 0；仍有 2,078 行播放器巨型文件、死代码与约 50% 监听器清理率 |
| 测试 / 自动化 | **32** | 30 | 仍无单元/集成测试；`smoke.js` 仅 3 条 adb 用例，且被常驻动画阻断 |
| 文档一致性 | **68** | 75 | README 两条设计承诺失实、构建产物停在 3.6.15、设计稿未随 3.8.x 更新 |
| 发布 / 签名 | **82** | 85 | 3.8.8 三 ABI 包齐全、version.json 已同步；但代码未提交、无 tag、CI 不生成元数据 |
| 安全 / 合规 | **60** | 60 | 悬浮窗权限已清；`MANAGE_EXTERNAL_STORAGE` / `REQUEST_INSTALL_PACKAGES` 仍在，协议弹窗不可达 |
| **综合（个人侧载）** | **80 / 100** | 78 | 可放心使用；发布卫生与验证证据是主要扣分 |
| **综合（应用商店口径）** | **约 55 / 100** | 52 | 权限说明、隐私协议、自动化测试、无人值守更新仍是硬伤 |

> \* 3.8.6 的「视觉/交互一致性 90」只衡量**已实现页面之间是否统一**；本次 71 分改用更严的口径，叠加了**设计承诺兑现、全站动效覆盖广度、无障碍/i18n、设计稿同步、加载态**。口径不同，不代表视觉退步。
>
> 计分口径：功能完成度按「用户能从 UI 到达并真正生效」计；只有代码、没有入口或不生效的功能记 0。

---

## 1. 功能完成度

### 1.1 逐模块评分矩阵

| 功能模块 | 完成度 | 关键证据 | 备注 |
|---|---:|---|---|
| 导航与入口可达性 | 88 | `config/constant.ts:91-98` 五项 NAV_MENUS；`Vertical/BottomNav.tsx:286-319`、`Horizontal/Aside.tsx:156-182`；首页四卡 `Views/Home/index.tsx:51-56,219-230`；设置 8 分类 `Setting/Main.tsx:16-25` | 全部可达；`SETTING_SCREEN` 整段注释（`registerScreens.tsx:44`），设置实为 Home 内 Tab，属架构选择非断链 |
| 播放器 / 播放内核 | 95 | `core/player/player.ts` 831 行：退避重试 `:85-107`、强制换源 `:223`、PlaybackError 自动恢复 `:231-235` | 队列、四种模式、拖动跳转、缓冲预取完整 |
| 通知 / 锁屏 / 媒体会话 | 85 | `plugins/player/notification.ts`、`dependencies-patch.js` 原生补丁 | 依赖 vendor 补丁锚点，属外部风险 |
| 下载中心 | 94 | `core/download/index.ts` 946 行：`.part` + `.part.seg` 分段断点 `:88-96,836`、换源清残留 `:737`；`Download/TaskItem.tsx` 显示来源 | 多音质、并发自适应、格式校验/改名齐全 |
| 本地曲库 / 扫描 / 元数据 | 88 | `core/localMusic/index.ts` 908 行：目录直读 + SAF + MediaStore 三路合并 `:330-340`；`AUDIO_EXT` 12 种 `:55` | **格式解码能力只有约 55%**，见 P1-4 |
| 在线音源 / 榜单 / 歌单 | 88 | `utils/musicSdk/{kw,kg,tx,wy,mg}`、`core/songlist.ts`、`core/leaderboard.ts` | 播放地址依赖用户导入音源，上游接口不稳定 |
| 搜索 | 82 | `core/search/*` 合计 156 行，`music.ts:21-59` 多源聚合 + 分页 | 热词/历史/联想/歌单/分页可用，但为薄封装 |
| 歌词 / 翻译 / 注音 / 粤拼 | 92 | `core/lyric.ts:37-39,95-134` 跨源补翻译；`plugins/lyric.ts:49-97` 毫秒对齐；逐字高亮在 `Player/index.tsx` | 蓝牙/锁屏歌词保留，桌面歌词已按计划下架 |
| 收藏 / 自建歌单 / 音乐工具 | 92 | `core/list.ts:12-180` 20 个 CRUD 导出；`Setting/settings/Tools/*` 9 项体检、一键修复、批量重命名 | 导入导出复用 `Backup/actions.ts` |
| 主题 / 横竖屏 / 字体 | 90 | `theme/themes/index.ts:117-129` 明暗 + 种子色；`:123-125` 修复 `system` NaN；`components/common/Text.tsx:42-47` 字号实时缩放 | v3.8.8 字体大小即时生效已落地 |
| 设置页与设置项一致性 | 80 | `defaultSetting.ts` 57 个 key；8 个子页全部有内容 | **1 个无效开关、9 个有读取无 UI、3 个 UI 摘除但 key 保留**，见 P1-2 |
| 应用内检查更新 | 90 | `About.tsx:104-111` 入口 → `core/version.ts:29` → `utils/version.js:17` 数据源 → `VersionModal.tsx:166-173` 下载 → `:83,116` 安装；`release.yml:197-203` 上传资产 | 端到端打通；`version.json` 依赖人工提交 master，见 P1-7 |
| 系统集成 / Android 16 | 85 | `android/app/src/main/AndroidManifest.xml`，`doc/android-16-compat.md` | targetSdk 36、edge-to-edge、FGS、分屏/小窗；16KB 页大小未处理（文档已列限制） |
| 协议 / 隐私合规链路 | **20** | `PactModal` 已注册（`registerScreens.tsx:43`），但 `showPactModal` 定义在 `core/common.ts:89`、`navigation/utils.ts:17` 后**全仓零调用**；`common.isAgreePact` 默认 `true`（`defaultSetting.ts:9`） | **断链**，见 P0-2 |

### 1.2 与 3.8.6 审计问题闭环对照

| 3.8.6 发现 | 3.8.8 状态 | 证据 |
|---|---|---|
| P1-1 应用内更新完全不可达、数据源停在 3.6.4 | ✅ **已闭环** | `About.tsx:104-111` 新增「检查更新」；`publish/version.json` 已到 3.8.8；`release.js:91-103,175` 自动生成；CI 上传 Release 资产 |
| P1-2 `npm run lint` 失败、CI 门禁与发布不一致 | ✅ **已闭环** | 本次实测 `tsc --noEmit` 0 error、`eslint .` 0 problem；`check.yml:42,45` 有 typecheck + lint；`release.js:127-132` 出包前置检查；`build-test.yml:25` 有 lint |
| P1-3 本地扫描格式与解码能力不一致 | ⚠️ **未修，已转为文档已知限制** | `core/localMusic/index.ts:55` 仍收 APE/WMA/DSF/DFF；`README.md` 已知限制如实列出 |
| P1-4 桌面歌词 README 承诺 vs 实现不可达 | ✅ **已闭环** | 删除 `core/desktopLyric.ts`、`DesktopLyricEnable.tsx`、原生悬浮窗类；Manifest 已无 `SYSTEM_ALERT_WINDOW`；README 已移除承诺 |
| P1-5 死功能 / 死代码堆积 | 🟡 **部分闭环** | 净删 7,428 行（评论/lx 同步/桌面歌词/定时退出/备份页）；但仍有 32 个零引用文件、`xm.js:18-39` 五个 `Promise.reject('fail')` 评论桩、`Download/index.js` 与 `index.tsx` 并存、Java `lyric/` 类名残留 |
| P1-6 无自动化测试，回归靠人眼 | ❌ **未修，且被新动效加重** | 无 Jest/集成测试；`scripts/smoke.js` 注释明确：BigCard 常驻 `Animated.loop` 让 uiautomator 永远拿不到 idle，下载链路**只能人工** |
| 协议 / 隐私弹窗不可达 | ❌ **遗留** | 见 P0-2（3.8.6 报告只在 P1-1 附带提及） |

### 1.3 死代码与残留（清理后的剩余清单）

- **零引用文件约 32 个**（按 import 图，剔除 `app.ts` / `Provider.tsx` 两个外部入口假阳性）：`navigation/components/Toast.js`、`config/globalData.ts`、`utils/errorHandle.ts`、`components/common/{Popup,ScaledImage,Slider,DorpDownPanel}*`、`components/player/{Progress,ProgressBar}.tsx`、`Views/Download/ActionBar.tsx`、`Leaderboard/BoardsList/index.tsx`、`Leaderboard/Vertical/Hero.tsx`、`SongList/HeaderBar/index.tsx`、`Setting/Vertical/{NavList,Header}.tsx`、`Setting/components/Slider.tsx`、`settings/Player/{IsAutoJyutping,IsShowLyricRoma}.tsx`、`settings/List/AddMusicLocationType.tsx` 等
- **清理后仍属活代码**（勿误删）：`settings/Backup/actions.ts` 被 `core/init/deeplink/fileAction.ts:2` 与 `Mylist/MyList/listAction.ts:6` 复用；`core/syncSourceList.ts` 是在线歌单同步（非 lx 同步），有 3 处引用；`src/plugins/lyric.ts` 是 LRC 解析；Java `lyric/Lyric.java` 服务于蓝牙/锁屏歌词
- **占位统计**：TODO/FIXME/HACK 共 8 处（多为「移除 any」「startupAutoPlay」类技术债），空 `catch` 约 10 处（多为多源兜底），无 `coming soon` / 待实现页面；`core/musicSdk/xm.js` 的 5 个 `Promise.reject('fail')` 是唯一真·未实现桩

---

## 2. UI / 动效完成度

### 2.1 README 设计承诺逐条核实

| README「设计细节」承诺 | 判定 | 证据 |
|---|---|---|
| 59dp 玻璃胶囊、52dp 圆形选中底、线性图标 | ✅ **完全实现** | `Vertical/BottomNav.tsx:33,36,48,117,211-215`：`BAR_HEIGHT=59`、`ACTIVE_SIZE=52`、`Glass` + 主题 tint；`:174-192` 的 spring 滑动圆底属超额实现 |
| 播放进度四层柔光 + 呼吸动画 | 🟡 **部分实现 / 文档过时** | 四层弧光 + 1.9s 呼吸仍存在于 `components/common/AlbumDiscSpin.tsx:40,90-93,142-145`，但「贴胶囊边缘」的跑马灯在 v3.8.2 已删除（`BottomNav.tsx:239-246` 有明确注释），位置已迁到封面圆盘外圈 |
| 播放器从圆盘展开（小圆 → 大圆 → 铺满封面） | ✅ **完全实现** | `Vertical/PlayerTransition.tsx:42-53` 对 `left/top/width/height/borderRadius` 三段插值，`borderRadius` 从 `home.width/2 → circle.width/2 → 0`；**是真实圆角 reveal，不是普通淡入淡出**。非 clip/mask，靠 `overflow:hidden` + 圆角变形 |
| 真高斯模糊 + 主题色叠加 | ✅ **完全实现** | `components/common/Glass.tsx:46-51`：`BlurView` + `overlayColor=tint`，blur 半径夹紧到 25 |
| 主题色从封面取色落到 `c-primary` | ❌ **未实现** | `theme/playerPalette.ts:135-164` 是**从 `theme['c-primary']` 反推**色板；种子来自 `defaultSetting.ts:62` 的 `#6C5CE7` 或系统强调色（`theme/themes/index.ts:123-125`）；封面只作糊底（`Player/index.tsx:1454`）。全仓无 Vibrant / Palette / 像素取色库 |

> **文档失实是本轮最直接的 UI 结论**：5 条承诺中 2 条与代码不符（封面取色、胶囊柔光位置）。

### 2.2 动效资产统计

| 指标 | 数值 | 说明 |
|---|---:|---|
| `Animated.*` 调用 | 279 次 / 35 文件 | 仅用 RN 内置 `Animated`，`package.json` 无 reanimated；`LayoutAnimation` / `withTiming` / `withSpring` 均为 0 |
| `Animated.timing` / `spring` | 69 / 14 | `Easing` 85 次、`interpolate` 44 次 |
| `useNativeDriver: true` / `false` | **79 / 4（95.2%）** | 4 处 false 全在 `utils/playerTransition.ts:140,176,189`（转场几何插值必须走 JS 线程）+ `useAnimateColor.ts:24` |
| `Animated.loop` | 10 处 / 4 文件 | `Views/Home/BigCard.tsx:68,140,147,154,266,325`、`AlbumDiscSpin.tsx:129,142`、`AlbumDiscButton.tsx:56`、`MarqueeText.tsx:44` |
| 动画清理 | 良好 | 上述文件均在 `useEffect` return 中 `.stop()`；模块级单例 `playerTransition.ts:71,81` 为刻意常驻 |
| `BlurView` / `LinearGradient` | 11 / 52 | 玻璃质感覆盖主要导航与播放器 |

**两个关键问题：**

1. **动效分布极不均衡**：下载中心、排行榜、歌单广场、`Mine`、设置页主体、`Player/Stage.tsx`、`SeekBar.tsx` 等核心页面**基本无动效**；动效集中在首页四卡、底部导航、圆盘、播放器主文件与转场。即「旗舰页很精致，列表页像静态页面」。
2. **常驻动效反噬可测试性**：`scripts/smoke.js` 开头注释明确写着 —— 首页三张卡片的 `Animated.loop` 使界面永不 idle，`uiautomator` 报 "could not get idle state"，搜索浮层 dump 不到，因此**下载链路无法自动化，只能人工按 4 步过一遍**。这是「动效完成度高」带来的真实工程代价；`NAV_MARKER.mine = /基本设置|下载设置/` 目前仍与 `zh-cn.json:239,286` 的文案匹配，冒烟脚本的前 3 条仍有效。

### 2.3 交互反馈覆盖（约 70%）

| 反馈类型 | 状态 | 证据 |
|---|---|---|
| 按压态 | ✅ 较全 | `TouchableOpacity` 460 处 / `activeOpacity` 127 处 / `Pressable` 25 处；M3 state layer 集中在 `components/common/PageHeader.tsx:84,127-134` |
| 下拉刷新 / 加载更多 | ✅ | `RefreshControl` 6 处、`onRefresh` 48 处；`components/OnlineList/List.tsx:54` 有 `loading/refreshing/end/error/idle` 五态 |
| 空状态 / 错误重试 | 🟡 不均 | 空态 64 处 / 19 文件；错误重试 81 处但**多在网络层**，界面级重试弱。下载中心、排行榜 `BoardsList`、`Mine`、歌单广场 `HeaderBar`、设置页主体缺空/错/按压三态 |
| **骨架屏** | ❌ **基本缺失** | 全仓仅 `Leaderboard/Vertical/Chips.tsx:32` 有 4 个占位方块，无通用 Skeleton/shimmer 组件与全站加载占位体系 |
| Toast / 危险确认 / 长按多选 | ✅ | Toast 182 处；`components/common/AppDialog`、`ConfirmAlert`；`onLongPress` 30 处、多选 79 处 |
| 列表性能 | ✅ | `FlatList` 35、`memo` 153、`keyExtractor` 25、`getItemLayout` 32、`removeClippedSubviews` 12 |
| 横竖屏 / 键盘适配 | ✅ | 横竖屏 52 处、键盘 56 处；`AndroidManifest` `adjustNothing` 修复在 3.8.1 已落地 |
| **无障碍** | ❌ **严重不足** | `accessibilityLabel` 全仓仅 **13 处**，主导航、播放控件、来源图标绝大多数无标签；无 TalkBack / 大字体验收记录 |

### 2.4 主题、i18n 与设计稿一致性

- **token 体系存在但绕过严重**：`theme/themes/themes.ts:3036-3055` 定义 `c-primary` 及 alpha 色阶；但 `src/screens` + `src/components` 中约 **272 行命中硬编码色**（含注释口径约 350 处），最集中在 `Player/index.tsx`(55)、`BigCard.tsx`(43)、`QueueCoverFlow.tsx`(22)、`BottomNav.tsx`(20)、`Horizontal/Aside.tsx`(18)。字号基本走 `Text` token（硬编码 `fontSize` 仅 17 处），但 `design/EMO-UI-Design.html:211-217` 的 `space-1..4` / `radius-card` / 字号阶梯在实现中没有对应常量。
- **两套主色并存**：设计稿品牌色 `#A855F7`（`design/README.md`）与默认动态种子 `#6C5CE7`（`defaultSetting.ts:62`）不一致。
- **i18n 结构完整、落地不足**：`src/lang/{en-us,zh-cn,zh-tw}.json` 各 **517 条完全对齐**，但界面硬编码中文约 **563 条 / 64 文件**（如 `LocalMusic/index.tsx:59-63,197,201`、`About.tsx:72,94,115,123-134`），英文/繁体体验不完整；`ListSearchBar.tsx:28` 甚至有硬编码英文 placeholder。
- **v3.8.8 的 system 崩溃修复确认到位**：`theme/themes/index.ts:123-125` 已把 `'system'` 解析为系统强调色并回退 `#6C5CE7`，避免 `rgb(NaN,NaN,NaN)` 传给 `LinearGradient`。
- **设计稿已脱节**：`EMO-UI-Design.html:233-283` 的下载页仍是「渐变 Hero + 圆角任务卡 + 进度条」，实现在 v3.8.0/3.8.1 已改为无卡片列表行（`DownloadPage.tsx:222` 有注释）；设计稿只画了下载/搜索/我的三屏，实现首页已是「最近播放 + 四张 BigCard」。主色 `#A855F7` 仍一致。

### 2.5 性能与稳定性风险

- **巨型文件**：`theme/themes/themes.ts` 4,540 行、`Player/index.tsx` 2,078 行、`LocalMusic/index.tsx` 1,556 行、`core/download/index.ts` 946 行、`core/localMusic/index.ts` 908 行、`core/player/player.ts` 831 行；`Player/index.tsx` 与 `BottomNav.tsx:198-203,268-282` 有大量内联 style + `interpolate`。
- **监听器清理率约 50%**（粗口径）：`setTimeout` 70 vs `clearTimeout` 38；`addListener/subscribe` 100 vs `remove/unsubscribe` 47。
- **图片缓存实质缺失**：`components/common/Image.tsx:5-6` 用 RN 内置 `Image`（`react-native-fast-image` 被注释），`:61` 的 `cache:'force-cache'` 在 Android 基本无效，`:81-83` 的 `clearMemoryCache` 是空实现 —— 在线封面列表反复请求的风险点。
- **常驻 GPU 合成**：首屏 4 卡 + 圆盘同时循环，虽全部 nativeDriver 不占 JS 线程，仍属持续耗电；`AlbumDiscSpin.tsx:141` 在 `showRing=false` 时有跳过，但首页卡片无「减少动态效果」开关。

### 2.6 UI / 动效评分

| 维度 | 得分 | 依据 |
|---|---:|---|
| README 设计承诺兑现 | 72 | 3 完全 / 1 部分 / 1 未实现 |
| 动效实现质量（转场、原生驱动、清理） | 88 | 95.2% nativeDriver、真实 radius reveal、loop 均有 stop |
| 动效覆盖广度 | 55 | 集中在 4 个文件，多个核心列表页无动效 |
| 交互反馈覆盖 | 70 | 按压/刷新/多选/性能齐全；骨架屏 0、无障碍 13 处 |
| 主题与视觉一致性 | 62 | 修复到位但约 272 行硬编码色、两套主色、token 未落地 |
| i18n / 无障碍 | 45 | 517×3 对齐但 563 条硬编码中文、13 处标签 |
| 设计稿还原 | 55 | 主色一致，页面结构与 token 明显偏离且设计稿未更新 |
| 性能与稳定性 | 60 | 巨型组件、图片缓存空实现、清理率 ~50% |
| **综合** | **71** | 工程实现强，系统性与文档治理弱 |

---

## 3. 静态检查与发布状态（本次实测）

| 检查项 | 结果 |
|---|---|
| `npm run typecheck` | ✅ **0 error**（`tsc --noEmit -p tsconfig.json`） |
| `npm run lint` | ✅ **0 problem**（`eslint . --ext .js,.jsx,.ts,.tsx`），两项合计耗时约 41s |
| CI 门禁 | `check.yml:39,42,45` = vendor:check + typecheck + lint；`build-test.yml:25,28` = lint + build-test；`release.js:127-132` = 出包前置 tsc + lint + 严格补丁校验。**`release.yml` 本身不含 lint 步骤**，靠本地 release 脚本 |
| 发布产物 | `dist/` 中 3.8.8 三包齐全（`EmoMusic-v3.8.8-{arm64-v8a,armeabi-v7a,universal}.apk`，2026-11-06 04:18） |
| 更新元数据 | `publish/version.json` = 3.8.8，与 `package.json` 一致；`utils/version.js:17` 指向 `raw.githubusercontent.com/.../master/publish/version.json`，3 次重试 |
| **git 状态** | ⚠️ HEAD 为 `f722339a`（v3.8.6），但 `package.json` 已是 3.8.8；**138 个文件变更未提交（+851 / −7,428）**，其中 68 删除、70 修改、6 未跟踪；无 v3.8.8 tag |
| 权限 | `READ_MEDIA_AUDIO`、`MANAGE_EXTERNAL_STORAGE`、`INTERNET`、`REQUEST_INSTALL_PACKAGES`、`POST_NOTIFICATIONS`、`FOREGROUND_SERVICE(_MEDIA_PLAYBACK)`、`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`；`SYSTEM_ALERT_WINDOW` 已清除 ✅ |
| 真机证据 | 最新正式 QA 为 `doc/qa-3.8.0.md`；`.tmp-verify/` 无 v3.8.8 专用目录；`release-notes-3.8.8.md` 自述「SM-S938B / Android 17 真机验收」，但仓库内**无可核对的截图或日志** |
| 代码规模 | `src/` 638 个文件，TS/TSX/JS 合计 **82,055 行**；无 Jest / Detox / 单元测试目录（`test.js` 是上游 RSA 加解密实验脚本，与测试无关） |

### 文档与元数据漂移

1. `README.md` 构建段仍写 `em-music-v3.6.15-arm64-v8a.apk` / `universal.apk`，实际产物为 `EmoMusic-v3.8.8-*`（且新增 `armeabi-v7a`）。
2. `README.md` 目录结构仍列 `CapsuleProgress`，该组件在 v3.8.2 已删除（`src` 下已无任何 `*Capsule*` 文件）。
3. `README.md` 两条设计承诺失实（见 2.1）。
4. `scripts/release.js:65` 的 `slice(0, 4)` 使 `publish/version.json` 的 desc 只保留前 4 条，缺「发版/更新链路」「清理死功能」两条。
5. `version.json` 由本地 `release.js` 生成，**CI 不生成也不提交**，必须人工推到 master 才能被 App 读到 —— 更新链路的唯一人工环节。
6. `design/EMO-UI-Design.html` 未随 v3.8.0 之后的页面重构更新。

---

## 4. 问题清单（按优先级）

| # | 级别 | 问题 | 证据 | 建议 |
|---|---|---|---|---|
| 1 | **P0** | 代码基线漂移：HEAD=v3.8.6、包=3.8.8、138 文件未提交、无 tag | `git status`、`package.json` | 立即提交 v3.8.8、打 `v3.8.8` tag、确认 `release.yml` 触发并上传资产；否则无法复现构建与回滚 |
| 2 | **P0** | 协议/隐私弹窗不可达：`PactModal` 注册但 `showPactModal` 零调用，`isAgreePact` 默认 true | `registerScreens.tsx:43`、`core/common.ts:89`、`navigation/utils.ts:17`、`defaultSetting.ts:9` | 二选一：接回首启协议链路，或把注册/设置项全部删除并明确以 About 页静态声明为准（商店上架必须前者） |
| 3 | **P1** | README 设计承诺 2 条失实（封面取色、胶囊柔光位置） | `theme/playerPalette.ts:135-164`、`BottomNav.tsx:239-246` | 短期改文档；若保留 Material You 卖点，应引入封面取色库真正实现 |
| 4 | **P1** | 孤儿设置 `common.allowProgressBarSeek`：开关读写自身，SeekBar 不读取 | `IsAllowProgressBarSeek.tsx:13-20` + 全仓仅 4 处命中 | 接线到 `SeekBar` 或删除该行；并批量清理 9 个「有读取无 UI」与 3 个「UI 摘除」key |
| 5 | **P1** | 本地格式兼容约 55%：APE/WMA/DSF/DFF 能入库不能解码 | `core/localMusic/index.ts:55`、`README.md` 已知限制 | 列表加「不支持解码」标记 + 点击提示，避免用户以为 App 崩溃 |
| 6 | **P1** | 无自动化测试；常驻 loop 阻断 uiautomator；3.8.1–3.8.8 无正式 QA 与证据 | `scripts/smoke.js` 注释、`doc/qa-*`、`.tmp-verify/` | 提供 debug 开关关闭常驻动画供自动化 dump；补 Jest 纯函数单测；补 3.8.8 验收截图/日志 |
| 7 | **P1** | 更新链路依赖人工提交 `version.json`；desc 被截断 | `release.js:65,91-103`、`publish/version.json` | 把生成 + 提交移到 CI 步骤；去掉 `slice(0,4)` |
| 8 | **P1** | 骨架屏体系缺失、界面级错误/重试态弱、无障碍仅 13 处标签 | 2.3 节 | 抽通用 Skeleton 与「空/错/重试」三态容器；至少给主导航与播放控件补 `accessibilityLabel` |
| 9 | **P2** | 约 32 个零引用文件、`xm.js` 5 个 reject 桩、`Download/index.js` 重复入口、Java lyric 类名残留 | 1.3 节 | 分批删除；注意 `Backup/actions.ts`、`syncSourceList.ts` 是活代码，勿误删 |
| 10 | **P2** | 硬编码色约 272 行、硬编码中文约 563 条、两套主色、design token 未落地 | 2.4 节 | 收敛到 `c-*` token 与 `t()`；统一品牌色；同步更新设计稿 |
| 11 | **P2** | 图片缓存空实现、2,078 行播放器巨型文件、监听器清理率 ~50% | `Image.tsx:81-83`、2.5 节 | 引入磁盘缓存；按 Stage/SeekBar/Lyric 拆分；补 `useEffect` 清理 |
| 12 | **P2** | 文档漂移 6 处、设计稿未随 3.8.x 更新 | 第 3 节 | 发版清单加入「README / design / version.json 同步」检查项 |
| 13 | **P2** | 权限合规：`MANAGE_EXTERNAL_STORAGE`、`REQUEST_INSTALL_PACKAGES` | `AndroidManifest.xml:11,13` | 个人侧载可保留；上架需补用途说明与最小化策略 |
| 14 | **P2** | 技术债：8 处 TODO、10 处空 catch、`playbackRate` 底层支持但无控件 | 1.3 节、`defaultSetting.ts` | 记录到 backlog，优先修静默吞错与倍速控件 |

---

## 5. 整改路线图

**批次 A · 发布卫生（最高优先，先于任何新功能）**
提交 v3.8.8 + 打 tag → 修 README 3 处漂移 → `version.json` 改由 CI 生成且 desc 完整 → 补 3.8.8 真机验收证据 → 确认 `release.yml` 的 Release 资产与 `utils/version.js` 的下载命名一致。

**批次 B · 正确性闭环**
协议弹窗接回或彻底移除 → `allowProgressBarSeek` 接线/删除 + 12 个孤儿 key 清理 → 本地不可解码格式的显式标记 → `MANAGE_EXTERNAL_STORAGE` 用途说明。

**批次 C · UI / 动效系统性补齐**
README 与实现对齐（封面取色二选一）→ 首页常驻 loop 加「减少动态效果」开关与后台暂停 → 通用 Skeleton + 三态容器铺到下载/排行榜/歌单广场/设置 → 无障碍标签覆盖主链路 → 硬编码色/中文收敛 → 同步 `EMO-UI-Design.html`。

**批次 D · 测试与性能**
Jest + 纯函数单测（版本比较、歌词对齐、设置迁移优先）→ 给 `smoke.js` 提供关闭动画的 debug 通道，恢复下载链路自动化 → 拆分 `Player/index.tsx` → 图片磁盘缓存 → 监听器退订补齐。

---

## 6. 附录

### 6.1 静态指标

| 指标 | 值 |
|---|---|
| `src/` 文件数 / 代码行数 | 638 / 82,055 |
| TSX / TS / JS | 274 / 234 / 96 |
| 注册屏幕 / 导航 Tab / 首页卡 / 设置分类 | 5 / 5 / 4 / 8 |
| 设置项 key 数 | 57 |
| i18n 条目 | 517 × 3（完全对齐） |
| `useNativeDriver` true / false | 79 / 4 |
| `Animated.loop` / `accessibilityLabel` | 10 / 13 |
| 零引用文件 / TODO / 空 catch | 约 32 / 8 / 约 10 |
| 硬编码颜色行 / 硬编码中文条 | 约 272 / 约 563 |

### 6.2 审计边界与未验证项

- 未连接真机，**未做运行时复测**：播放/下载的换源与断点续传、通知/锁屏媒体控制、横竖屏切换、字体实时生效、深浅主题切换均只有代码证据与历史 QA 文档，不代表本轮真机通过。
- 在线音源可用性依赖第三方接口，静态审计无法评估。
- 评分中的「完成度」是**静态取证 + 用户可达口径**，非测试通过率；若按「有自动化回归覆盖」计分，功能完成度会显著低于 89。
- 与 `doc/audit-report-3.8.6.md` 的分数对比存在口径差异（见总体评分下标），仅作趋势参考。

### 6.3 主要证据路径

`README.md` · `CHANGELOG.md` · `doc/release-notes-3.8.8.md` · `doc/audit-report-3.8.6.md` · `design/EMO-UI-Design.html` · `design/README.md` · `package.json` · `publish/version.json` · `scripts/{smoke,release}.js` · `.github/workflows/{check,build-test,release}.yml` · `src/navigation/{screenNames,registerScreens,navigation,utils}.*` · `src/screens/Home/Vertical/{BottomNav,PlayerTransition,Content}.tsx` · `src/screens/Home/Views/{Home/BigCard,Player/index,Download/DownloadPage,Setting/Main,Setting/settings/About}.tsx` · `src/core/{version,lyric,list}.ts` · `src/core/{player/player,download/index,localMusic/index}.ts` · `src/theme/{playerPalette.ts,themes/index.ts,themes/themes.ts}` · `src/components/common/{Glass,AlbumDiscSpin,Text,Image,PageHeader}.tsx` · `src/config/{defaultSetting,migrateSetting}.ts` · `src/utils/{version,playerTransition}.js|ts` · `src/lang/*.json` · `android/app/src/main/AndroidManifest.xml` · `dist/EmoMusic-v3.8.8-*.apk`

---

**一句话总结**：EmoMusic 3.8.8 已经是一个功能扎实、动效讲究、可日常使用的播放器；它现在的短板不在「还能加什么」，而在**把已做的东西接上、说清、验证、并锁进版本管理** —— 先做批次 A 和 B，再谈新动效。
