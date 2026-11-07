# EmoMusic v3.11.6 修复说明

> 版本 **3.11.6** / versionCode **254**

## 修复 3.11.5 卡死
- 3.11.5 的主页面预挂载（hidden display:none）在 PagerView 内导致页面重挂载/卡死；
- 已回滚到 3.11.4 的稳定页管理；
- 真机验证：App 启动正常，下载/本地/我的 0.8s 内可切换。

## 说明
- 首次切页的轻微闪烁暂未修复，后续会用不依赖 PagerView 子页预挂载的方案重做（例如壳层预热/首帧占位），不再直接隐藏挂载 PagerView 子页。

## 验证
- typecheck 0 / lint 0；assembleRelease 成功；真机启动与切页正常。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `153a3b8206dd3a32c27784cd6b45dcea4c9637042a3e24049006eeaf3c9cc11a` |
| armeabi-v7a | `5ac8b7878e4d26a41910d3cb4c7931f64460be4a5c64324b2f423d7af5367ffd` |
| universal | `0d92d9fb3ff710cd1b3705e096b79b743757fc04d0139d4002ff4c29d8fa6c6d` |
