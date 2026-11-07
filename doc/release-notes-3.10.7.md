# v3.10.7 发布说明

> 版本 **3.10.7** / versionCode **227**

## 桌面小组件
- **4×1 已真机添加成功**：深色液态玻璃底、标题/歌手、上一首/播放暂停/下一首；播放暂停按键使用主题色 tonal 圆底。
- 主题色/明暗由 JS 同步：`dark` + `primary` 传给原生，背景/文字/按钮/2×2 遮罩分暗亮两套。
- **2×2 修复尝试**：
  - 去掉 RemoteViews 不允许的裸 `View`，遮罩改 `ImageView`；
  - 封面位图从 520px 降到 300px 以内，避免 RemoteViews 事务过大；
  - 按钮改分层 ImageView（圆形底 + 图标），不再用不稳定的 setColorFilter；
  - Provider 更新加 try/catch，避免宿主直接报“无法添加微件”。
- 真机状态：4×1 可添加；2×2 仍未能确认添加到桌面（NOT RUN），需要继续抓 launcher 宿主日志。

## 拖动进度条从头播放
- 已在 3.10.6 加入 seek 保护窗口；本版未再改动。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功；
- 4×1 真机显示已截图确认；2×2 添加仍待验证。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.10.7-arm64-v8a.apk | `99ca171600684af41e15be9fcc7494811e9d22f9967cef4c20ce05dd04785a64` |
| universal | em-music-v3.10.7-universal.apk | `d980df86cd09f3b40ed6a19607ceb409dc4f1034116301a6ffdb75e31eca82af` |
