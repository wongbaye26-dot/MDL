# EMO Music Design System（v1 提案）

- 状态：**已确认并完成 v1 实施**（2026-11-09；记录见 `doc/design-system-implementation.md`）
- 适用：React Native 0.80.3 / Android；全项目页面，重点为设置页
- 基线：Material You + EMO 品牌；动态种子色、`LiquidGlass`、`Text` / `Icon` 保留现有实现
- 目标：把「每个页面各写一套、每个分类一张彩色卡」收敛为一套可执行、可检查的设计语言
- 依据：`design/README.md`、`design/EMO-UI-Design.html`、`doc/design-audit-settings-ui.md`、`doc/hardcoded-color-and-i18n-policy.md`

---

## 0. 设计原则（去 AI 化）

1. **层级优先于装饰**：先靠分组、字号、间距、分割线建立层级，不用彩色图标墙、渐变、光晕解释结构。
2. **一个页面只允许一种主容器语言**：设置页 = 平铺分组列表；不再「大圆角卡片里套分段按钮/chips」。
3. **颜色来自主题，不来自分类**：除品牌色（种子色）与语义色（成功/警告/危险）外，不新增固定识别色。
4. **图标只做识别，不做装饰**：统一 MaterialCommunityIcons 线性图标，统一尺寸，不用 Emoji、不用彩色图标底。
5. **可复用的控件只保留一份**：Switch、单选、多选、Slider、Stepper、BottomSheet、确认弹窗全项目同源。
6. **动效克制**：只保留状态反馈与页面转场，遵守 `src/theme/motion.ts` 与「减少动态效果」。
7. **深浅一致**：同一套语义 token 在浅色/深色/动态主题下都成立，禁止在页面里写死颜色。
8. **不破坏独特布局**：播放器、播放队列、首页大卡片的布局不在本次统一范围内，只统一公共控件。

---

## 1. Color Tokens

### 1.1 继续使用现有动态色阶

| Token | 来源 | 用途 |
|---|---|---|
| `c-primary` | 种子色 | 主操作、选中态、强调 |
| `c-primary-alpha-100…900` | 主色 10%…90% | 状态层/选中底/描边 |
| `c-primary-light/dark-*` | 主色明暗阶 | 渐变/高光/深色适配 |
| `c-0…c-1000` | 字体灰阶 | 标题/正文/辅助文字 |
| `c-app-background` / `c-main-background` / `c-content-background` | 主题 | 页面/内容/浮层底 |
| `c-button-background` / `c-button-font` | 主题 | 按钮 |
| `c-border-background` | 主题 | 分割线（旧页面） |

### 1.2 新增语义 token（只加 3 个，不再多）

在 `src/theme/designTokens.ts` 中集中定义，页面不再各自写 rgba/hex：

| 语义 | 浅色 | 深色 | 说明 |
|---|---|---|---|
| `danger` | `#C62828` | `#F87171` | 删除/清空/不可逆操作 |
| `warning` | `#B26A00` | `#FBBF24` | 权限缺失、风险提示 |
| `success` | `#2E7D32` | `#34D399` | 已完成/已开启 |

辅助函数：
- `getDanger(theme)`、`getWarning(theme)`、`getSuccess(theme)`
- `getCardSurface(theme)` 统一替代 `surfaces.ts` 里的写死 rgba：
  - 浅色：`theme['c-primary-alpha-900']`（不用纯白卡）
  - 深色：`theme['c-primary-dark-300-alpha-200']`（替代 `rgba(33,28,46,0.55)`）
- `getDivider(theme)`：浅色 `c-primary-alpha-300`，深色 `c-primary-light-600-alpha-200`
- `getGlassTint(theme)`：`rgba(20,16,28,0.42)` / `rgba(255,255,255,0.34)`（供 PageHeader 使用，集中一处）
- `getOnPrimary(theme)`：沿用 `contrastOn(theme['c-primary'])`

### 1.3 使用规则

- 设置页**禁止**出现分类专用 hex（删掉 `screenMeta.ts` 的 8 个彩色 hex）。
- 设置页**禁止**新增 `rgba(120,100,160,...)` 之类写死灰紫。
- 图标默认 `c-450`；选中/关键行 `c-primary`；危险 `danger`；其余不使用彩色。
- 主题色 seed / light / dark 切换后，全部页面只通过 token 跟随，不得重新写死颜色。

