# EmoMusic v3.24.1 说明

> 版本 **3.24.1** / versionCode **307**

## 粤语识别
- 扩大粤语用字表（啲/咩/咪/喺/囉/喎/啩/㗎 等）；
- 增加「繁体字比例高」判断：歌词繁体占比 >12% 判为粤语；
- 无歌词时按歌名/歌手文字兜底。

## 标签写入
- 实测文件里已写入 `LANGUAGE=普通话`，并非完全没写；
- 年份/风格依赖源数据：QQ/网易年份已接；MusicBrainz 只补非中文歌；
- 扫描 FLAC 会读取 `LANGUAGE/DATE/GENRE` 回填曲库。

## 说明
- 中文歌风格源仍缺，MusicBrainz 对中文覆盖低；
- 若歌曲详情仍为空，请先让曲库重扫一次。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `e79701d1b33bff7ed87ffaef76741f0b0e7a006718ebb2a9c48efb91a5c3804c` |
| armeabi-v7a | `0f2dff1481cf68650e938fefa88f4610887d3fe47849a7f706c6b7d247a9177a` |
| universal | `e5c57051f576ec0d04ca5d1ab0c916bb14e7a46f421d157a4a3c71b934d6301e` |
