# 设置页重设计 · 实施记录（v1）

- 日期：2026-11-09
- 状态：**已实施并真机冒烟**，未发版
- 依据：`design/DESIGN-SYSTEM.md`、`doc/design-audit-settings-ui.md`
- 决策（用户确认）：扁平分组首页、新增「音源与搜索」组、去掉固定彩虹分类色

## 1. 已完成

### 1.1 设计令牌
- 新增 `src/theme/designTokens.ts`：
  - `Type`（7 档字号）、`Space`（4/8/12/16/20/24/32）、`Radius`（4/8/12/16/24/full）、`IconSize`、`LineHeight`
  - 语义色 `getDanger/getWarning/getSuccess`、`getCardSurface/getDivider/getGlassTint/getOnPrimary`
- 设置页不再新增 hardcode hex/rgba；删除分类彩虹色（`screenMeta` 不再用于设置首页）。

### 1.2 设置组件（扁平化）
- 重写 `Setting/components/ui/index.tsx`：
  - `Group`：分组标题 + 行 + 0.5dp 分割线，**不再使用 24dp 大卡**；组内不再嵌套卡片。
  - `ToggleRow`：56dp 行、整行可点、Switch 统一 token。
  - `ChoiceRow`：≤3 个短选项用分段控件；长选项/多项改为「值 + 箭头 → ActionSheet 单选」（音质/倍速/淡入淡出/语言等）。
  - `ValueRow` / `ActionRow` / `StepperRow` / `CustomToggleRow`：统一字号 14/12、右侧值 12、行内按钮 32dp + 8dp hitSlop。
  - 所有行有 `accessibilityRole` / `accessibilityLabel` / `accessibilityState`。

### 1.3 设置首页
- `Mine/index.tsx`：删除品牌 logo / 呼吸光晕 / slogan / 大玻璃页头，改为 64dp 平铺「设置」页头（横屏 56dp）。
- `Vertical/Grid.tsx`：改为扁平分组首页，11 组，顺序：
  播放设置 → 音质与音效 → 音源与搜索 → 歌词设置 → 本地音乐 → 下载管理 →
  主题与外观 → 播放器与交互 → 通知与系统 → 数据与存储 → 关于与版本。
- 深页保留两个：**音源管理**（`SourceManage`）、**曲库工具**（`ToolsPage`），入口分别为 ValueRow / ActionRow；
  深页页头统一 40dp 返回 + 22sp 标题，返回后回到设置首页。
- 「所有文件访问权限」去重：只在「下载管理」出现；系统组移除重复行。
- 「最大缓存」从播放设置移到「数据与存储」；「通知栏显示封面」移到「通知与系统」。
- 修复 `download.maxDownloadNum` 选项 value 类型不匹配（之前显示「—」）：改为数字 value，行内显示 `5 个`。

### 1.4 深页与横屏
- `Vertical/Main.tsx`：只保留两个深页 section；旧 8 个 id 仍可被 `normalizeSettingScreenId` 识别（恢复映射不破坏），
  但不会再作为主入口。
- `Horizontal/index.tsx`：去掉左侧宫格导航卡，横屏直接显示扁平设置页，深页仍走整屏 overlay（竖屏/横屏手势一致）。
- `headerMetrics`：设置页头 84 → 64（横屏 56），深页 overlay 偏移同步。

## 2. 修改文件清单

新增：
- `src/theme/designTokens.ts`
- `src/screens/Home/Views/Setting/Vertical/SourceManage.tsx`
- `src/screens/Home/Views/Setting/Vertical/ToolsPage.tsx`
- `doc/design-system-implementation.md`（本文件）
- `doc/images/design-audit/after/*.jpg`（实施后截图）

修改：
- `src/screens/Home/Views/Mine/index.tsx`
- `src/screens/Home/Views/Setting/Vertical/Grid.tsx`
- `src/screens/Home/Views/Setting/Vertical/Main.tsx`
- `src/screens/Home/Views/Setting/Horizontal/index.tsx`
- `src/screens/Home/Views/Setting/components/headerMetrics.ts`
- `src/screens/Home/Views/Setting/components/ui/index.tsx`
- `src/screens/Home/Views/Setting/settings/Refactored/{Playback,Lyric,Appearance,DownloadStorage,Library,SourceSearch,System,Misc}.tsx`

未删除：`settings/Basic/*`、`settings/Player/*`、`settings/Tools/*`、`settings/Source/*`、旧 `Section/SettingRow/CheckBoxItem` 等仍在仓库中
（部分被 Tools/Source 引用）；确认无引用后再清理。

## 3. 验收证据

### 3.1 静态检查 / 构建
| 检查 | 命令 | 结果 |
|---|---|---|
| TypeScript | `npm run typecheck` | exit 0 |
| ESLint | `npm run lint` | exit 0（仅 2 条既有 warning：`Player/index.tsx` exhaustive-deps） |
| 单元测试 | `npm run test:unit` | `tests 32 / pass 32 / fail 0` |
| Debug 构建 | `./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a` | `BUILD SUCCESSFUL in 1m 16s` |
| Release 构建 | `./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a` | `BUILD SUCCESSFUL`；APK 已安装到 SM-S938B |

