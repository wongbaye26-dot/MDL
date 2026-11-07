# EmoMusic v3.11.2 发行说明

> 版本 **3.11.2** / versionCode **250**

## 冷启动默认首页
- 启动时不再恢复上次停留的 tab，固定回到首页。

## 列表加载闪屏优化
- JSON 快照与 SQLite 结果相同时不再二次替换列表，避免首屏列表闪一下；
- 保留冷启动骨架与单 tab rows 构建，切页不阻塞。

## 验证
- 真机冷启动默认首页；
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `60573d60be5ebbdeefb3e97770c297ed4a73aede0fda8021ab1ff3acc2c74bcc` |
| armeabi-v7a | `87e1f507fa7bf758f7388595fcf9dd37a9597e868ac89cdc1b7b642d3786dc2d` |
| universal | `05156be17a6642f4a603dbc90790dbdf6fce565a59c25baf4a74d89e5fd69023` |
