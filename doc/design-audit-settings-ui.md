# EmoMusic 设置页视觉审计报告（v3.50.0 / 2026-11）

- 审计对象：设置首页（「我的」Tab 内的 Setting）及其 8 个二级设置页，以及首页 / 本地音乐 / 播放器 / 下载中心 / 播放队列的视觉基线
- 技术栈：React Native 0.80.3（新架构）、RNN 8.6.2、Material You 动态主题 + 自研 LiquidGlass
- 当前版本：`v3.51.1`（审计时设备安装版本）
- 方法：读源码 + 两套主题真机截图 + 静态统计（未修改任何业务代码）
- 结论：**先审计、再冻结 Design System、最后改设置页**。本报告为第一阶段交付，未动代码。

> 说明：任务要求的 `redesign-existing-projects`、`unslop-ui-skill` 不在本会话可用 Skill 目录中（当前仅 office-* 与 software-company）。
> 本审计按 `software-company` 的交付流程执行，并以 `design/README.md`、`design/EMO-UI-Design.html`、
> `doc/hardcoded-color-and-i18n-policy.md`、`src/theme/*` 作为项目既有设计依据。

---

## 1. 执行摘要

项目**已有**不错的底层基础：动态种子色（`generateThemeFromSeed`）、约千级的 `c-primary-*` 色阶、
统一的 `Text` / `Icon` / `LiquidGlass` / `PageHeader`、集中式动效令牌（`src/theme/motion.ts`），
设置页也有两套组件体系（旧 `Section/SettingRow/CheckBoxItem` 与新 `Group/ToggleRow/ChoiceRow`）。

但设置页目前呈现明显的「AI 拼装感」，主要不是颜色本身，而是**层级、容器、图标与控件语言不统一**：

1. **设置首页实际是「我的」页**：84dp 玻璃页头 + 品牌 logo + 呼吸光晕 + 27sp「我的」+ slogan
   `EMO Music · 享受音乐，遇见更好的自己`，再进入 8 个入口的彩色卡片。用户要求的是简洁 Settings 页，
   不要大型 Banner / 无意义装饰。
2. **每个分类都是一张大圆角卡片**（24dp），卡片里再塞彩色图标底、分段按钮、chips，属于「卡片套控件」；
   二级页同样是「Group 卡片 + 卡片内 chips」的重复结构。
3. **图标颜色是 8 个硬编码彩虹色**（`screenMeta.ts`: `#EC4899/#8B5CF6/#A855F7/#F97316/#3B82F6/#F59E0B/#64748B/#10B981`），
   不跟随 Material You 种子色，浅色主题下页面像彩色 App 启动器而非系统设置。
4. **字号/行高没有 scale**：设置页 `Text` 的 size 实际使用 15 种取值（9.5/10/10.5/11/11.5/12/12.5/13/13.5/14/14.5/15/16/18/19），
   13.5 与 10.5 是「主力字号」但都不是整档；不同行的标题/描述层级几乎相同。
5. **两套设置组件并存**：旧 `Section/SettingRow/CheckBoxItem/ChoiceItem/Slider/SubTitle` 仍在
   Tools / Source / Backup 等页面大量使用（`<CheckBoxItem` 20 处），和新 `Group/ToggleRow` 的间距/字号/分割线不一致。
6. **分割线与内边距不统一**：`Section` 分割线 `height 0.5 / marginLeft 20`，`ui/Group` 是 `0.5 / marginLeft 16`，
   下载行、本地行则没有分割线；页面左右边距 16/18/20 三种混用。
7. **页头高度/返回键不统一**：`PAGE_HEADER_H = 72` 与 `SETTINGS_HEADER_H = 84` 两套；
   返回键 36dp（设置二级页）/ 38dp（本地音乐页头）/ 40dp（PageHeader.HeaderButton）。
8. **弹窗体系有 5 套**：`ActionSheet`（13 处）、`Modal`（27 处）、`Alert.alert`（6 处）、
   `tipDialog`（14 处）、`confirmDialog`（36 处）；设置页里同时出现 ActionSheet / AppDialog / Modal。
9. **触控目标不足**：设置里的 chips 高 30、ActionRow 按钮高 30、Stepper ± 按钮 30，
   低于 Material 3 / HIG 的 48dp 建议热区（视觉可 30-36，但热区必须补足）。
10. **玻璃使用不一致**：PageHeader 的玻璃 tint 写死 `rgba(255,255,255,0.34)` / `rgba(20,16,28,0.42)`，
    设置在子页没有玻璃页头，而「我的」页头有玻璃 + logo 呼吸；用户已明确「避免大面积毛玻璃」。
