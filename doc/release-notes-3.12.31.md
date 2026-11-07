# EmoMusic v3.12.31 修复说明

> 版本 **3.12.31** / versionCode **294**

## 在线歌单歌曲不能播放/自动切歌
- 错误日志：`TypeError: Cannot convert undefined value to object at getPlayQuality`
- 根因：歌单广场收藏来的扁平在线条目没有 `meta._qualitys` / `meta._types`，取播放音质时崩溃，随后自动切歌；
- 修复：归一化时补齐 `_qualitys`（由 `types` 推导）和 `_types`，播放前统一处理。

真机验证：歌单「流弊的」→「爱一个人好难」点击后 `PlaybackState=PLAYING`，元数据正确，不再几秒自动切歌。

## 时长格式
- 从歌词推导时长时分钟补零：`04:27`。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `dadec36c0e1dce57a347b4ccc60c5f262cf33db0320dc08a28a65d95e3b435e4` |
| armeabi-v7a | `560c9641393e90edca1af7d2905266477dd770b3f8d30f8ce764ad8289182a70` |
| universal | `305c60dc2d64a6afe330419c148776cb5d5429dfd45d51730ab0c85b3eb6e3f6` |
