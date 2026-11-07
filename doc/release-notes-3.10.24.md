# v3.10.24 发布说明

> 版本 **3.10.24** / versionCode **244**

## 冷启动本地列表载入慢
- 首屏不再空等 SQLite：先用 JSON 快照尝试秒出（随后 DB 权威数据覆盖）；
- 数据未就绪时直接显示 **8 行骨架列表**，页头显示「载入中…」，不再先闪「0 首 / 0B / 正在扫描」。

## 确认项
- 用户确认：下一首/暂停正常；
- 用户确认：重启手机后小组件正常。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.10.24-arm64-v8a.apk | `1f416a3bd67a4ba033c6720b05bbabf8b55a7a817ed9e1e3bff88d159ba21ab0` |
| universal | em-music-v3.10.24-universal.apk | `e2bdbccedbe164468ce008323c47cfb380078add7b85687f2ed0c34852b4aa1a` |