11. **色彩污染**：设置目录内 `#hex` / `rgba()` 共 103 处；全项目 UI 代码（不含主题生成数据）仍有大量硬编码色。
12. **设置信息架构与用户心理模型不一致**：「所有文件访问权限」同时出现在下载与系统两页（重复）；
    存储/缓存/日志分散；播放/音质/歌词切分与用户列出的 10 类不完全对齐。

**审计判定**：设置页可以直接在现有主题与组件基础上做**结构与组件级重做**，不需要换设计语言、
不需要改设置数据结构；但必须同时冻结 Design System，否则会再次回到「每个页面一套样式」。

---

## 2. 视觉基线（现状实测）

### 2.1 颜色

| 项目 | 现状 | 证据 |
|---|---|---|
| 动态主题 | 种子色生成 `c-primary` + 10 级明暗 × 9 级透明度 + 字体灰阶 `c-000…c-1000` | `src/theme/themes/utils.js`、`src/theme/themes/generate.ts:140` |
| 页面/内容底 | `c-app-background`、`c-main-background`、`c-content-background`；半透明主背景会被 `getSolidBackground` 压平 | `src/theme/solid.ts` |
| 设置卡片底 | 浅色 `c-primary-alpha-900`，深色写死 `rgba(33,28,46,0.55)` | `Setting/components/surfaces.ts:21` |
| 卡片描边/分割线 | 浅色 `rgba(120,100,160,0.06/0.10)`，深色 white 8%/6% | `surfaces.ts:25,29` |
| 分类图标色 | **8 个固定 hex**，不随主题 | `Setting/components/screenMeta.ts:8-15,41-43` |
| 危险色 | 各处写死 `#F87171` / `#FF6B6B` / `#EF4444`，无统一 token | `ui/index.tsx`、TaskItem、LocalMusic 等 |
| 硬编码量 | 设置目录内 hex/rgba **103 处**；全项目 UI `#hex` 356 处 / 72 文件（含主题数据），JSX 中文文本节点 338 处 | 统计脚本，见附录 A |

### 2.2 字体

- 唯一入口 `Text`（`src/components/common/Text.tsx`），`size` 为逻辑值再乘用户字号倍率；无完整 type scale。
- 设置页实际字号分布（`Text size` 统计）：
  `11×47, 10.5×25, 11.5×24, 10×21, 12×14, 15×13, 13.5×12, 18×10, 9.5×8, 16×8, 14×7, 13×7, 14.5×4, 12.5×4, 19×3`。
- 页面标题：`我的` 27sp/800（`Mine/index.tsx:80`）；设置子页 19sp/700（`Vertical/Main.tsx:156`）；
  `PageHeader` 21sp/800（`PageHeader.tsx:86`）——三套页头标题规范。
- 行标题/描述：设置主力 `13.5` + `10.5`；`PageHeader` 副标题 11；列表行标题 14；无统一语义（Title/Body/Label）。

### 2.3 图标

- 统一 `Icon` → `MaterialCommunityIcons`（`Icon.tsx`），`PageHeader` 额外支持 `MaterialIcons` 的 search。
- 实际尺寸 9–28 共 15 种，高频：20×23、16×23、18×21、12×18、14×16、15×14。
- 设置页分类图标是「27dp 圆角图标底 + 15sp 线性图标 + 固定彩底」；
  列表行 `SettingRow` 是 16sp 图标 + 32? 图标底；二级页 `Group` 头部 15sp；
  同一个「播放」在不同页面出现 `play`（实心）与 `play-outline`（线性）两种风格。

### 2.4 间距 / 圆角 / 阴影

- 间距无 token：页面横向 16（PageHeader）/18（设置 Grid）/20（设置子页、我的页头）；行内 10–14。
- 圆角分布（全项目）：14×29、16×27、10×22、12×20、20×19、4×18、17×16、13×12、18×12、9×10、15×9、24×9。
  设置：Group/Section 卡 24、chips 15、模式按钮 12、返回键 18、ActionRow 30 高。
- 阴影：浅色设置卡无阴影；深色 `elevation:0`；悬浮胶囊/批量条有 elevation 18；内层 chips 无层级区分。

### 2.5 玻璃 / 动效 / 控件

- `LiquidGlass` 使用 12 处（底部胶囊、迷你播放器、PageHeader、设置子页? 实际 PageHeader/Mine 有，子页没有）。
- 页头玻璃 tint 写死：`PageHeader.tsx:71`。
- 动效令牌齐全（`MotionDuration.fast/quick/normal/emphasized/page`），但设置子页/其它页面仍混用魔法数字 200/240/300。
- 控件：设置内 Switch 集中在 `ui/index.tsx`（ToggleRow/CustomToggleRow），全项目其它页少见原生 Switch；
  Slider 仅 1 个（`Setting/components/Slider.tsx`，基于社区 slider）；分段按钮在 Appearance 手写、chips 在 ChoiceRow 手写、
  Tools 里用旧 CheckBoxItem/选择行。即「同类控件多种实现」。

