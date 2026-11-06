# v3.9.6 发布说明

> 版本 **3.9.6** / versionCode **197**（arm64-v8a 包 197003、armeabi-v7a 包 197001）

## 首页搜索
- 搜索圆钮改为 Material You 主题风格：主色图标 + 主色 tint 的液态玻璃。

## 本地音乐
- 收藏键移到页头右侧动作组，与文件夹/搜索按钮同 38dp 圆钮规格；
- 点击收藏键进入「收藏」页面；
- 字母栏/封面/滚动条沿用 3.9.5 行为。

## 收藏页
- 页头新增「+」按钮，打开「新建列表」弹窗，可自建歌单；创建后可在我的列表访问。

## 切页性能
- 本地音乐「文件夹/专辑/艺人/最近添加」首屏渲染批量从全量降到 18，windowSize 9、maxToRenderPerBatch 8；
- 「全部歌曲」保持全量挂载（避免既有虚拟化空白问题）。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功；
- 真机：M3 搜索圆钮、新建列表弹窗、收藏页迷你播放器歌词显示；
- tab 切换主观变快，未做量化帧率测试（NOT RUN）。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.9.6-arm64-v8a.apk | `e3b01ec9838db15ace87512493382e3363642df6ed61cee792786843bc92e1dc` |
| universal | em-music-v3.9.6-universal.apk | `a5148d8d5a16a3a5ceb07ead43fe2033a07b8357b0f334c097e4a43f885658f8` |
