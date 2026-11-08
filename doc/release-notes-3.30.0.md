# EmoMusic v3.30.0 发行说明（审计修复第三批）

> 版本 **3.30.0** / versionCode **320**

## P1-2 语种人工纠正
- 歌词快捷菜单新增「歌曲语种」；
- 可选：自动判断 / 粤语 / 普通话 / 英文 / 日文 / 韩文；
- 选择后立即重新计算粤拼与翻译；
- 本地歌同时写回曲库 `meta.language`；
- 在线歌没有可写 meta，使用本地覆盖表（按歌曲 id 持久化）。

## 说明
- 语种优先级：用户手动纠正 > 曲库字段/歌词判断；
- 覆盖表只保存用户主动选择，不自动写入。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `2e246087d1e4d59646ea6f15635e9df9949f857539b8ebebe6d1b7c9870600be` |
| armeabi-v7a | `2e17b3c1c93f5b2d0fc7b97394dda1b501cc9478fd8697d669e9e543a48c987f` |
| universal | `51a4bf8fcd12c3f4326ba266d0b7c1bbfeeffccecb734be25cf06873cca2ca6c` |
