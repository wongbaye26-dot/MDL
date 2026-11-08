# EmoMusic v3.42.1 发布说明

发布日期：2026-11-09

## 修复 / 调整

1. **设置 → 界面与动效 → 界面**
   - 「首页上下滑动」→「**页面左右滑动**」，并加说明：该开关控制竖屏首页**左右滑动切页**（关闭后只能用底部标签切换），不是上下滚动。
2. **迷你播放器 / 底部胶囊里的专辑封面自转**
   - 代码无回归。自转由 `common.coverRotation` 设置 + 系统「减少动态效果」共同控制；
     如果系统开发者选项/无障碍里把**动画缩放设为 0**（或开启移除动画），RN `AccessibilityInfo` 会判定为 reduce-motion，封面会停止自转，属预期。
   - 已在正常动画缩放下确认自转恢复（胶囊唱片、播放器页封面均正常）。

## 版本

- versionName `3.42.1`，versionCode `333`（arm64 包 `333003`）
- 构建链与 v3.42.0 一致（RN 0.80.3 新架构 / RNN 8.6.2 / 自研 GlassBlurView）

## 产物

- `EmoMusic-v3.42.1-arm64-v8a.apk`（覆盖升级）
- `EmoMusic-v3.42.1-armeabi-v7a.apk`
- `EmoMusic-v3.42.1-universal.apk`
- SHA256 见 `dist/SHA256SUMS-v3.42.1.txt`