---

## 2. Typography Tokens

统一到 **7 档**（逻辑 px，`Text` 组件会乘用户字号倍率）：

| Token | size | 字重 | 行高 | 默认色 | 用途 |
|---|---|---|---|---|---|
| `pageTitle` | 22 | 700 | 28 | `c-font` | 设置页标题「设置」 |
| `sectionLabel` | 11 | 600 | 14 | `c-450` | 分组标题（可 letterSpacing 0.6） |
| `rowTitle` | 14 | 500 | 20 | `c-font` | 设置行主标题 |
| `rowDesc` | 12 | 400 | 16 | `c-450` | 行说明/副标题 |
| `value` | 12 | 500 | 16 | `c-450` | 右侧状态值 |
| `caption` | 11 | 400 | 14 | `c-350` | 页脚说明/提示 |
| `button` | 12 | 600 | 16 | `c-primary` / `contrastOn` | 行内按钮/胶囊按钮 |

规则：
- 不再使用 13.5 / 10.5 / 9.5 / 14.5 / 12.5 等半档字号；旧页面触碰时顺手归一。
- 行标题与描述只差颜色、字号、字重三层中的两层：**14 vs 12 + 500 vs 400 + c-font vs c-450**。
- 页头标题只有一种：22/700；不再出现 27/19/21 三套。
- 大字号无障碍：字号倍率由 `Text` 统一处理；布局必须允许文字换行（`numberOfLines` 只在标题/值处按需使用）。

---

## 3. Spacing Tokens

4dp 基准，只允许以下值：

| Token | 值 | 典型用途 |
|---|---|---|
| `xs` | 4 | 图标与文字、标签内边距 |
| `sm` | 8 | 行内元素、按钮组 |
| `md` | 12 | 行内上下、卡片内小间距 |
| `lg` | 16 | 页面左右边距、行左右内边距、分割线 inset |
| `xl` | 20 | 页面标题区、分组间大间距 |
| `xxl` | 24 | 分组之间 |
| `xxxl` | 32 | 页面顶部/底部大留白 |

规则：
- **页面左右统一 16**（设置首页/二级页/页头全部一致；不再 18/20 混用）。
- 设置行：`minHeight 56`，上下 padding 10–12，左右 16。
- 分组标题：上 24 / 下 6；行间分割线上下 0。
- 列表底部：`NAV_BAR_SPACE`（胶囊导航让位）。
- 横屏紧凑模式：分组间 16、行高 48、页头标题 19/700（仅横屏）。

---

## 4. Radius Tokens

| Token | 值 | 用途 |
|---|---|---|
| `xs` | 4 | Tag/角标 |
| `sm` | 8 | 小控件、缩略图 |
| `md` | 12 | 输入框、分段控件、行内按钮 |
| `lg` | 16 | 浮层/卡片（仅非设置页用） |
| `xl` | 24 | BottomSheet / Dialog |
| `full` | 999 | 胶囊按钮、chips、开关、头像 |

设置页规则：
- **默认不做圆角卡片**：设置分组是平铺列表 + 细分割线；
- 需要承载状态的容器（如路径选择、曲库工具卡片）用 `lg=16`，不做 24 大卡；
- 不再出现 15/17/18/20/22 等散值；新增代码只能用 token。

---

## 5. Icon Tokens

- 统一 `Icon` → MaterialCommunityIcons；仅 PageHeader 的搜索键允许 MaterialIcons（现有实现）。
- 尺寸：`16`（行内小图标/箭头）、`20`（设置行前导图标、页头按钮）、`24`（大按钮）、`28`（播放控制）。
- 设置行前导图标：20dp，颜色 `c-450`；选中行 `c-primary`；**不加彩色圆角底**。
- 分组标题不带图标（用标题本身分组）；页头搜索/返回按钮沿用 20dp。
- 禁止 Emoji、禁止同一功能实心/线性混用；状态类图标（play/pause）保持全站一套。

---

## 6. Elevation Tokens

