# EmoMusic v3.12.19 修复说明

> 版本 **3.12.19** / versionCode **282**

## 歌单内歌曲不能播放（彻底修复）
- 之前按 id 从列表反查仍可能因 listId/缓存不一致取不到条目；
- 现在列表点击直接把**当前显示行的完整 musicInfo** 交给播放器（`playMusicInfo`），不再反查；
- 排序、过滤、歌单修复后都能播对歌。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `0195a938bae6fbdbf68530f850bffdcad471e664d3f5b367ebf32ac9f46e5fa2` |
| armeabi-v7a | `b34b1667b68ea1a97cf6fd8f42a558401761b3df479efeeb08d7be2ddc0ee7a6` |
| universal | `9046aae6873b6e25be254d971cf177f74c5ff7d18aa49e84ff566c96418f5fde` |
