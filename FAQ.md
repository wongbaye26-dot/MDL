# EmoMusic 常见问题

## 安装与更新

### 为什么提示签名不一致 / 不能覆盖安装？
EmoMusic 使用独立包名 `cn.emomusic.mobile` 和独立 release 签名，与旧版 EMO 包、lxmusic 官方包都不是同一个应用。旧包不能直接覆盖成 EmoMusic，请保留旧包或先备份数据，再安装 EmoMusic；新包是全新应用，数据不共享。

### 桌面名称、包名是什么？
- 应用名：Emo音乐
- 包名：`cn.emomusic.mobile`
- 签名：项目自己的 `emomusic-release.keystore`（不要使用其它项目的签名）

## 本地音乐

### 下载的歌在文件管理器里找不到？
Android 11+ 写公共 `Music` 目录需要「所有文件访问权限」。到 **设置 → 下载设置 → 存储权限 → 所有文件访问权限** 授权；未授权时下载会落到 `Android/data/cn.emomusic.mobile/files/Music`，文件管理器通常看不到。
授权后，早期落在私有目录的下载会在应用启动/回到下载设置时自动迁回默认目录。

### 本地音乐默认扫描哪个目录？
默认扫描目录跟随**当前下载目录**（默认 `Music/EmoMusic`），你额外添加的目录会一起扫描。下载目录改了之后，本地音乐会跟着走。

### 本地音乐扫描不到某首歌？
1. 确认下载目录/文件所在目录已添加为扫描目录；
2. 部分 Android 版本需要授予「音乐和音频」权限；
3. 在本地音乐页下拉或点扫描重新扫描。

## 在线音源

### 为什么搜索/播放没结果？
EmoMusic 不内置音源服务，需要你在 **设置 → 自定义音源** 导入可用的音源脚本；音源失效属于第三方接口问题。

### 自定义源脚本格式？
兼容 lxmusic 的自定义源脚本格式（这是格式兼容，不代表本项目是 lxmusic 官方客户端）。项目来源与致谢见 [doc/attribution.md](doc/attribution.md)。

## 同步

同步协议保持与 lx-music 生态兼容，可连接兼容的同步服务；本项目不包含同步服务器代码。

## 其它

- 本项目基于 lxmusic 开源项目二次开发，感谢 lxmusic 开源项目；来源与自研范围见 [doc/attribution.md](doc/attribution.md)。
- 更多构建/发版说明见 [doc/release.md](doc/release.md)。
