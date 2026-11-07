# EmoMusic v3.12.11 修复说明

> 版本 **3.12.11** / versionCode **274**

## 播放器歌名裁切
- `MarqueeText` 原来用固定高度 `size*1.45`，字体放大后歌词页/底部歌名被上下裁；
- 改为按实际渲染字号计算行高（`getTextSize(size)*fontScale*1.35`，取两者较大值）。

## 设置主页大字无法滚动
- 设置主页 ScrollView 被 `scrollEnabled={false}` 锁死，字体调大后只能看到“下载与存储”；
- 已恢复可滚动。

## 验证
- 真机 130% 字体下：播放器页头歌名/歌手完整、歌词完整、设置主页可滚动。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `034a5cc09380ac209f0b8892608ac140dcd6f1b88df7f643b465cd4ede5d434e` |
| armeabi-v7a | `07bc432910825e01db4eb4b3e9a0db284d864be805cc61124f69f4795b9e0869` |
| universal | `059d55a12fed628ad3aeca17a03d75c0184987fd38aebfa114eaa3a315cc3078` |
