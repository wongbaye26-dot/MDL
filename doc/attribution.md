# EmoMusic 项目来源、致谢与自研说明

## 致谢

感谢 **lxmusic 开源项目**。EmoMusic 是基于 lxmusic 开源项目二次开发的独立项目，没有 lxmusic 的开源工作就没有本项目的起点。

## 使用的 lxmusic 项目

| lxmusic 项目 | 是否使用 | 说明 |
|---|---|---|
| **lx-music-mobile** | ✅ 直接使用 | EmoMusic 的直接上游基础，基线为上游 `v1.9.2`（commit `0669d1b6`）。本项目在其代码基础上做品牌、UI、播放器、本地音乐、下载与原生能力改造。 |
| **lx-music-desktop** | ❌ 未直接使用 | 本项目没有直接合并桌面端仓库的代码；`src/utils/musicSdk` 等与桌面端同源的音源适配层是通过 lx-music-mobile 继承下来的。 |
| **lx-music-sync-server** | ❌ 未直接使用 | 本项目不包含同步服务器代码；数据同步协议保持与 lx-music 生态兼容，属于协议兼容，不是代码复用。 |
| **lx-music-doc** | ❌ 未直接使用 | 仅作为上游协议/自定义音源格式的参考文档。 |

## 沿用 / 改造自 lx-music-mobile 的部分

以下能力来自上游基础，EmoMusic 在此基础上做了修补或重做：

- 在线音源 SDK 与各家音乐平台的搜索、榜单、歌单、歌曲 URL 解析接口（`src/utils/musicSdk`）；
- 播放内核接入与播放服务基础（`react-native-track-player` 接入、播放状态/队列骨架）；
- 用户自定义音源脚本（QuickJS）执行链路与音频源脚本格式兼容；
- 设置、存储、列表、收藏、同步等数据层骨架；
- Android 原生模块的基础骨架（`crypto`、`cache`、`utils`、`dirpicker` 等）；
- 下载任务模型与原生 HTTP 下载模块（EmoMusic 在其上重做调度、落盘策略和 UI）。

## 完全由 EmoMusic 开发 / 重做的部分

以下内容不是从 lxmusic 项目复制而来，是 EmoMusic 自己编写或大规模重做的：

- **品牌与视觉系统**：EmoMusic 名称、LOGO/启动图标、Material You 动态取色、玻璃拟态组件、主题包、图标体系；
- **全站 UI / 交互**：首页、搜索、排行榜、歌单广场、歌单详情、收藏、我的、设置、关于页，以及胶囊导航、转场、手势、横竖屏布局；
- **播放器**：竖屏/横屏播放器、封面圆盘与倒影、歌词页、逐字高亮、队列、播放进度/手势、迷你播放器；
- **本地音乐中心**：SAF 多目录导入、后台静默扫描、标签/封面/采样率/码率读取、分类与排序、批量修复工具、本地播放问题修复；
- **下载中心**：并发队列、断点重试、自动换源、边听边存、文件名模板、歌词/封面/标签写入、默认目录与 SAF、目录权限检测与旧文件迁移、下载页交互；
- **通知 / 锁屏媒体能力**：自定义收藏/循环/上一首通知动作、Material 图标、锁屏/通知栏样式适配补丁；
- **品牌与安装隔离**：包名 `cn.emomusic.mobile`、应用名 Emo音乐、独立签名与 key 隔离、深链/Provider/默认目录隔离；
- **工程化**：一键出包、版本管理、依赖补丁幂等、类型检查/冒烟检查、项目文档与发布说明。

> 说明：上表中的「完全自研」指代码由 EmoMusic 新写或彻底重做，不代表脱离上游接口独立实现；部分功能仍会调用 lx-music-mobile 继承下来的音源/播放接口。

## 第三方原生依赖

`react-native-track-player`、`react-native-file-system`、`react-native-local-media-metadata`、`react-native-background-timer` 使用的是第三方的 fork 版本，**不属于 lxmusic 应用项目源码**；它们的来源、固定 commit 和补丁见 [vendor.md](./vendor.md)。

## 许可证

EmoMusic 继承上游仓库的 **Apache License 2.0**；第三方依赖的许可证见各自仓库。上游 lx-music-mobile 的历史更新记录存档在 [upstream-changelog.md](./upstream-changelog.md)。
