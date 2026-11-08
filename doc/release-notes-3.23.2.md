# EmoMusic v3.23.2 说明

> 版本 **3.23.2** / versionCode **305**

## 歌曲列表文件名问题
- 启动加载曲库时迁移清洗歌名（去扩展名/「 - 歌手」后缀）；
- 扫描和刮削写入前同样清洗。
- 真机截图确认列表歌名已恢复正常。

## Lyrico 插件元数据契约
- 已拉取 `Replica0110/Lyrico-Plugins` 源码；
- 其元数据源返回 `title/artist/album/date/cover`，无 language/genre；
- 已按其字段解析补上现有 QQ/网易搜索结果的发行年份（`time_public` / `publishTime`），不增加额外请求。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `127cd62db734a3934af5515d8489f8e0fcb36bc4ee244c5d40319171238cd02a` |
| armeabi-v7a | `276eca945834f9a7f16a9de3f91cf39db3476475d73f3023c19498cb7a2ab33b` |
| universal | `9a670fe550a1c8e9c16717a89b56ec12123b4ea3b2fe38bf5fd86c1350defcb5` |
