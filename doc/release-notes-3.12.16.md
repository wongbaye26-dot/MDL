# EmoMusic v3.12.16 修复说明

> 版本 **3.12.16** / versionCode **279**

## 收藏页报错
- 报错 `Cannot read property 'albumName' of undefined` / `toUpperCase of undefined`；
- 原因：加入歌单的精简/在线条目缺少 `meta` / `source`，收藏列表排序与行渲染直接读取；
- 修复：`utils` 排序、ListItem、ListMenu 全部加空值保护。

## 歌单 UI（参考歌单广场）
- 歌单改为双列瀑布流卡片，高矮交错；
- 封面取歌单内第一首有封面的音乐，底部渐变遮罩显示歌单名/数量；
- 删除按钮保留；
- 本地音乐/在线音乐都可通过现有 `ListMusicAdd` 加入。

## 验证
- 真机：收藏页不再报错，歌单瀑布流显示正常；typecheck/lint/assembleRelease 通过。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `09527aaad41b3d120b912e1c0770f924ce49c1ba7b0c2252b369db7234c41815` |
| armeabi-v7a | `d3e86dab45b8079ea2145444710583f76cef1a29bb2d0d5d1984996701f40712` |
| universal | `3563d6d58d83ee007cdbe0a37ec3104c279b8a44f6c28d28365ae7682be97e45` |
