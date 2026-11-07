# EmoMusic v3.12.26 修复说明

> 版本 **3.12.26** / versionCode **289**

## 歌单详情右滑返回
- 之前父级 PanResponder 被列表长按/滚动抢走；
- 改为**左侧边缘起手捕获**：从屏幕左边缘向右滑 >70dp 返回歌单封面页；
- 真机验证：333 详情左边缘右滑成功回到封面页。

## 添加歌单图标尺寸
- SVG 图标整体放大：竖屏 u(30)、横屏 u(30)/顶部 u(26)，与相邻收藏/详情图标视觉对齐。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `471b35d2ccabe2e25eb59e0cb72d5fcfde472484fb56b5278cf71e5b1c85f829` |
| armeabi-v7a | `c9ef90ced92928293e5b61c2c1fd13c9f62ace80e3574936f13e3d2007e47876` |
| universal | `ab398b0007e1f702e5c4819fb15c06fde472fbbfa55eb86ffa72929ee6219a4c` |
