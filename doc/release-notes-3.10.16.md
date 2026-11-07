# v3.10.16 发布说明

> 版本 **3.10.16** / versionCode **236**

## A-3 tracks.id 迁移修复
之前 apply 是 no-op（DB 0/曲库 0），原因是 apply 依赖的 id_map 在断电/回滚演练后为空。

修复：
- apply 前**强制重建指纹 + id_map**；
- 结果增加 `id_map` 大小、DB 前后行数，便于真机诊断。

## 真机结果
- 预演：曲库 244 首、可映射 243 首、列表引用 8 条、冲突 0；
- 应用：备份 244；id_map 244；**DB 244→244，更新 244 行；曲库 244 首；列表映射 8 条；冲突 0；7925ms**；
- 迁移后播放验证：本地歌曲正常 PLAYING（「爱的故事上集」）。

## 待验证
- 收藏/用户歌单/队列引用逐项 UI 复核；
- 回滚流程真机验证。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.10.16-arm64-v8a.apk | `0b860502d57b45653c124aff2fcdd678529c5af9caf3a405b49ba8792bd598e0` |
| universal | em-music-v3.10.16-universal.apk | `66dc23144336dcb2d4eafb5ae1d9ad1b9413d98d2362adbc44b55cba33770060` |
