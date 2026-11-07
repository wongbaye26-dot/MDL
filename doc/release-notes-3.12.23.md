# EmoMusic v3.12.23 修复说明

> 版本 **3.12.23** / versionCode **286**

## 启动崩溃
- `setPlayMusicInfo` 恢复上次曲目时直接读 `musicInfo.meta.picUrl`，损坏条目 meta 为空导致启动崩溃；
- 已加可选链保护。

## 歌单长按
- 长按歌单封面弹出菜单：编辑歌单名 / 删除歌单；
- 编辑复用 ListNameEdit，删除保留确认。

## 歌单歌曲列表
- 进入歌单时再次按 id / local_ 文件路径修复损坏条目（封面/来源/时长依赖 meta/source）。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `e25ee628e6ff01fc6ee97ad078a79ef20799a24f6dc891951125e0239157f28c` |
| armeabi-v7a | `ded708a0951d9364c39b56af31d753f5e8621e0a997032e4c3ccabff9095b142` |
| universal | `56dc4c1490d14c1899f2e9abc1214eba5200ade5ef6dff02ed06f8c4edf7d5c7` |
