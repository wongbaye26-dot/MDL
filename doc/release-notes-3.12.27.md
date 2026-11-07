# EmoMusic v3.12.27 修复说明

> 版本 **3.12.27** / versionCode **290**

## 歌单在线音乐变暗/不能播放
- 移除 ListItem 按音源支持度压暗（在线条目被误判成不支持时整行变暗）；
- 在线条目缺 `meta` 时补空对象，缺 `source` 时从 id 前缀推断；
- 进入歌单/启动修复时对在线条目同样补齐字段。

## 歌单封面
- PicImage 强制 `resizeMode='cover'`，封面按卡片大小裁切，和多列卡片对齐。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `4fdb9421720bf2007db55c251be97ea815c937ea405c24094aa70c16ab5ec647` |
| armeabi-v7a | `dbad31d810d0a87a495d778928fe8990287d7e5f20200db790d08d4ec584478b` |
| universal | `add02dd8de43b6de920ca55b9c7e31b3d09435a1c7d7531c7d6cf8135491cb54` |
