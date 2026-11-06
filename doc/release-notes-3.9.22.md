# v3.9.22 发布说明

> 版本 **3.9.22** / versionCode **213**

## 迁移断电恢复演练（A2-05 补）
- 新增 `runPowerLossDrill`：
  1. 全量同步 SQLite；
  2. 删除 40% DB 行，模拟写一半断电；
  3. 重启恢复：从旧 JSON 全量重建影子表；
  4. 校验 DB 数、缺失、多余。
- 接入「音乐工具 → 数据库自检」自动序列，结果在自检卡内展示；
- 只动 SQLite 影子表，不改旧 JSON、不碰列表引用。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功。
- 真机演练结果见自检卡（本轮构建后待跑）。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.9.22-arm64-v8a.apk | `3d7ddb299b5a238747256edbd3523634666ba82a3c83747ce72f8bf1e4d4c609` |
| universal | em-music-v3.9.22-universal.apk | `029e2e04f0500d278f0ff92ecd3a9967de65176b4effb4f9562afd68ffc27a0c` |