| 层级 | 规则 |
|---|---|
| 设置页内容 | **无阴影、无卡片投影**；靠背景 tonal 差 + 0.5px 分割线分层 |
| 浮动胶囊 / 批量条 | `elevation: 18` + 柔和阴影（现有规格） |
| BottomSheet | 遮罩 + 圆角 24；不额外发光 |
| Dialog | Material You 弹窗，圆角 24，主/危险按钮 |
| 页面页头 | 平铺（设置页无玻璃、无阴影）；首页/本地/下载继续使用 `PageHeader glass` |

明确禁止：给每一行/每个分组加阴影、给设置页头加玻璃与呼吸光晕。

---

## 7. Motion Tokens

沿用 `src/theme/motion.ts`，不新增魔法数字：

| 场景 | Token | 时长 |
|---|---|---|
| 按压/开关 | `fast` | 110ms |
| 菜单/浮层进出 | `quick` | 170ms |
| 状态切换 | `normal` | 200ms |
| 多选栏/搜索展开 | `emphasized` | 300ms |
| 整页/共享元素 | `page` | 460ms |
| 收起页 | `pageClose` | 300ms |

规则：
- 设置子页进入/退出用 `normal`（200ms）淡入 + 6dp 上浮（现有 `SlideInView` 可保留）；
- `useReducedMotion()` 为 true 时：长驻循环动画直接停（`motionEnabled`），转场直接落终态（`motionDuration`）；
- 不新增无意义动画（背景流动、光晕呼吸、悬浮卡片等）；设置页移除「我的」页头 logo 呼吸光晕。

---

## 8. Component Guidelines

### 8.1 PageHeader（设置页变体）

- 高度：64dp（不含状态栏；横屏 56dp），平铺背景，无玻璃、无 logo、无 slogan；
- 标题：`pageTitle` 22/700，左对齐，距状态栏 12dp、左右 16dp；
- 可选右侧 40dp 圆形图标按钮（与 `PageHeader.HeaderButton` 同规格）；
- 页面顶部留白：标题下 8dp 即开始第一个分组标题；不再有大 Banner。
- 其它页面继续用 `PageHeader`（72dp/21sp）不变；本次只把设置页从 84dp/27sp 归一到 64dp/22sp。

### 8.2 SettingsGroup

```
[分组标题 11/600 c-450]                         ← 无图标、无卡片
 行 1  ────────────────────────────────────────  ← 0.5px 分割线，左右 inset 16
 行 2
 行 3
[分组间 24dp]
```

- 一个分组只承载同类设置；组内不再套二级卡片；
- 分组标题可带 1 行说明（`caption` 11/c-350），不写「一句话营销文案」；
- 组的顺序 = IA（见 §9）。

### 8.3 SettingsRow

| 元素 | 规格 |
|---|---|
| 高度 | 最小 56dp（内容多行时可到 64–72） |
| 左右 | padding 16 |
| 前导图标 | 可选，20dp，`c-450`，无底色 |
| 标题 | `rowTitle` 14/500 |
| 描述 | `rowDesc` 12/400 `c-450`，最多 2 行 |
| 右侧 | Switch（44×26）/ 值文本 12/500 `c-450` + chevron 20 `c-350` / 按钮 |
| 分割线 | 0.5px，inset 16（有前导图标时从图标右缘开始可选） |
| 触控 | 整行可点；Switch 行点击整行即可切换；最小热区 48dp |
| 无障碍 | `accessibilityRole`（switch/button）、`accessibilityLabel`、`accessibilityState` |

管理行只允许三种右侧形态：**Switch / 值+箭头 / 文本按钮**；不再新造 chips、分段、彩色按钮等形态。

### 8.4 选择类控件

- **≤3 个选项**：行内分段控件（高 36、圆角 12、选中主色底、全宽等分），如主题模式；
- **>3 个选项**：右侧显示当前值 + chevron，点击打开单选 BottomSheet（`ActionSheet` 单列 items），
  例如音质（6 档）、倍速（7 档）、语言（3 档但文案长）、文件名格式（3 档）；
- 多选项（如字体大小 6 档）：用分段控件 2×3 或单选 BottomSheet，不再用 chips 换行；
- 所有 BottomSheet 单选：选中项 `active`（主色勾），关闭后立即写回设置。

### 8.5 Switch

- 使用原生 `Switch`；轨道 44×26，选中 `c-primary`、未选中 `c-primary-alpha-800`，
  拇指白/`c-450`；整行点击 + Switch 自身均可切换（避免双重触发：只保留一个 onChange 来源）。
