# EmoMusic v3.28.0 发行说明（审计修复第一批）

> 版本 **3.28.0** / versionCode **318**

## P0 修复
1. **曲库读源语义修正**
   - JSON 仍是默认/权威源；
   - `setReadSource('repository')` 才切 SQLite，不再强制写死 `json`，也不再默认读缺列 DB。
2. **刮削跳过无变化文件**
   - 写文件前读取 FLAC 现有 TITLE/ARTIST/ALBUM/DATE/GENRE/LANGUAGE；
   - 与目标值完全一致时跳过整文件重写，只计数「跳过(无变化)」；
   - 减少 mtime 抖动、MediaStore 重新索引和存储写入放大。

## P1 修复
1. **网络超时真正取消**：`withTimeout` 超时后调用 `httpFetch.cancelHttp()`；
2. **release 签名配置**：删除 release 中残留的 `signingConfig signingConfigs.debug`；
3. 已用 apksigner 验证：`CN=Emo Music`，SHA-256 `020c0c4b...9890a`。

## 测试
- 新增 `tests/language.test.js`（粤语/普通话/日/韩/英判断与粤语歌手兜底）；
- 单元测试 19 → **24**，全部通过。

## 门禁
- typecheck 0 / lint 0 / test 24/24 / assembleRelease 成功；
- 已安装真机。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `62b905034b7b6c1574f43f548865a663c51852c9ba9fb02f1379746bc22d136c` |
| armeabi-v7a | `97ecd4b2f753688bdc388deb66c93aaa5cfde52952fdcfb6f5d424b9ffcbc99d` |
| universal | `db7e68e6ce1fd626a8acf4cabe7f760429d8b19fe2cc686dceb958333c93304b` |
