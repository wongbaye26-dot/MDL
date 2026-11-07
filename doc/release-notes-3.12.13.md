# EmoMusic v3.12.13 修复说明

> 版本 **3.12.13** / versionCode **276**

## 冷启动收藏→试听列表卡死
- 根因：收藏页用 `InteractionManager.runAfterInteractions` 触发列表加载，冷启动时队列可能一直不空闲，试听列表只有头部、内容空白；
- 修复：改为 60ms 定时触发 `mylistToggled`，不再依赖交互队列。
- 真机验证：冷启动进入收藏→试听，最近 30 首正常显示。

## 本地排序规则
- 之前为性能移除 `localeCompare` 后，中文变成 Unicode 编码顺序；
- 现在排序键加入拼音首字母（`initialOfText`），按 A-Z 分组后再按名称排序，和字母索引条一致；
- 排序键仍只预计算一次，性能不受影响。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `0cdaa99011cdeb25c5e27003af6a1ffd1846bf1f2436715ef9e4e0dcbeb9080d` |
| armeabi-v7a | `1d69ece057d7e66d391a644738278c32222bdca5bd2898d97ffc535e28f51dba` |
| universal | `34f9230731d7e38443d57244572644a671cb86a7eeb3a08d2aa14b8419e0bdc3` |