- 不再自定义动画开关；Reduce motion 下只保留颜色变化。

### 8.6 Slider / Stepper

- Slider：仅用于连续值（歌词偏移如需可改单选档位；音量在播放器内保留原样式）。轨道 4dp，拇指 18dp，触控高 48dp。
- Stepper：± 按钮 32dp 视觉 + 44dp hitSlop，值居中 12/600；用于最大缓存等数值。

### 8.7 ActionRow / ValueRow

- `ValueRow`：只读信息（版本/路径/状态）→ 右侧值 12/500 `c-450`，可点击时带 chevron；
- `ActionRow`：行内动作 → 右侧文本按钮（40dp 高、圆角 full、`c-primary-alpha-900` 底 + `c-primary` 字），
  危险操作文字 `danger`；不用整块实心主色按钮（避免每个设置行都像 CTA）。

### 8.8 PageHeader / 二级页统一

- 二级页页头：40dp 圆形返回按钮（`c-primary-alpha-900` 底、20dp `chevron-left`）+ 标题 22/700；
  右滑返回沿用现有手势；
- 二级页内容左右边距 16，分组间距 24；
- 横屏：页头 56dp、标题 19/700、返回按钮 36dp。

### 8.9 BottomSheet / Dialog

- 选择、更多操作：统一 `ActionSheet`（圆角 24、列表行 50dp、危险项 `danger`）；
- 确认/警告：统一 `confirmDialog` / AppDialog（危险按钮 `danger`，取消为文本按钮）；
- 设置页禁止新增 `Modal` 手写弹层、禁止 `Alert.alert`；现有 5 套弹窗逐步收敛到 2 套。

### 8.10 批量操作条

- 复用本次已上线的 `BatchActionBar`（底部停靠、已选计数、更多收纳危险操作）；
- 设置页涉及批量（曲库工具）时沿用，不再自绘。

---

## 9. 设置信息架构（IA）提案

> 原则：**不删任何设置项**；只移动位置、合并重复入口（同一功能只留一处）。
> 用户给出的 10 组未包含现有「音源与搜索」，但该页承载真实功能，不能删除，建议作为第 11 组保留。

### 推荐方案：扁平分组设置首页（分组 + 行内联）

设置首页 = 一条滚动列表，按下面 11 组渲染；复杂子流程保留二级页。

| # | 分组 | 行（来自现有实现） | 二级页 |
|---|---|---|---|
| 1 | 播放设置 | 记住播放进度、自动清空已播放列表、音频焦点自动暂停、启动后自动播放 | — |
| 2 | 音质与音效 | 优先播放音质、播放倍速、切歌淡入淡出、启用音频卸载 | — |
| 3 | 音源与搜索 | 音源管理（当前音源/音质矩阵/自定义源列表）、显示搜索历史、显示热门搜索 | 音源管理二级页（现有 `Source`） |
| 4 | 歌词设置 | 歌词字号/对齐/偏移、逐字/一行/翻译/罗马音/粤拼/简繁、蓝牙歌词/全屏 | — |
| 5 | 本地音乐 | 点击歌曲直接播放、显示专辑名、显示时长、扫描文件夹管理、曲库工具 | 曲库工具（现有 `Tools`）、扫描目录 |
| 6 | 下载管理 | 保存位置（选择目录/应用专属/恢复默认）、文件名格式、下载音质、同时下载数量、使用其他音源、边听边存、下载歌词/封面/元数据、所有文件访问权限 | 目录选择器（现有系统 picker） |
| 7 | 主题与外观 | 主题模式/主题色、字体大小、语言、音源名称、页面左右滑动、减少动态效果、首页卡片动效、封面自转、悬浮栏玻璃、胶囊进度条、分享方式 | 主题色选择（现有弹窗） |
| 8 | 播放器与交互 | 底部导航滑动切歌、底栏进度条可拖动 | — |
| 9 | 通知与系统 | 系统权限设置、通知权限、电池优化、自启动/后台运行、系统应用设置、通知栏显示封面、品牌保活提示 | 系统权限页（现有 `System`） |
| 10 | 数据与存储 | 资源缓存（大小/清理）、歌曲信息缓存/清理、日志开关/查看/清空、数据库自检与备份（现 Tools/迁移自检，开发入口保持隐藏） | 日志查看、曲库工具数据自检 |
| 11 | 关于与版本 | 版本、框架、设计语言、平台、检查更新、致谢与声明 | — |

