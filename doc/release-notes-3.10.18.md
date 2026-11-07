# v3.10.18 发布说明

> 版本 **3.10.18** / versionCode **238**

## tracks.id 迁移诊断
- 迁移自检新增 **fp / legacy 前缀统计**：
  - 曲库：fp 244 / legacy 0；
  - SQLite：fp 244 / legacy 0；
  - 列表引用：fp 5 / legacy 29（非本地/在线引用，不需要迁移）；
- 结论：本地曲库与 DB 已全部迁移到 `fp:` 主键；列表中的本地收藏引用已迁移 5 条。

## 真机流程
- 迁移应用成功：DB 244→244、更新 244 行、13767ms；
- 回滚演练：DB 244、曲库 244、218ms；
- 回滚后重新应用成功，最终保持 fp 迁移态。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.10.18-arm64-v8a.apk | `97903409739bd9f27b5bbdb2c8f4f1bfc5d02d9a47638bc0342f2b1f6034569d` |
| universal | em-music-v3.10.18-universal.apk | `5012eb990cc45fa620423af6ebe802607b8aa2978da10c11a892c44441b4c4d7` |
