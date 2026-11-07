# EmoMusic v3.12.21 修复说明

> 版本 **3.12.21** / versionCode **284**

## 歌单内歌曲不能播放（真机验证通过）
根因有两层：
1. 列表点击原来在 rAF 里判断 `homePagerIdle`，非 idle 时直接丢弃点击；
2. 歌单历史条目只有 `local_路径` id，缺 `source/meta`，按 fp id 修复不到，播放器拿不到文件路径。

修复：
- 列表点击直接按完整歌曲对象播放，去掉 idle 丢弃；
- 启动修复歌单时同时按 `local_` id 里的文件路径匹配本地曲库；
- `playMusicInfo` 播放前兜底：缺 source/meta 时按 id/路径找回完整本地条目。

真机验证：歌单 333 → 辞九门回忆 点击后 `PlaybackState=PLAYING`，元数据正确。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `1a8a52596805d50faf1789b1094904db9189fbc91ac2ac3ec8fdbd96ed0345a1` |
| armeabi-v7a | `33b90f6837a97326d21a04b8934715c9c68274b15de63e84d734f1fcb7e32b59` |
| universal | `dc0a3b44298d68bfcbe5d68b743e6f76361fc510a15b46f2dd092fbbdc9b3e64` |
