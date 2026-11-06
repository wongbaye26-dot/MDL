# v3.10.3 发布说明

> 版本 **3.10.3** / versionCode **223**

## A-3 tracks.id 迁移脚手架
- 新增 `idMigration.ts`：
  - 预演：fp 映射、收藏/歌单引用影响、冲突；
  - 应用：备份 → DB tracks/playlist_tracks 主键切换 → 曲库/收藏/默认列表/用户歌单/@play_info 引用改写；
  - 回滚：按 id_map 反向切回 legacy id。
- 设置 → 本地曲库 → 迁移自检：
  - 进入页面自动预演并显示影响条数；
  - 应用前二次确认。

## 真机结果（WIP）
- 预演通过：曲库 238 首、可映射 238 首、列表引用 8 条、冲突 0。
- 应用返回：备份 238、DB 0 行、曲库 0 首、列表 0 条（no-op）。
- 说明映射在 apply 路径没有生效，迁移**尚未完成**；需要继续排查 id_map/DB 读取时序后重试。
- 由于 no-op，旧数据未被破坏；回滚按钮保留。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.10.3-arm64-v8a.apk | `55e4f408b852989a6eac684e5a5d081358598c58b93eefe8bbb2056b23c9343e` |
| universal | em-music-v3.10.3-universal.apk | `89553bfb85d644203589edd25dc5222fd0833f1d5ecd376e23ea290668aa0f5c` |
