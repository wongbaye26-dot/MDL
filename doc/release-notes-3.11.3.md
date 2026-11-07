# EmoMusic v3.11.3 发行说明

> 版本 **3.11.3** / versionCode **251**

## 冷启动本地列表无感加载
- 启动首页期间后台预加载 SQLite 曲库到内存；
- 打开本地音乐页直接同步命中内存列表，不再走骨架/二次替换；
- 仍保留骨架作为极端情况下兜底。

## 本地 tab 跟手度
- 当前 tab 走懒缓存；
- 空闲时分片预构建其余 4 个 tab 的 rows（每 80ms 一个），切 tab 优先命中缓存。

## 验证
- 冷启动点开本地页约 1s 内出完整列表；
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `cc34f8f79b5e97f55248ab0aebbb427a113a2f15bd44c3e5c1b9c46bb54e8628` |
| armeabi-v7a | `b513ce9b42711c0afd120a5dd6cdee8d48466c5c31db0180cd2824c5a35e6c29` |
| universal | `5ad1a193b2405d5d1fdd733fbae01142a3dc0c129cb586c0c09a7779b68009f4` |
