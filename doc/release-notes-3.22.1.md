# EmoMusic v3.22.1 修复说明

> 版本 **3.22.1** / versionCode **298**

## 刮削写入文件失败
- 根因：原生写标签只支持歌名/歌手/专辑；FLAC 扩展标签在原生写入成功后直接返回，DATE/GENRE/LANGUAGE 从未写入；
- 修复：FLAC 原生写完后，再用纯 JS 补写 `TITLE/ARTIST/ALBUM/DATE/GENRE/LANGUAGE` 整组 Vorbis 标签（避免只写三个导致丢标签）；
- 补全任务结果区分「写入文件」与「仅曲库」数量，提示更准确。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `c6578885992d4b54c4f07ab80eadcf53ee89024adbec97d67415e8de4922ed52` |
| armeabi-v7a | `164bee2acdafd91393c3b4b1a040cccad4ecab2225372268ef92fc5f5ded873f` |
| universal | `2e41459b9e5a6f5b60052d65a599e6356907233d957ea772730cde4d5a7e694b` |
