# ADR-0001 动效技术选型与 UI 阶段位置（D8）

- 状态：**已接受（Accepted）**
- 日期：2026-11-06
- 关联任务：U-00（动效与玻璃基础设施）
- 关联风险：R9（动效性能/低端机）、R10（动画依赖与构建风险）

## 背景

阶段 U 要完成 9 项 UI/动效需求（液态琉璃胶囊、共享元素转场、弹性进度条、Skeleton、动效补齐等）。
动手前盘点出三个硬约束：

1. 项目 **没有** `react-native-reanimated` / `react-native-gesture-handler` / haptics 依赖，
   全站 267 处动画全部是 RN 内置 `Animated`。
2. 现有共享元素转场 `src/utils/playerTransition.ts:140` 用 `useNativeDriver: false` 插值宽高，
   播放器页手势只能放在 PagerView 外层（PagerView 会抢竖向触摸）。
3. 原生依赖受 `dependencies-patch.js` / `vendor:check` 锚点约束，RN 版本 0.73.11，
   引入 Reanimated 需要 babel 插件、Proguard 规则与低端机回归。

## 决策

**阶段 U 不引入 Reanimated / Gesture Handler，继续使用 RN `Animated`。**

具体做法：

- 新增 `src/theme/motion.ts` 统一时长/曲线令牌，替换散落的魔法数字；
- 新增 `src/utils/hooks/useReducedMotion.ts`，设置开关 + 系统无障碍双通道；
- 能用 `useNativeDriver: true` 的一律用；只有「宽高/位置像素插值」这类
  RN 不支持 native driver 的属性允许留在 JS 线程，并用以下手段控制成本：
  - 减少同一时刻的 JS 动画数量（同屏不超过 2 个 JS 驱动动画）；
  - 长驻循环动画（首页四卡、圆盘呼吸、跑马灯）在 `reduceMotion` 或页面不可见时停止；
  - 转场优先用 `transform` / `opacity`，避免逐帧 `setState` 重渲染。
- 弹性进度条（U-06）用 `Animated.Value` + `Animated.spring` 实现，不引入手势库。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 引入 Reanimated 3 + Gesture Handler | 需改 babel、Android 构建与 Proguard；与 vendor patch 锚点回归成本高；RN 0.73 兼容窗口窄；收益主要是 60fps 上限，而当前瓶颈更多是「没有统一令牌/没有 reduce-motion/没有骨架屏」 |
| 引入 @shopify/react-native-skia 做液态玻璃 | 包体与 GPU 兼容风险更大，首版液态玻璃用 `BlurView + LinearGradient + 高光插值` 即可达到视觉目标 |
| 继续散落写 `Animated.timing` | 无法统一 reduce-motion，也无法解释「为什么这个动画 200ms、那个 460ms」 |

## 后果

- 正面：零新增原生依赖，构建风险最小；U-00 可在 3 人日内落地并被后续 13 个任务复用。
- 负面：共享元素转场的宽高插值仍在 JS 线程，低端机上可能掉帧；
  若 U-12 真机验证 60fps 不达标，则在 U-13 缓冲内重新评估引入 Reanimated（保持本 ADR 的
  回退分支：`playerTransition` 已封装为单例，替换成本可控）。
- 重新评估触发条件：低端机（API 21-23 代表机）转场掉帧 > 20% 帧，或同屏 JS 动画 > 2 个。

## 相关文件

- `src/theme/motion.ts`（新增）
- `src/utils/hooks/useReducedMotion.ts`（新增）
- `src/config/defaultSetting.ts`（`common.reduceMotion`）
- `src/types/app_setting.d.ts`
- `src/utils/playerTransition.ts`（现存 JS 驱动转场）
