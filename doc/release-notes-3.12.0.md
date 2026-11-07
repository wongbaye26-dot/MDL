# EmoMusic v3.12.0 正式发行版

> 版本 **3.12.0** / versionCode **263**
> 签名：V2，CN=Emo Music，SHA-256 `020c0c4b7707662dcde286a173abc51a82d7576825eecf8fc61806937b09890a`

## 本版重点

### 本地搜索
- 搜索改为页内悬浮栏，不再用全屏 Modal 遮罩；
- 搜索出歌曲/歌手/专辑候选：歌曲点击播放，歌手/专辑点击进入对应页面；
- 候选胶囊完整显示，不再截断；
- 提交、点结果、滑动时自动收键盘；
- 搜索无内容失焦自动收起；有结果按返回收起搜索并清空。

### 性能 / 冷启动
- 移除 Hermes 极慢的 `localeCompare`，本地排序 buildRows 1147ms → 6ms；
- 本地 tab 只构建当前 tab + 空闲分片缓存，切换接近即时；
- 首页启动期间后台预加载曲库，本地页直接命中内存；
- 首次切页不再叠加“挂载 + 淡入”动画，减少闪烁；
- 页面壳使用 `c-main-background`，暗色主题保持纯黑。

### 稳定性
- 回滚 3.11.5 的 PagerView 预挂载卡死方案；
- 修复 3.11.7 暗色背景变 M3 紫底；
- 修复搜索命中旧 rows 缓存导致结果不生成。

## 验证
- typecheck 0 / lint 0 / unit test 19/19 / assembleRelease 成功；
- V2 签名校验通过；arm64 安装启动成功，versionName=3.12.0。

## 安装包
- arm64-v8a（推荐）
- armeabi-v7a（旧设备）
- universal（通用）

## SHA256

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.12.0-arm64-v8a.apk | `e0d05f7f86ec160eb61bb2efa9a444f15e911deb9d4e404b782f81744bb462dc` |
| armeabi-v7a | em-music-v3.12.0-armeabi-v7a.apk | `39e302463b03478b1d8391284c32c8db0382bae6da15d9c6bd2b4d1118454105` |
| universal | em-music-v3.12.0-universal.apk | `0586435e13a61b0504c50a6dfcf7f60443c60efe8757c27d46bb10ccf0e81a8a` |
