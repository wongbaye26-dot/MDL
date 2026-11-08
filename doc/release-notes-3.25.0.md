# EmoMusic v3.25.0 修复说明

> 版本 **3.25.0** / versionCode **308**

## 标签写了但曲库不显示（根因）
- 曲库 SQLite `tracks` 表没有 `language/year/genre` 三列；
- `updateLocalMusicMeta` 只更新 JSON 缓存，SQLite 双写把这些字段丢掉了；
- 所以文件里有 LANGUAGE，工具仍显示 247 待补全、风格全「未分类」。

修复：
- `tracks` 表新增 `language/year/genre` 列；
- 老库启动时自动 `ALTER TABLE` 补列；
- 映射层写入/读取同步这三个字段。

## 粤语识别
- 扩大粤语用字 + 繁体字比例判断（v3.24.1）。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `9d602d6eb626a55bc907c6481428d111d92b84e4e42254c0e8d77e1e8152844d` |
| armeabi-v7a | `a8bf9e890e2e076798c4ad4c8582aa27b45965dcb13daaf968ffa77240efab10` |
| universal | `3ef6f03fbdfcc3bc8c81f2c5862b60bcc561492e063343f8c095e854cb9eccb4` |
