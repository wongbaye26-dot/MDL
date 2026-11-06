# v3.9.12 发布说明

> 版本 **3.9.12** / versionCode **203**

## 设置第二批
- 全局 `Section` 改为新 Group 同款卡片：标题在卡片内、圆角 24、统一分隔线；
- 全局 `SettingRow` 收紧为 32dp 图标 / 13.5 标题 / 10.5 描述；
- 本地曲库：列表显示用新 ToggleRow，曲库工具卡片统一到新视觉；
- 音源与搜索、系统与权限、缓存日志与关于：外壳与内部 Section 行已统一；
- 工具/音源/权限/关于的功能块逻辑未变，仅统一 UI 容器。

## 第一批回顾
播放与音质、歌词与显示、界面与动效、下载与存储已使用全新 Group/ToggleRow/ChoiceRow/StepperRow 重写。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功；
- 真机：设置首页磁贴、音源与搜索新卡片布局正常。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.9.12-arm64-v8a.apk | `22d76e1b26a893191dd19e41f74729348d8207863935cb5b6cfec14017c19aba` |
| universal | em-music-v3.9.12-universal.apk | `9df8ce567f316c4ac454a3ccda14b1a4e29e3ff942739347f576c871ba8d46b6` |
