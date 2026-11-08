# v3.41.0（RN 0.76.9）真机回归记录

- 日期：2026-11-08 23:00–23:55（Asia/Bangkok）
- 设备：三星 SM-S938B，Android 17（API 37），1080×2340
- 包：`EmoMusic-v3.41.0-arm64-v8a.apk`（release，`CN=Emo Music` 签名，已覆盖安装）
- 基线：`master` @ `bf313aa4` / tag `v3.41.0`（RN 0.76.9 + RNN 8.0.0 + SVG 15.12.1，旧架构 + Hermes）

> 截图证据：`EmoMusic/.tmp-verify/rn-upgrade/qa/`（`01`–`21`）。逐项结论如下。

## 结论

| # | 场景 | 结果 | 说明 |
|---|---|---|---|
| 1 | 冷启动 / 播放状态恢复 | ✅ | 冷启动进入首页，最近播放/本地索引/播放条正常恢复 |
| 2 | RNN 底部导航四页切换 | ✅ | 首页 / 下载 / 本地音乐 / 我的，无白屏 |
| 3 | RNN PageModal（排行榜、歌单广场） | ✅ | 打开/返回正常，列表与 SVG 音源图标正常 |
| 4 | RNN push（设置子页、曲库工具） | ✅ | 进入/返回正常 |
| 5 | SVG 矢量图标 | ✅ | 导航、来源 LOGO、Tab 图标、播放器按钮全部渲染 |
| 6 | 本地曲库全量体检 | ✅ | 251 首 / 7.08 GB / 0 缺封面 / 0 无效 / 0 重复；FLAC 标签、44.1kHz、码率读取正常 |
| 7 | 播放（本地 FLAC） | ✅ | 播放/暂停、进度、歌词滚动、通知前台服务、MediaSession `PLAYING` |
| 8 | 通知栏媒体卡 | ✅（系统限制） | `dumpsys notification`：`actions=5`、`FOREGROUND_SERVICE`、`category=transport`；Samsung One UI 用系统媒体卡接管，只展示 3 个标准键 |
| 9 | 通知自定义按钮「收藏」 | ✅ | 通过 `am startservice -a CN...NOTIFY_FAVORITE`（与 PendingIntent 同路径）触发：播放器红心 空心→实心；再次触发恢复空心（原生 MusicService → JS `remote-favorite` → 收藏状态） |
| 10 | 通知自定义按钮「循环」 | ✅ | 同上 `NOTIFY_LOOP`：播放器循环图标 随机→列表循环；再点 3 次恢复随机 |
| 11 | 后台播放 | ✅ | 退到桌面后 `media_session dispatch play` 起播，AudioTrack `event:started`，MediaSession `PLAYING` |
| 12 | 横屏 ↔ 竖屏 | ✅ | 横屏切 Horizontal 布局（左侧导航 + 横向卡片），转回竖屏正常 |
| 13 | 主题模式 + 种子色切换 | ✅ | 跟随系统→暗黑、系统红→星紫，RNN `setDefaultOptions/mergeOptions` 即时生效，无白屏/闪帧/崩溃；测完已恢复 |
| 14 | 搜索 + 键盘 | ✅ | 联想/结果列表正常；键盘弹出不误判横屏、底部导航自动收起 |
| 15 | 在线下载（真实任务） | ✅ | 排行榜「下载全部」→ 29 首入队（30 首中 1 首已有）→ 5 并发、12–15 MB/s → 31 首完成；落盘 `歌名 - 歌手.flac` + `.lrc` 同名歌词，未完成写 `.flac.part`；「暂停全部」生效（toast + 下载中计数冻结） |
| 16 | SAF 目录选择器 | ⚠️ 部分 | 下载设置 →「选择目录」拉起 `DocumentsUI PickActivity`（`使用此文件夹`，能看到已下载文件）；为避免改动保存路径，返回取消，**未执行授权落库与 content:// 下载** |
| 17 | 崩溃 / ANR | ✅ | 全程 `logcat -b crash` 无记录，无 ANR |

## 未覆盖（后续真机清单）

- 锁屏媒体卡 / 通知展开区本体（Samsung 系统媒体卡接管，自定义按钮不可见，只能按第 9/10 条同路径验证）；
- SAF 全量授权（选择「使用此文件夹」后的 content:// 下载、重启后 persist 权限恢复）；
- 弱网 / 源失败重试 / 下载断点续传的真实中断恢复；
- 队列/收藏跨进程恢复（杀进程后）、M3U 往返、歌词偏移与同名 `.lrc`；
- 横屏播放大页、分屏/折叠屏。

## 副作用与恢复

- 下载测试新增 31 首约 0.9 GB（目录 `/storage/emulated/0/Music/EmoMusic` 现 3.7 GB，设备剩余 331 GB），队列已暂停，可在下载中心继续/删除；
- 收藏、循环模式、主题均已在测试后恢复原状态；播放已暂停。