---

## 3. 页面横向对比（视觉基线）

截图见 `doc/images/design-audit/`（浅色/深色各 7 张）。

| 页面 | 页头 | 背景 | 主容器 | 圆角/阴影 | 图标 | 备注 |
|---|---|---|---|---|---|---|
| 首页 | 自定义大标题「Emo音乐」+ 搜索 | 主题背景 + 大卡片渐变 | 4–5 张渐变卡 + 列表 | 卡 20/24，强阴影/渐变 | 彩色渐变卡上的白色图标 | 品牌感强，装饰多 |
| 本地音乐 | `PageHeader glass` 21sp + 副标题标签 | 主题背景 + 玻璃页头 | 平铺行 + 字母索引 + 工具行 | 行无卡，chips 胶囊 | MCI 主题色 | 接近成熟 Material 列表 |
| 下载中心 | `PageHeader glass` 21sp + 3 个 Tag | 主题背景 + 玻璃页头 | 任务行（20dp 圆角卡） | 行卡 20 | 品牌/来源图标 | 行卡与本地列表不一致 |
| 播放器 | 自定义全屏（封面/歌词/控制） | 封面取色/渐变 | 无列表 | 自定 | 自定义 | 独特布局，不应强行统一 |
| 播放队列 | 自定义 CoverFlow | 深色/模糊 | 3D 封面 + 列表 | 自定 | 自定 | 独特布局 |
| 设置首页 | **「我的」84dp 玻璃 + logo 光晕 + 27sp + slogan** | 主题背景（带主色 tint） | 3 张大卡（24dp）+ 8 行彩色图标 | 卡 24，无阴影 | 8 固定彩色图标 | 本次重做重点 |
| 设置二级页 | 36dp 圆形返回 + 19sp 标题 + 11sp 描述 | 同上 | 每节一张 24dp 卡 + chips/分段 | 卡 24 | 15sp 彩色图标 | 卡片嵌套、控件拥挤 |

---

## 4. 设置页专项问题清单

> 级别：P0 = 影响可用性/必须修；P1 = 明显不一致/重做时必改；P2 = 打磨项。

| ID | 级别 | 问题 | 证据 |
|---|---|---|---|
| S-01 | P0 | 设置首页是「我的」品牌页：logo+呼吸光晕+大标题+slogan，非 Settings 语义 | `src/screens/Home/Views/Mine/index.tsx:27-82`（页头 84、27sp、slogan、glow loop） |
| S-02 | P0 | 8 个入口图标固定彩虹色，完全不跟随动态主题 | `Setting/components/screenMeta.ts:8-15,41-43` |
| S-03 | P1 | 设置首页 3 张大卡 + 内部 8 行，信息层级靠彩色图标区分，不是靠分组/字号 | `Vertical/Grid.tsx`；截图 `light-settings-home.jpg` |
| S-04 | P1 | 二级页所有 Group 都是 24dp 大卡，卡内再放 chips / 分段 / 大按钮，卡片嵌套 | `ui/index.tsx:254`；`Appearance.tsx:50-120` |
| S-05 | P1 | 字号无 scale：13.5/10.5 不是整档，与全局 14/11、标题 21 不统一 | `ui/index.tsx` 多处 `size={13.5}` / `size={10.5}`；统计 15 种字号 |
| S-06 | P1 | 两套组件体系并存，间距/分割线/行高不一致 | 旧：`Section`（12 处）、`CheckBoxItem`（20 处）、`SubTitle`（7 处）；新：`Group`（31 处）等 |
| S-07 | P1 | 分割线 inset 20 vs 16；页面横向 padding 18 vs 20 vs 16 | `Section.tsx:127`（marginLeft 20） vs `ui/index.tsx:263`（marginLeft 16）；`Grid.tsx` padding 18，子页 20 |
| S-08 | P1 | 页头三套：我的 84/27sp、设置子页 36 返回+19sp、PageHeader 72/21sp | `headerMetrics.ts:2`、`PageHeader.tsx:15`、`Vertical/Main.tsx:156` |
| S-09 | P1 | 触控目标不足：chips 30、ActionRow 30、Stepper 30 | `ui/index.tsx:266,269,271` |
| S-10 | P1 | 「所有文件访问权限」在下载与系统重复 | `DownloadStorage.tsx:104`、`System.tsx:74` |
| S-11 | P1 | 分类图标语义不统一：播放/歌词/主题等分类色与图标风格混用；同功能实心/线性图标并存 | `screenMeta.ts`；`Icon.tsx` ICON_MAP |
| S-12 | P1 | 弹窗体系 5 套；设置内混用 ActionSheet/AppDialog/Modal/Alert | 统计：ActionSheet 13、Modal 27、Alert 6、tipDialog 14、confirmDialog 36 |
| S-13 | P2 | 玻璃 tint 写死；设置子页无玻璃页头；我的页头大玻璃与「避免大面积毛玻璃」冲突 | `PageHeader.tsx:71`、`Mine/index.tsx:52` |
| S-14 | P2 | 设置信息架构分散：音质/播放/歌词/音源、存储/缓存/日志边界模糊；用户要求的 10 组与现有 8 页不一致 | `Main.tsx` SETTING_SCREENS / 各 Refactored 页 |
| S-15 | P2 | 硬编码色/中文：设置目录 103 处颜色字面量，错误/危险色不统一 | 统计脚本 + `grep` |