### 3.2 真机冒烟（SM-S938B / Android 17）
- 设置页打开：简单「设置」页头，11 组扁平列表，无卡片嵌套、无彩虹图标。
- 开关：点击整行或 Switch 均能切换，返回后状态保持（抽查：启动后自动播放、通知栏显示封面、页面左右滑动）。
- 选择类：`优先播放音质`/`切歌淡入淡出` 等打开 BottomSheet 单选并立即回写（已切到 Hi-Res / 4 秒）。
- 深页：`音源管理` 打开正常、返回正常；`曲库工具` 入口存在（深页内容样式待下一轮统一）。
- 主题：明亮/暗黑切换立即生效，深浅色下分割线/文字/开关对比度正常。
- 横屏：设置页正常渲染（左导航 + 扁平列表），无截断。
- 崩溃：`logcat -b crash` 无新增记录。

### 3.3 截图
- 实施后：`doc/images/design-audit/after/after-light-top.jpg`、`after-light-notifications.jpg`、
  `after-light-landscape.jpg`、`after-dark-theme.jpg`、`after-dark-source.jpg`、`after-choice-sheet.jpg`
- 实施前：`doc/images/design-audit/light-*.jpg`、`dark-*.jpg`

## 4. 已知问题 / 未完成

1. **Tools / Source 深页内部样式未统一**：`settings/Tools/parts.tsx`、`settings/Source/*` 仍使用旧卡片
   （`getCardBackground`、radius 24、旧 CheckBoxItem/Section）。本轮只统一了深页页头与入口，内部需要下一轮 P2。
2. **主题色 swatches 组件**（`MaterialYouColors`）仍为旧样式，未套用新 token。
3. **旧组件未删除**：`Section/SettingRow/CheckBoxItem/ChoiceItem/Slider`、`Horizontal/NavList`、
   `Vertical/Header`、`screenMeta` 等确认无引用后再删，避免误伤 Tools/Source。
4. **减少动态效果**：设置页无新增动画；深页 SlideInView 沿用旧逻辑，未在本次重新回归（标 `未验证`）。
5. **未做完整真机 QA**：本轮只做冒烟；弱网、横竖屏播放器等回归项仍按 `doc/qa-3.41.0-rn076.md` 待跑。
6. **版本未升**：代码在 master 未发版；建议下一轮完成 P2 + 回归后发 `v3.52.0`。

## 5. 下一轮建议

1. P2：统一 Tools / Source / MaterialYouColors 的视觉（卡片 → 分组、旧控件 → 新 ui kit）。
2. 删除旧组件与死代码（Section/SettingRow/CheckBoxItem/ChoiceItem/Slider/Header/NavList/screenMeta），跑全量引用检查。
3. 补真机回归：减少动态效果、横屏深页、深色/种子色组合、大字号。
4. 发版 `v3.52.0`，附前后截图与 release notes。

---

## 6. P2 补充（2026-11-09 同日）

### 已完成
- `settings/Tools/parts.tsx`：工具卡片去掉 24dp 大卡/彩色图标底/描边，改为平铺分组标题 + 内容；
  警告色统一 `getWarning`，分割线/底色统一 designTokens，字号归一到 14/12/11。
- `settings/Source/*`：`SummaryCard` 状态色改 `getSuccess/getWarning`；`MusicQualityCheck`
  成功/失败色改 `getSuccess/getDanger`；`QualityMatrix` 主色上的文字改 `getOnPrimary`；
  字号归一（14/12/11）；深页内部与设置主页视觉一致（截图 `after/after-dark-source.jpg`）。
- `settings/Basic/ThemeSettings.tsx`：主题色 swatches 字号归一（12/11）。

### 仍未完成 / 未验证
- Tools 深页（曲库工具）本次只改了共享卡片，**未重新进入工具深页逐项走查**（入口已在首页出现）；
- 工具内部部分列表仍使用旧 `CheckBoxItem/ChoiceItem/Slider/InputItem/SubTitle`（grep：CheckBoxItem 22 处），
  未完全替换；这些组件与新的 `Group/Row` 视觉已接近，但未做逐项截图对比。
- 旧组件/旧页面仍未删除（`Basic/*`、`Player/*`、`Horizontal/NavList`、`Vertical/Header`、`screenMeta`、
  `Section/SettingRow/...`），确认无引用后再清理。
- 减少动态效果、大字号、深页横屏仍未重新回归（`未验证`）。
- 版本未升，未发版。

### 更新的验证
- `npm run typecheck` → exit 0
- `npm run lint` → exit 0（2 条既有 warning）
- `npm run test:unit` → `tests 32 / pass 32 / fail 0`
- `assembleRelease`/`assembleDebug` arm64 → BUILD SUCCESSFUL（P2 改动后已重新打包安装）

