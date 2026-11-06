# 硬编码颜色 / 文案收敛策略（阶段 U-11）

> 基线：3.8.8 审计实测 —— Hex 颜色 186 处（46 文件）、UI 代码里的 `rgba()` 约 293 处、
> 中文字符串字面量 803 行（96 文件）、i18n key 517 × 3 语言。
> 这些都是**存量**，不在阶段 U 一次性全量迁移；本文定义新增代码的门槛与后续整改方式。

## 规则

1. **新增代码不得引入 Hex 颜色**：一律用主题 token（`theme['c-*']`）或已有语义色
   （`theme['c-primary']`、`c-450`、`c-content-background`…）。玻璃高光/阴影这类
   「材质白/黑」允许使用 `rgba(255,255,255,x)` / `rgba(0,0,0,x)`，但必须集中在本组件内。
2. **新增用户可见文案不得硬编码中文**：走 `t('key')` / `global.i18n.t('key')`；
   若 key 不存在，先在 `src/lang/zh_cn.json`、`zh_tw.json`、`en_us.json` 三处补同 name 的 key。
   例外：只给开发者看的日志、调试开关。
3. **改到哪、迁到哪**：任何任务触碰到的文件，若该行附近有 Hex 颜色或硬编码中文，
   顺手迁到 token/i18n，不做无关的大范围重排。
4. **存量颜色优先级**（后续单独任务处理）：
   - P1：`Player/index.tsx`、`Home/BigCard.tsx`、`QueueCoverFlow.tsx`、`Aside.tsx` 的 `rgba()`；
   - P2：`Setting/components/screenMeta.ts`、`ThemeSettings.tsx` 的 Hex；
   - P3：主题生成器 `theme/themes/*` 里的十六进制（属于主题数据，不算违规）。
5. **验收**：新代码 review 时检查 `#RRGGBB` 与中文字面量；存量按文件逐步收敛，
   进度记录在阶段 U 的 `U-11` 任务里，不新开进度载体。

## 本批（阶段 U）已做

- 新增组件（Skeleton / StateContainer / LiquidGlass / SleepTimer* / LyricSettings* / LetterIndexBar /
  ListeningStatsModal / StatsArt）全部走主题 token，新增 Hex 0 处；
- 我的页头光晕从硬编码紫色改为 `theme['c-primary']` + 动态透明度，跟随主题种子色；
- 主链路无障碍：播放器控制键、下载任务行、在线列表行、Chip、设置开关补 `accessibilityRole` /
  `accessibilityLabel` / `accessibilityState`；
- 首页四卡、圆盘自转/呼吸、跑马灯、统计卡入场全部接入「减少动态效果」。

## 未做（如实记录）

- 803 行硬编码中文未批量迁 i18n（需要同步 3 份 JSON，风险高、收益低，留给独立任务）；
- 186 处 Hex / 293 处 UI `rgba()` 未批量 token 化；
- 设计稿 `design/EMO-UI-Design.html` 未随本轮 UI 更新（需要设计工具人工同步）。
