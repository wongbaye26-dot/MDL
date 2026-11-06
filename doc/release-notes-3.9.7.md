# v3.9.7 发布说明

> 版本 **3.9.7** / versionCode **198**（arm64-v8a 包 198003、armeabi-v7a 包 198001）

## 本地音乐 tab 切换卡顿
根因：切页时 FlatList 要同步卸载当前窗口内上百行；`useDeferredValue(tab)` 还会先渲染一次“旧数据 + 新布局”的中间态。
修复：
- 去掉 `useDeferredValue(tab)`，页签与 rows 同帧更新；
- 常驻渲染窗口 `windowSize` 从 11/9 降到 **4**；
- 歌曲首屏 24 行、分组 15 行，`maxToRenderPerBatch=8`。

真机快速滑到 180+ 行无空白；切页卸载量显著降低。

## 表头液态玻璃
以下表头统一改为胶囊任务栏/迷你播放器同款 `LiquidGlass`（底部圆角 24、静态高光/内阴影，无扫光）：
- 下载中心
- 本地音乐
- 收藏（PageModal）
- 排行榜（PageModal）
- 歌单广场
- 歌单详情
- 搜索（HeaderBar）

## 本地收藏键
- 与文件夹/搜索按钮同为 38dp tonal 圆钮，图标色统一 `c-font`；点击进入收藏页。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功；
- 真机：本地/歌单广场玻璃表头、收藏键样式；快速滚动无空白。
- 切页“主观是否完全不卡”需用户再确认；若仍卡，下一步把 5 个 tab 列表常驻挂载（内存换切换零卸载）。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.9.7-arm64-v8a.apk | `f56a69278a4495d1c88b8cb9a613fa3c405b4022065dbefa3c70afcda98de83a` |
| universal | em-music-v3.9.7-universal.apk | `fb81d553514165a78bfe9366567ce30a4815f9ed9795a12984d4f7190669fe53` |