**去重**：「所有文件访问权限」只在下载管理出现一次；系统页保留「系统权限设置/通知/电池/自启动」，移除重复行。
**不新增**：不暴露当前未在 UI 出现的隐藏设置（如 `autoHidePlayBar`、`togglePlayMethod` 等），除非用户另行确认。
**保留**：现有 `SettingScreenIds` 与 `global.lx.settingActiveId` 恢复逻辑；旧 id 继续映射到对应深页。

### 备选方案 B：保留 8 个二级页

设置首页只做「简化页头 + 8 个入口的扁平列表」，每个二级页内部按上面 11 组重新分组。
优点是改动小、导航心智不变；缺点是设置首页仍不是真正的「分组设置」，用户列出的分组只能体现在二级页内。
**建议选 A；若担心改动面，先 A 的 P1（1–6 组）再逐步迁移。**

---

## 10. 实施文件计划（确认后执行）

| 阶段 | 文件 | 内容 |
|---|---|---|
| P0 Tokens | 新增 `src/theme/designTokens.ts` | Typography/Spacing/Radius/Icon/Elevation/Danger/GlassTint 语义 token |
| P0 组件 | 重写 `Setting/components/ui/index.tsx` | Group（平铺）、Row、ToggleRow、ChoiceRow、ValueRow、ActionRow、StepperRow、Segmented、SliderRow；删除写死色 |
| P0 页头 | `Home/Views/Mine/index.tsx` | 去掉 logo/光晕/slogan/玻璃，改 64dp 简单「设置」页头 |
| P0 壳 | `Setting/Vertical/Main.tsx`、`Grid.tsx` | 扁平分组首页；保留子页 overlay/滑动返回/导航联动 |
| P1 设置页 | `settings/Refactored/*.tsx` | 按 §9 拆分成可复用的行片段；合并重复项；统一弹窗 |
| P1 二级页 | `settings/Source/*`、`settings/Tools/*`、`settings/Backup/*` | 换 token、去彩色图标墙、统一 ActionSheet/ConfirmDialog |
| P2 全局 | `PageHeader.tsx`、`Mine` 头部、列表行、批量条 | 统一 40dp 按钮/页头尺寸/glass tint；不动播放器与队列布局 |
| P2 清理 | `screenMeta.ts`、`surfaces.ts`、旧 `Section/SettingRow/CheckBoxItem/...` | 删除彩虹色与旧组件残留（确认无引用后） |

**验收清单**（必须给证据）：
1. `npm run typecheck`、`npm run lint`、`npm run test:unit` 通过；
2. `./gradlew :app:assembleDebug` 成功、设备安装可启动；
3. 浅色 + 深色 + 两个种子色截图对比（设置首页/3 个二级页）；
4. 每个设置项可到达且能改、能持久化（抽查 + 全量走查）；
5. 减少动态效果开启时无循环动画/转场直接落位；
6. 竖屏 + 横屏 + 大字号下不截断、不重叠；
7. 胶囊导航与设置子页联动正常（进入/返回/切 Tab）；
8. `logcat -b crash` 无新增、控制台无红屏/警告。

---

## 11. 治理规则（写进评审清单）

**新增/修改页面必须遵守：**
- 颜色只用 `theme['c-*']` 或 `designTokens` 语义色；新增 hex 直接拒绝；
- 字号只能用 §2 的 7 档；新增字号直接拒绝；
- 间距/圆角只能用 §3/§4 token；新增散值需说明理由；
- 图标只用 `Icon`（MCI），禁止 Emoji、禁止彩色图标底；
- 同类控件只能复用现有组件（Switch/Segmented/Choice/Value/Action/Slider/Stepper/Sheet/Dialog）；
- 不新增装饰性渐变、光晕、呼吸动画；玻璃只允许 PageHeader/胶囊/播放器浮层；
- 深色、浅色、动态主题必须同时验证；
- 不得为了统一而改播放器/队列的独特布局。

**代码检查**：新增代码的 `#RRGGBB`、`rgba()`、裸 `fontSize`、裸 `borderRadius`、裸 `padding*` 均视为 review 阻断项
（玻璃高光/阴影的材质白黑除外，必须集中在 designTokens）。
