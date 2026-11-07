# v3.10.15 发布说明

> 版本 **3.10.15** / versionCode **235**

## 2×2 三键修复
- 控制行改为**等宽三槽自适应**（layout_weight=1），不再按固定总宽排布；
- 按键尺寸 上一首 30 / 播放 36 / 下一首 30，各自在槽内居中；
- 修复「下一首显示不全 / 按键漂移」：2 格宽度较窄时不再被裁切。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功；
- 真机 2×2：上一首/播放/下一首全部完整显示且等距。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.10.15-arm64-v8a.apk | `4403157bbbbe075cbc89ed3fa428eada54103569f806f9da33011057dfe1c5d3` |
| universal | em-music-v3.10.15-universal.apk | `dd4aa8601f58abb868cb150bb1a038cdb919f28fa2a1ecbd3d47a6fd6f89c305` |
