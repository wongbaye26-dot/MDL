# v3.10.5 发布说明

> 版本 **3.10.5** / versionCode **225**

## 严重修复：后台/锁屏自动切歌无声
根因：淡入淡出在后台执行 `setVolume(0)`，随后靠 JS `setTimeout`/sleep 升回；后台 JS 定时器被挂起，音量永久停在 0。
修复：
- 后台/锁屏切歌跳过淡入淡出，直接恢复用户音量；
- 淡入回调发现不在前台时立即恢复音量；
- AppState 回到 active 且 `isPlay`、音量≈0 时兜底恢复。

## 桌面小组件（2×2 / 4×1）
- 新增两个 AppWidget：
  - `MusicWidgetSmallProvider`（2×2）
  - `MusicWidgetWideProvider`（4×1）
- 风格参考迷你播放器：深色圆角玻璃、封面、歌名/歌手、播放/暂停、下一首；点击卡片打开应用。
- `WidgetModule` 由 JS 播放事件同步标题/歌手/播放态/本地封面；
- 播放/下一首按钮通过媒体按键广播控制。
- 已在系统 `dumpsys appwidget` 确认两个 Provider 注册成功。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功；
- 小组件视觉/控制待桌面实际添加验证（NOT RUN）。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.10.5-arm64-v8a.apk | `692672eb5155f39d31e85ffe36729b2b272dc2cb27b90b4f0d9d188f9bc9d904` |
| universal | em-music-v3.10.5-universal.apk | `c0a02fbdadbe341d460398cff52845381acb10ebcf29670466a3be16872359a2` |