---

## 5. 必须保留 / 不能碰

- 设置数据与持久化：`defaultSetting.ts` 的 key、`updateSetting`、`global.lx.settingActiveId` 恢复逻辑不改协议；
  只允许 UI 重排（key 不删、含义不改）。
- 动态主题机制：`theme.useSeed/seedColor/seedDark`、`generateThemeFromSeed`、`c-primary-*` 色阶。
- `LiquidGlass` 实现（底部胶囊/迷你播放器/PageHeader），本次只统一 tint 与使用范围，不替换实现。
- 播放内核、音源适配、下载业务、本地曲库扫描/迁移逻辑。
- 独特布局：播放器、播放队列、首页大卡片不动布局（仅统一页头/按钮等公共控件时复用）。
- 所有现有设置项必须仍可到达（允许移动分组、合并重复项、改变入口路径）。

---

## 6. 风险与开放问题

1. **设置首页扁平化 vs 保留 8 个二级页**：扁平化最符合用户列出的分组，但改动面大；混合方案（分组 + 保留深页）折中。
   需确认后再实施。
2. **现有 8 个 `SettingScreenIds` 与 `global.lx.settingActiveId` 恢复**：若改分组入口，需要保留旧 id 的迁移映射
   （已有 `LEGACY_SCREEN_IDS`），否则热重载/升级后可能定位不到。
3. **固定分类色去留**：去掉彩虹色后，分类识别度下降；建议用「统一中性图标 + 主色选中态 + 分组标题」补偿，
   并在深色/浅色、不同种子色下验证。
4. **不删设置项前提下的新分组**：用户列出的 10 组未包含现有「音源与搜索」；这个页面必须保留，
   建议作为第 11 组（或并入播放设置，但会降低可发现性）。
5. **动态主题下危险色**：需要新增语义 `danger` 色（浅色/深色两档），否则删除/清空按钮在部分种子色下对比度不足。

---

## 7. 结论与下一阶段

- 结论：设置页值得做**结构 + 组件级重做**，而不是只换颜色；现有主题 token、Text/Icon/LiquidGlass 可以复用。
- 下一步（本报告之后、写代码之前）：
  1. 确认 `design/DESIGN-SYSTEM.md` 的 Tokens 与组件规范；
  2. 确认设置页 IA 方案（扁平分组 vs 混合）；确认新增「音源与搜索」组；
  3. 确认后按 DESIGN-SYSTEM §8 的实施计划改代码，并跑验收清单。

## 附录 A：静态统计（可复现）

```bash
# 字号分布
grep -rhoE "size=\{[0-9.]+\}" src/screens/Home/Views/Setting --include=*.tsx | sort | uniq -c | sort -rn
# 圆角分布（全项目）
grep -rhoE "borderRadius: [0-9.]+" src --include=*.tsx --include=*.ts --include=*.js | sort | uniq -c | sort -rn
# 设置目录硬编码色
grep -rcE "#[0-9a-fA-F]{6}|rgba\(" src/screens/Home/Views/Setting --include=*.tsx --include=*.ts | grep -v ":0" | sort -t: -k2 -rn
# 组件使用量
grep -rn "<Group\b" src/screens/Home/Views/Setting --include=*.tsx | wc -l   # 31
grep -rn "<CheckBoxItem\b" src/screens/Home/Views/Setting --include=*.tsx | wc -l # 20
```

## 附录 B：截图清单（浅色/深色各 7 张，均 540px 宽）

`doc/images/design-audit/light-home.jpg`、`light-local.jpg`、`light-download.jpg`、`light-settings-home.jpg`、
`light-appearance.jpg`、`light-player.jpg`、`light-queue.jpg`，以及对应 `dark-*.jpg`。
