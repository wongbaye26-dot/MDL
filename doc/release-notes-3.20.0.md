# EmoMusic v3.20.0 发行说明

> 版本 **3.20.0** / versionCode **295**

## 在线歌单播放
- 修复扁平在线条目缺 `meta._qualitys/_types` 导致 `getPlayQuality` 崩溃、几秒自动切歌；
- 补齐 `picUrl` / `albumName` / `source` / `songmid`；
- 无 `interval` 时从歌词时间轴推导时长，格式 `04:27`。

## 换源歌词
- 自动换源成功后，重新拉取**实际播放音源**的歌词并刷新，避免原源歌词对不上。

## 歌单
- 长按歌单：编辑名称 / 删除；
- 歌单封面统一尺寸，封面取歌单内第一首音乐；
- 歌单详情支持系统返回和左边缘右滑返回；
- 歌单歌曲列表显示封面/来源/时长；
- 添加歌单图标替换为用户提供的 SVG 并对齐尺寸。

## 其它
- 大字号下播放器歌名/歌词裁切、设置主页滚动与底部遮挡修复；
- 收藏页崩溃修复。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `ae9dcfa2db35927c8d94d4b8bbcbb779eb1aac63b05c97b59bd9d87a4063d31f` |
| armeabi-v7a | `2aefc07feaed8d5055e32ea30eaa97a12bcf7ab5661e3eff191d0ae6404b64af` |
| universal | `14d8419b744d4ccdfd0cf6be46edc4428ab2570c84ef38c0ac114445865edd6b` |
