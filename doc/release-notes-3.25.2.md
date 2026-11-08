# EmoMusic v3.25.2 修复说明

> 版本 **3.25.2** / versionCode **310**

## 刮削字段读不到
- 读源固定为 JSON（写入权威源），不再从缺少三列的 SQLite 影子表读；
- 启动后异步从 FLAC 文件头回填 `LANGUAGE/DATE/GENRE`，修复此前「文件有标签、曲库没有」的历史数据。

## 说明
- 风格仍取决于文件/源是否有 GENRE；
- 回填只补空缺，不覆盖已有值。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `eadbe418c0229360ad275d649cde279f65f1db86fa030b7535e4eeeefa0ea9e4` |
| armeabi-v7a | `7eef59f6843a263d60e17f5b3d3950bb5454994b611311641aa689f645ecd569` |
| universal | `4f3b7e4bd57ef2ebfecc7603fda1a3331c4d9154468b509ae24c2ad46ead5a45` |
