# EmoMusic v3.12.29 说明

> 版本 **3.12.29** / versionCode **292**

## 在线条目时长/歌词补全
- 新增 `normalizeMusicInfo`：
  - 扁平在线条目补 `meta.picUrl / meta.albumName / source`；
  - 无 `interval` 时从歌词最后一个时间轴推导时长；
- 加入歌单时归一化并存储；播放前再次归一化；
- 列表行显示同样归一化，已有歌单也能显示封面/专辑/时长。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `eed8f44b6d33a34db3e64781ebd81be586d781c39328e2805d52f84b9d3836a0` |
| armeabi-v7a | `f773550c62a368bbcd783a790c7b9111196688a6fc3e9822a6b383c71ec6c1eb` |
| universal | `b01860f4379145aedc30efd9bbaa40138d0f6871c076a8f0a667dd69451cccd6` |
