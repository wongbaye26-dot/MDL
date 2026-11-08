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
| 12 | 横屏 ↔ 竖屏 | ✅ | 首页切 Horizontal 布局（左侧导航 + 横向卡片）；**横屏播放页**左侧封面 + 右侧信息/歌词/控制正常；转回竖屏无异常 |
| 13 | 主题模式 + 种子色切换 | ✅ | 跟随系统→暗黑、系统红→星紫，RNN `setDefaultOptions/mergeOptions` 即时生效，无白屏/闪帧/崩溃；测完已恢复 |
| 14 | 搜索 + 键盘 | ✅ | 联想/结果列表正常；键盘弹出不误判横屏、底部导航自动收起 |
| 15 | 在线下载（真实任务） | ✅ | 排行榜「下载全部」→ 29 首入队（30 首中 1 首已有）→ 5 并发、12–15 MB/s → 31 首完成；落盘 `歌名 - 歌手.flac` + `.lrc` 同名歌词，未完成写 `.flac.part`；「暂停全部」生效（toast + 下载中计数冻结） |
| 16 | SAF 目录授权 + content:// 下载 | ✅ | 见下方「SAF 完整链路」：树选择器 → 授权落库（`…（授权目录）`）→ 重启后仍保持 → 无「所有文件访问权限」时经 content:// 下载成功 → 「恢复默认」复原 |
| 17 | 崩溃 / ANR | ✅ | 全程 `logcat -b crash` 无记录，无 ANR |

## SAF 完整链路（补测）

为真正走到 `content://` 分支，临时把 `MANAGE_EXTERNAL_STORAGE` 置为 `deny`（`appops set ... deny`），
让 `selectPath` 的「直接路径可写」判断失败，从而保存 `treeUri`：

1. 下载设置 →「选择目录」→ DocumentsUI 树选择器（`使用此文件夹`）→ 内部存储 → `Music` → `EmoMusic` → 允许；
2. 设置页显示 `/storage/emulated/0/Music/EmoMusic（授权目录）`，出现「恢复默认」按钮；
3. **杀进程重启 App 后仍是「授权目录」**（persist 权限 + 设置落库均正常）；
4. 无「所有文件访问权限」状态下下载新榜单 30 首：任务正常进队列/并发下载，完成后文件出现在
   `Music/EmoMusic`（`.flac` + `.lrc`），下载中心「已完成」32 → 41；证明下载走了 SAF content:// 写路径；
5. 测试后：`appops set ... allow` 恢复权限 →「恢复默认」→ 保存目录回到默认路径。

> 副作用：本轮新增约 10 首下载（目录 4.17 GB，设备剩余空间充足），队列已暂停。

## 未覆盖（后续真机清单）

- 锁屏媒体卡本体、「通知展开区」本体（Samsung 媒体卡接管，见第 8 条）；
- 弱网 / 源失败重试 / 下载断点续传的真实中断恢复；
- 队列/收藏跨进程恢复（杀进程后）、M3U 往返、歌词偏移与同名 `.lrc`；
- 横屏播放大页、分屏/折叠屏。

## 副作用与恢复

- 下载测试累计新增 41 首约 1.2 GB（目录 `/storage/emulated/0/Music/EmoMusic` 现 4.17 GB / 124 个 flac，设备剩余空间充足），队列已暂停，可在下载中心继续/删除；
- 收藏、循环模式、主题均已在测试后恢复原状态；播放已暂停。
