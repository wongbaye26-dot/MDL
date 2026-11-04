# v3.6.3 发布说明（2026-11-04）

## 品牌与安装包隔离（重要）

- **包名**：`cn.toside.music.mobile` → **`cn.emomusic.mobile`**（新包是独立应用，可与旧 EMO/lxmusic 包共存）
- **应用名**：**Emo音乐**（桌面图标名、通知/权限文案、关于页、界面标题同步更新）
- **签名**：换用全新的独立 release 密钥 `android/app/emomusic-release.keystore`（别名 `emomusic`，SHA-256 `02:0C:0C:4B:…:89:0A`），与 lxmusic 官方包/旧 EMO 包签名不同：
  - 两者无法互相覆盖安装；
  - 应用数据完全隔离（新包首次安装后为空，需要重新导入本地音乐/配置音源）。
  - 旧密钥已归档到 `android/legacy-signing/`（旧包如需继续更新仍可用）。
- **其它隔离项**：FileProvider authority、通知媒体按钮 action、深链 scheme（`emomusic://`）、默认下载目录（`Music/EmoMusic`）全部随包名/品牌更新。

## 迁移说明

新包是**全新应用**，不会读取旧 EMO 包的数据；本地音频文件仍在手机存储里，重新扫描即可。旧 EMO 包可保留共存，确认迁移完成后自行卸载。

## v3.6.3 锁屏上一首样式修复

One UI 9 的锁屏大播放器由 SystemUI 绘制。之前把「上一首」作为通知自定义 action，会被系统画成没有圆形外框的方块；v3.6.3 改为不再把它加进通知动作列表，交给 MediaSession 原生 transport 渲染，让它与播放/下一首使用同一种圆形按钮样式。耳机/媒体会话的上一曲能力仍保留；通知栏 compact 视图剩播放/暂停/下一首。

## v3.6.3 修复

- **恢复上一首按钮**：v3.6.1 把上一首从通知动作移除后，One UI 9 的锁屏大/小播放器与通知栏 compact 都不再显示上一首；v3.6.3 恢复自定义「上一首」通知 action（三个位置均恢复显示）。One UI 9 锁屏媒体面板由 SystemUI 绘制，按钮外框/文字叠加在封面上属于系统样式，App 侧无法改容器形状。
- **歌曲列表专辑名**：开启「显示专辑名」时，列表模式第二行允许 2 行并增加行高，歌单详情/搜索结果不再因为宽度不足被歌手名挤掉专辑名；排行榜卡片模式保持原样。


同时包含 v3.5.18 的启动图标渐变边修复、锁屏/通知媒体按钮统一 Material 图标，以及此前所有 UI/功能改动。

## 产物

- `dist/EmoMusic-v3.6.3-arm64-v8a.apk`（覆盖安装新包用，versionCode 168003）
- `dist/EmoMusic-v3.6.3-universal.apk`（全新安装，versionCode 168）

## 签名备份（务必）

`android/app/emomusic-release.keystore` + `android/keystore.properties`（含密码）必须备份到密码管理器/加密云盘；丢失后无法再发布可覆盖安装的更新。