---

## 7. 用户反馈修复（设置页细节）

1. **下载管理「保存目录」错位**：去掉 `ValueRow + 负 margin` 的组合，改为独立 `pathBlock`（标题 14、路径 12、按钮行 8dp 间距），
   不再出现分割线压住路径/按钮错位；路径可完整换行显示。
2. **下载音质显示不全**：
   - 根因 1：`qualityOptions` 用 `useMemo([])`，首次渲染时 `global.lx.qualityList` 还没初始化，永远停在 fallback 的两档；
     改为 `useQualityList()` + 依赖更新；
   - 根因 2：分段控件只适合 ≤3 项；音质改为 `ChoiceRow inline`，把 Hi-Res / FLAC 无损 / 320k / 128k 全部铺开显示；
   - 圆角 chip 的文字按字符宽度显式给宽，修掉 Android 上「320k」被裁成「320」的问题。
3. **设置标题右侧加两个图标**：`设置` 右侧新增 38dp 圆形图标按钮（音源管理 / 曲库工具），
   样式对齐本地音乐页头的圆形图标按钮（`c-primary-alpha-900` 底 + 20dp 图标 + 按压反馈）；
   点击通过 `settingsDeepScreenRequested` 事件打开对应深页（新增事件与 Main 监听）。

验证：`npm run typecheck`/`lint` 0 error，`npm run test:unit` 32/32；release arm64 重新打包安装，
截图见 `after/after-header-icons.jpg`、`after/after-download-manager.jpg`、`after/after-tools-page.jpg`。

---

## 8. 继续统一（下载音质对齐播放音质 + 旧文件清理）

### 下载音质对齐播放音质
- 移除下载音质的 `inline` chips 特例，恢复与「播放设置 → 优先播放音质」完全相同的交互：
  **右侧显示当前值 + chevron → 点击打开 BottomSheet 单选**（选项来自 `useQualityList()`，
  不会再出现初始化时机只显示 128k/320k 两档的问题）。
- `ChoiceRow` 删除 `inline` 分支和相关的显式宽度/helper，保持控件只有「分段 / 值+Sheet」两种形态。

### 旧文件清理
删除确认无引用的旧设置页与组件：
- `settings/Basic/` 下未使用的旧页面：`FontSize / IsCoverRotation / IsHomeCardMotion / IsHomePageScroll /
  IsReduceMotion / Language / ShareType / SourceName / index.tsx`（保留 `ThemeSettings.tsx`、`UserApiEditModal/`，
  它们仍被外观页 / 音源页 / 首页引用）。
- `components/SettingRow.tsx`、`components/screenMeta.ts`、`Vertical/Header.tsx`、`Horizontal/NavList.tsx`。
- 保留但暂不删除：`Section / SubTitle / ChoiceItem / InputItem / Slider / CheckBoxItem / Toggle / surfaces`
  —— 播放器歌词设置面板（`Player/LyricSettingsPanel`、`LyricQuickMenu`）仍引用其中一部分；
  该面板属于播放器内嵌 UI，下一轮再统一到新组件。

### 验证
- `npm run typecheck` → exit 0
- `npm run lint` → exit 0（2 条既有 warning）
- `npm run test:unit` → 32/32
- `assembleRelease` arm64 → BUILD SUCCESSFUL
- **真机验证未完成**：本轮最后构建后设备 ADB 掉线（`adb devices` 为空），下载音质改为「值+Sheet」后的真机截图待设备恢复后补。

---

## 9. 横屏设置页专项优化

横屏（`useHorizontalMode`）从「单列拉伸」改为**两列瀑布布局**：

- `Vertical/Grid.tsx`：横屏时左右两列，每列宽度均分、列间距 20dp：
  - 左列：播放设置 / 音质与音效 / 音源与搜索 / 歌词设置 / 本地音乐（5 组）
  - 右列：下载管理 / 主题与外观 / 播放器与交互 / 通知与系统 / 数据与存储 / 关于与版本（6 组）
  - 整页仍共用一个 ScrollView，避免两列各自滚动导致阅读顺序混乱；竖屏顺序不变。
- `components/ui/index.tsx`：横屏时分组间距 24→16dp、行高 56→48dp，减少纵向占用。
- 页头：沿用 `SETTINGS_HEADER_COMPACT_H=56` 与 19sp「设置」标题；右侧音源管理/曲库工具图标保持 38dp。
- 深页（音源管理/曲库工具）在横屏仍走原来的整屏 overlay（含左导航偏移），返回手势一致。

### 验证
- `npm run typecheck` / `npm run lint` → exit 0（2 条既有 warning）
- `assembleRelease` arm64 → BUILD SUCCESSFUL
- **未验证**：设备 ADB 仍处于断开状态（`adb devices` 为空），横屏两列布局尚未做真机截图与回归；
  设备恢复后需补：横屏设置页两列截图、横屏深页、大字号、减少动态效果。
