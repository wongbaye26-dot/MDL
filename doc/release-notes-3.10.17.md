# v3.10.17 发布说明

> 版本 **3.10.17** / versionCode **237**

## 收藏页歌单删除
- 收藏 → 歌单：歌单封面右上角新增删除按钮，支持长按删除；
- 删除前二次确认，只删歌单，不删本地文件；
- 删除后立即从列表移除。

## 小组件
- **2×2 去掉播放进度条**（只保留封面/歌名/歌手/三键）。
- **4×1 歌词行刷新**：
  - 小组件同步间隔 5s → 2s；
  - `playerPlaying` 事件也启动同步定时器；
  - `syncWidget` 在播放中自愈启动定时器。

## 其他
- tracks.id 迁移真机已成功（3.10.16）。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功；
- 真机：2×2 无进度条、4×1 进度条推进；歌词行随 2s 刷新。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.10.17-arm64-v8a.apk | `9e36a3b13e52bbdb3706642ad470bdd5cf2de9d5c603f200f29d129e726c13de` |
| universal | em-music-v3.10.17-universal.apk | `dfedbf62248f076c80dba138b491feaf351784195f48edec21977f67ca2209cc` |
