# v3.9.13 发布说明

> 版本 **3.9.13** / versionCode **204**

## 设置首页
- 从两列磁贴改为**分组列表**：播放与显示 / 界面与曲库 / 下载与系统，共 8 行，一屏显示完整；
- 行样式统一为 32dp 图标 + 标题 + 摘要 + 箭头。

## 深色 LOGO
- 原 logo PNG 自带白底，深色下是一块白。
- 生成透明单色遮罩 `emo-logo-mono.png`，深色用主题前景色 tint + 半透明底，亮色用深色 tint；不再有白块。

## 下载中心
- 任务行改**圆角卡片**：20dp 卡片圆角、52dp 封面、14dp 封面圆角；
- 进度条 4dp、完成勾角标、卡片间距统一；
- 页头/卡片/列表与设置页同一套视觉。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功；
- 真机：设置首页一屏列表、深色 LOGO、下载中心卡片列表均已确认。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.9.13-arm64-v8a.apk | `13604b1da10eb55191105d12563fa183ef474a8022b7f4ab308e23dd44503bd7` |
| universal | em-music-v3.9.13-universal.apk | `ebe2f17443841cc98fa6b1872a041a9c90cbbc8790740584911fea3f4b169f5a` |
