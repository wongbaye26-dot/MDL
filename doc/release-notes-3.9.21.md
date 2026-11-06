# v3.9.21 发布说明

> 版本 **3.9.21** / versionCode **212**

## R1 切读 repository
- `getReadSource()` 默认值从 `json` 改为 `repository`；
- `getLocalMusicList()` 默认从 SQLite 读取；
- DB 为空 / 读取失败时自动回退旧 JSON，避免升级后曲库变空；
- 保存路径不变：仍写 JSON + 影子表，保留回滚能力。

真机回归：本地曲库 238 首 / 6.69GB，与切读前一致。

## 移除设置搜索
- 按用户要求删除设置首页搜索框，恢复纯 8 分类列表。

## 仍未完成
- tracks.id 主键切换 + 收藏/歌单/队列引用迁移；
- 迁移断电恢复演练；
- CUE 歌单实际播放（测试歌单 CUE n15 当前为空）；
- 歌词偏移听感、回收站清空真机；
- A2-10 全量回归与 v3.10.0 发版。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.9.21-arm64-v8a.apk | `816c257ea90f882f0ffa07537a580f38a529e3a755250a29beac560c74d9ef68` |
| universal | em-music-v3.9.21-universal.apk | `6ec6508ccac4021ca3d51d08e4dee46221d55a4a1510e60f5602de567c9411b3` |
