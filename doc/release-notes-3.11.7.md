# EmoMusic v3.11.7 发行说明

> 版本 **3.11.7** / versionCode **255**

## 首切闪烁优化（安全版）
- 不再预挂载 PagerView 子页（3.11.5 曾导致卡死）；
- 给每个主页面壳层加主题内容底色，首帧挂载时不再露出透明/黑底，减少“闪一下”；
- 保留原有页面淡入/上浮动画。

## 验证
- typecheck 0 / lint 0；assembleRelease 成功；
- 真机冷启动切下载/本地，0.3s 内内容出现，无卡死。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `8413f2ab1e11792f3c79a390da53689d5f11a9e3870e0290fb13ad30a8ad0f3b` |
| armeabi-v7a | `339805e0af9b11aecbd98e63a7287445688c4fff9a60722bdb5dd5e3e2df0b86` |
| universal | `6c6dd2e488640d48083a9c66eb86b20ca15533b542fd648412d8942632c3cb17` |
