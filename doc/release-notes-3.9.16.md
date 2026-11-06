# v3.9.16 发布说明

> 版本 **3.9.16** / versionCode **207**

## 音源管理内部
- 概览卡：改为新 `Group` + 2×2 统计格（音源数/最高音质/上次检测/当前状态）；
- 当前音源卡：改为 `ValueRow` 展示名称/状态/版本/作者，`ActionRow` 提供重新初始化与打开主页；
- 源列表、音质矩阵、音质检测仍沿用功能块（下一批继续）。

## 曲库工具
- 工具卡片圆角/间距/图标统一新设置 UI。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.9.16-arm64-v8a.apk | `87872b9134ea1e7ab46d1c2d6471cf74fd13101b294326d787ebf5bf42d7374c` |
| universal | em-music-v3.9.16-universal.apk | `23ea5fce7e301b15ee1fe96d175d312f1ab36bec617cf590453a9e36c75526a7` |
