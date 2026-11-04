# v3.6.5 发布说明

## 项目资料品牌统一

- 项目资料、README、FAQ、CHANGELOG、应用内关于页/许可协议统一使用 **EmoMusic** 品牌，不再使用 lxmusic 品牌；
- 仅保留对 lxmusic 开源项目的致谢，以及「基于 lxmusic 开源项目二次开发」的来源说明；
- 新增 [doc/attribution.md](attribution.md)，明确：
  - 直接使用的 lxmusic 项目：`lx-music-mobile`（上游基线 v1.9.2）；
  - 未直接使用：`lx-music-desktop`、`lx-music-sync-server`、`lx-music-doc`；
  - 沿用/改造自上游的部分，以及完全由 EmoMusic 开发/重做的部分（UI、播放器、本地音乐、下载中心、通知/锁屏媒体能力、品牌与签名隔离等）。

## 其它

- 应用内「关于」致谢文案更新；许可协议中的项目名改为 EmoMusic；
- 更新检查不再请求上游 version-info / 更新接口，避免误提示或下载到其它项目安装包；
- 移除上游 version-info 发布 workflow，CI/Issue 模板中的仓库与产物名改为 EmoMusic；
- 上游 CHANGELOG、FAQ 存档到 `doc/upstream-changelog.md`、`doc/upstream-faq.md`。

版本 3.6.5 / versionCode 170。
