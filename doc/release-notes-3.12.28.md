# EmoMusic v3.12.28 修复说明

> 版本 **3.12.28** / versionCode **291**

## 歌单在线条目（KW）
- 歌单广场收藏来的在线条目是扁平结构：`pic`/`lrc`/`album` 在顶层、没有 `meta`；
- 播放前归一化：补 `meta.picUrl/albumName`，缺 source 时从 id 前缀推断；
- 列表封面读取 `meta.picUrl ?? item.pic`，现在能显示封面/来源/专辑。

## 歌单加载慢
- 进入歌单时不再重写在线条目（大歌单会二次刷新导致慢），只修复本地 `local_` 条目。

## 歌单封面尺寸
- 所有歌单卡片统一高度 180，封面尺寸与自建歌单一致；保留双列排布与渐变文字。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `32627228941a813c8e0a07bb545b9e2fa6a6ef6980188d0525e4c88485de72e3` |
| armeabi-v7a | `6a7c0670989cc0397739d61d6ac563a7ab027013d2ca4e3b5df120db8e36f3f4` |
| universal | `89674f098d0e9d5944d05bfff9267f889175bbfd151da29a5547b4c9a5c7472a` |
