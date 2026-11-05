# EmoMusic v3.7.0 真机验收报告（QA）

- 版本：**3.7.0**（arm64-v8a 包 versionCode=181003，覆盖安装，签名一致）
- 设备：**Samsung SM-S938B**，One UI / **Android 17 (API 37)**，arm64-v8a，1080x2340，density：物理 450 / override 420，PAGE_SIZE=4096
- 验收时间：2026-11-05 17:42 ~ 18:09（Asia/Bangkok）
- 执行人：qa-verify（Agent Team）
- 证据目录：`EmoMusic/.tmp-verify/qa-3.7.0/`（164 个文件：截图 / logcat / uiautomator dump）

## 结论总览

| 项 | 内容 | 结论 |
|---|---|---|
| A | targetSdk36 / ABI / 密度 / 签名 / manifest | **PASS**（universal 包 versionCode 低于 split 包，覆盖安装限制见 A-4） |
| B | 冷启动 / 播放 / 通知 / FGS / 返回键 | **PASS** |
| C | 下载 → 本地曲库 / 封面 / 重扫（用户 bug 1） | **PARTIAL**：落盘/入曲库/重扫不丢 PASS；**实际音频与扩展名不一致 + 元数据/封面写入失败（P1）** |
| D | 多音源自动换源（用户 bug 2） | **PARTIAL**：未观察到 UI 换源提示；仅日志/配置层面有证据，未能稳定构造 |
| E | 设置 8 卡 + 音源管理 | **PARTIAL**：8 卡、页面、删除弹窗、语言、实测检测 PASS；「检查更新」无可见状态反馈（P2/待确认） |
| F | 分屏 / 小窗 / 密度 / 品牌兼容 | **PASS（有 P2 布局瑕疵）**：按 800x1200+320dpi、120/320/640dpi 均不崩；窄窗播放器歌词与标题重叠 |
| G | 回归主要页面 | **PASS**（未覆盖「收藏/歌单」独立页，见 G-2） |
| — | 新发现缺陷 | P1×2（搜索输入框不可用、下载 Hi-Res 实为 MP3 命名 .flac），P2×2（窄窗歌词重叠、检查更新无反馈） |

**P0：无。**

---

## A. targetSdk36 / ABI / 密度 / 签名（静态 + 设备侧）

### A-1 `aapt dump badging`（build-tools 36.1.0）

三个包公共项：
```
package: name='cn.emomusic.mobile' versionName='3.7.0' platformBuildVersionCode='36' compileSdkVersion='36'
sdkVersion:'21'
targetSdkVersion:'36'
densities: '120' '160' '240' '320' '480' '640' '65534'
supports-screens: 'small' 'normal' 'large' 'xlarge'
launchable-activity: name='cn.emomusic.mobile.MainActivity'
```
| 包 | versionCode | native-code |
|---|---|---|
| EmoMusic-v3.7.0-arm64-v8a.apk | **181003** | 'arm64-v8a' |
| EmoMusic-v3.7.0-armeabi-v7a.apk | **181001** | 'armeabi-v7a' |
| EmoMusic-v3.7.0-universal.apk | **181** | 'arm64-v8a' 'armeabi-v7a' |

- targetSdk=36、compileSdk=36、minSdk(21)、densities 含 120/160/240/320/480/640 → **PASS**
- 权限：`POST_NOTIFICATIONS`、`FOREGROUND_SERVICE`、`FOREGROUND_SERVICE_MEDIA_PLAYBACK`、`MANAGE_EXTERNAL_STORAGE`、`READ_MEDIA_AUDIO`、`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` 均在 badging 中可见 → PASS

### A-2 `unzip -l` 检查 native libs

```
universal : lib/arm64-v8a + lib/armeabi-v7a            （仅两个 ABI）
arm64     : lib/arm64-v8a 仅
v7a       : lib/armeabi-v7a 仅
```
MD5：
```
d647ea4d5691b30cb9492cd149f5fadb  EmoMusic-v3.7.0-arm64-v8a.apk
8a3b4b1b675b690035a4216287106571  EmoMusic-v3.7.0-armeabi-v7a.apk
21035f889e08f9ce5cb9e69956c701bf  EmoMusic-v3.7.0-universal.apk
```
→ **PASS**

### A-3 合并后 manifest
`android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml`
```
android:targetSdkVersion="36"
android:enableOnBackInvokedCallback="false"（application + activity 各一处）
<service android:name="com.guichaguri.trackplayer.service.MusicService"
         android:foregroundServiceType="mediaPlayback">
uses-permission android:name="android.permission.POST_NOTIFICATIONS"
uses-permission android:name="android.permission.FOREGROUND_SERVICE"
uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"
```
→ **PASS**

### A-4 设备侧包信息（`adb shell dumpsys package cn.emomusic.mobile`）
```
primaryCpuAbi=arm64-v8a
versionCode=181003 minSdk=21 targetSdk=36
versionName=3.7.0
lastUpdateTime=2026-11-05 17:42:06
signatures=PackageSignatures{... signatures:[5371d7f8]}  （覆盖安装保留用户数据，firstInstallTime=2026-11-04）
```
→ PASS。**风险（非阻塞）**：universal 包 versionCode=181 < 已安装的 181003，若用 universal 覆盖安装会被系统判为降级（需 `-d`/先卸载）；三方包需按「同 ABI 包」发布说明。

---

## B. 启动 / 播放 / 通知 / FGS / 返回键（targetSdk36 重点）

### B-1 冷启动 ×3
```
force-stop → am start -W ×3：Status: ok / TotalTime: 99 / 87 / 84 ms
每次 pid 正常、uiautomator 可 dump、无崩溃；第 4 次启动 TotalTime 77ms
```
- 全程 `adb logcat | grep "FATAL EXCEPTION"` = **0**（会话多次清空后复测均为 0）
- 冷启动后 App 恢复上次页面（截图 01 本地音乐 → 后续页面），无白屏/黑屏

### B-2 在线播放 + 通知媒体卡 + FGS
点击首页「最近播放」在线歌曲（起风了·吴青峰）：
```
state=PlaybackState {state=PLAYING(3), ...}
metadata: description=起风了, 吴青峰, 加油，你是最棒的 电视原声带
```
通知 shade（截图 07-notification-shade.png）：媒体卡「起风了 · 吴青峰」00:01/05:13，上/暂停/下按钮 + 专辑封面
`dumpsys notification --noredact`：
```
NotificationRecord(pkg=cn.emomusic.mobile id=1 ... flags=NO_CLEAR|FOREGROUND_SERVICE category=transport)
android.template=String (android.app.Notification$MediaStyle)
actions: 上一首 / Play / Next / 收藏 / 播放模式（均 PendingIntent）
contentIntent=PendingIntent{... cn.emomusic.mobile startActivity}
```
`dumpsys activity services cn.emomusic.mobile`：
```
ServiceRecord ... com.guichaguri.trackplayer.service.MusicService
isForeground=true foregroundId=1 types=0x00000002（= FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK）
foregroundNoti=Notification(channel=com.gu... category=transport actions=5 vis=PUBLIC)
targetSdkVersion:36 callerTargetSdkVersion:36
```
MediaSession：`Media button session is cn.emomusic.mobile/TrackPlayer/116`，`active=true`
锁屏（`isKeyguardShowing=true` 时截图 11-lockscreen.png）：底部媒体条「辞九门回忆 · 邓寓君」+ 上/暂停/下 → **PASS**

### B-3 通知/媒体键交互
```
keyevent 85（播放/暂停）: PLAYING(3) → PAUSED(2) → PLAYING(3)
keyevent 87（下一首）: 切歌成功（辞九门回忆，本地 FLAC，00:05/04:00）
```
截图：08-notif-paused.png、09-notif-next.png

### B-4 返回键逐层返回
| 路径 | 操作 | 结果 |
|---|---|---|
| 我的 → 音源管理 | `input keyevent 4` | 回到「我的」设置首页（截图 04），8 卡完整 |
| 播放器页（mini player 进入） | keyevent 4 | 回到上一层（MainActivity 仍 resumed，pid 不变） |
| 搜索页 | keyevent 4 | 回到首页（未退出 App） |
| 个人页连续返回 | keyevent 4 ×N | 正常回到 Launcher，无黑屏/双 Activity；无崩溃 |

无 `AndroidRuntime FATAL`；无 `MissingForegroundServiceType` / `ForegroundServiceStartNotAllowed` / `SecurityException` / `IllegalArgumentException`（grep 结果为空）。

---

## C. 下载 → 本地曲库 / 封面 / 重扫（用户 bug 1）——PARTIAL

### C-1 前置状态
下载设置（截图 34-download-settings.png）：
- 保存目录：`/storage/emulated/0/Music/EmoMusic`
- 下载音质：Hi-Res；同时下载数 5
- **「下载失败时自动切换其他音源」= 开**（即「使用其他音源」）
- 所有文件访问权限：已授权

### C-2 下载流程
搜索（首页放大镜 → 历史词「爱情公寓」→ 歌曲 tab）→ 歌曲行 ⋮ →「下载」→ 音质选择弹层（Hi-Res 默认）→「开始下载」：
- 下载中心（截图 40）：共 1 首 / 已完成 1 / 下载中 0；「爱的回归线」标签 **FLAC 无损**，进度条满，**已完成 · 9.8 MB**
- 状态流转 等待→下载中→已完成 正常，进度/大小有显示

### C-3 落盘与 MediaStore（PASS 部分）
```
/sdcard/Music/EmoMusic/爱的回归线 - 陈韵若、陈每文.flac   10,287,236 B  17:55
/sdcard/Music/EmoMusic/爱的回归线 - 陈韵若、陈每文.lrc        1,844 B  17:55
```
- `adb logcat -s LxDownload`：`request media scan: /storage/emulated/0/Music/EmoMusic/爱的回归线 - 陈韵若、陈每文.flac`
- `MediaScannerConnection: Scanned ... to content://media/external_primary/audio/media/6553`
- `content query --uri content://media/external/audio/media`：`Row: 254 _display_name=...flac, mime_type=audio/mpeg, relative_path=Music/EmoMusic/` → 原生扫描生效、MediaStore 有新记录

### C-4 本地曲库 / 封面 / 重启 / 重扫
- 本地音乐：224 → **225 首**，`最近添加` 首位出现「爱的回归线 - 陈韵若、陈每文」，**有专辑封面**（爱情公寓3）
- force-stop → 冷启动后：仍在（225 首，截图 43/44）
- 本地音乐页点「扫描」（重扫）：完成后仍在，**未被覆盖/丢失**（截图 45/46）；但总曲数回落为 **224 首**（文件夹统计：Download 113 + EmoMusic 69 + MusicDownloads 42 = 224），EmoMusic 目录 69 首 → 「重扫后总数 -1」现象，需产品确认是否为去重导致（低风险）
- 曲库体检（音乐工具，截图 48）：总歌曲 224 / 总大小 6.24GB / **缺封面 1（即该曲）** / 标签待补 0 / 无效条目 0

### C-5 【P1】实际音频内容与扩展名/标签不一致
```
head -c 16 "爱的回归线 - 陈韵若、陈每文.flac" | od -An -tx1
49 44 33 03 00 00 00 00 00 4f 54 49 54 32 00 00      → "ID3"（MP3），不是 "fLaC"
MediaStore mime_type = audio/mpeg（与 .flac 扩展名不一致）
4:17 时长 / 10,287,236 B ≈ 320kbps
```
App 错误日志（设置→其他→日志，截图 57-error-log.png）：
```
2026/11/5 17:55:26 WARN write download metadata failed: .../爱的回归线 - 陈韵若、陈每文.flac
Error: .../local-media-metadata-temp-file/xxx.flac Flac Header not found, not a flac file
2026/11/5 17:55:26 WARN write download metadata failed for all targets
```
UI 矛盾：下载中心「FLAC 无损」；本地音乐该曲「FLAC + 320kbps」；播放页「本地 · FLAC · 44.1kHz · 320kbps · 9.8MB」。
播放验证：该曲仍可播放（ExoPlayer 按内容嗅探，`onMetadataReceived: id3`），但元数据/封面写回失败。
→ **P1（对应用户 bug 1 的根因方向）**：请求 Hi-Res 时音源返回 MP3 流，下载器未校验实际编码即按请求音质命名扩展名，导致扩展名/标签/封面不一致。

### C-6 下载中心 / 重复下载
下载完成后再进入下载中心未见重复任务；文件未重复生成（目录内仅 1 份）。

---

## D. 多音源自动换源（用户 bug 2）——PARTIAL

### D-1 已获得的证据
1. **播放失败日志**（logcat，17:46:00，在线歌曲播放时）：
   `ReactNativeJS: 2026/11/5 17:46:00 ERROR PlaybackError {"message":"Response code: 404","code":"playback-source"}`
   → 取播放地址 404（典型触发换源的场景），但采样时序内未截到「尝试切换到其他来源...」状态文案/「歌曲换源: xxx」Toast。
2. 设置→其他（截图 56）：`换源歌曲信息数量: 0`（无已缓存换源信息，本次验收期间未成功换源落库）。
3. 下载设置：「下载失败时自动切换其他音源」= 开（截图 34）。
4. 音源管理「实测检测」（E-4）显示网易/咪咕取地址失败 → 多音源能力存在数据面异常（见 E-4）。
5. 一次在线歌曲播放进入 `CONNECTING` 后长时间未恢复（截图/时间戳），未观察到自动切换的 UI 反馈。

### D-2 未验证原因
- 当前仅启用 1 个音源脚本（独家音源 v7），未构造「第二音源可用」的稳定换源场景；「停用当前音源→播放」的破坏性操作未执行（避免影响用户已配置脚本状态）。
- 结论：**逻辑触发点存在（404 playback-source / 自动换源开关），但本次未取得「自动切源成功」的 UI 级证据 → PARTIAL**。建议后续用「两脚本同时启用 + 播放取不到地址的歌」专项复测。

---

## E. 设置 8 卡 + 音源管理页

### E-1 设置首页 8 卡（PASS）
截图 04：**正好 8 张卡**（2 列 × 4 行）：音源管理 / 基本设置 / 播放设置 / 下载设置 / 搜索与列表 / 音乐工具 / 其他 / 关于 Emo音乐（v3.7.0），无溢出，「搜索与列表」副标题两行但布局正常。
逐个点开 + 返回（截图 E-card-*.png，脚本循环 8 次）：
| 卡 | 进入页面 | 返回 |
|---|---|---|
| 音源管理 | 音源管理 | ✅ 回设置首页 |
| 基本设置 | 基本设置（外观/主题色/启动/界面/语言） | ✅ |
| 播放设置 | 播放设置 | ✅ |
| 下载设置 | 下载设置（保存位置/音质/并发/自动换源/权限） | ✅ |
| 搜索与列表 | 搜索与列表 | ✅ |
| 音乐工具 | 音乐工具（曲库体检/封面修复/标签刮削/歌词） | ✅ |
| 其他 | 其他（缓存/错误日志/权限管理/设备兼容） | ✅ |
| 关于 Emo音乐 | 关于页（v3.7.0 / React Native / Material You / 致谢 / 声明） | ✅ |

### E-2 音源管理页（PASS 部分）
- 摘要卡：可用音源 **6**、最高音质 Hi-Res、上次检测（初始「未检测」→ 检测后 `2026-11-05 18:04`）、当前状态 **初始化成功**
- 当前音源卡：独家音源 v7、初始化成功、版本 v7 / 作者 w / 主页「未提供主页」、重新初始化按钮
- 自定义源：导入入口（支持在线链接/.js）、源列表（独家音源当前启用、全豆要 v4、长青SVIP v1.3、六音音源 v1.2、fish_music v1.9）、每源启用/停用/检查更新/允许显示更新弹窗/删除
- **删除弹窗**：点 trash 弹出「你真的要移除「fish_music」吗？」+「不不不，点错了 / 是的」→ 取消后源保留（截图 66a/67）→ 二次确认 PASS（本次未确认删除，保护用户数据）
- 音质矩阵 chips：酷狗/酷我/咪咕/QQ/网易 × Hi-Res/FLAC 无损/320k/128k（截图 68）

### E-3 检查更新（PARTIAL）
- 点击当前源/其它源的「检查更新」：**未观察到任何可见状态反馈**（无 Toast、无「已最新/有新版本/无法检查/失败」文案、列表不变）；截图 65/66a。可能是 Toast 过短或状态未落 UI。
- 需产品确认预期交互。**P2（待确认）**。

### E-4 实测检测（PASS，含优雅失败）
探测歌曲默认「晴天 周杰伦」→「开始检测」跑完（截图 80/82c）：
```
检测中 0/5 · 获取播放地址 → 完成（上次检测 2026-11-05 18:04）
酷我音乐  可用  最高实测 FLAC 无损  2878ms
          FLAC 无损 可播放 约52.83M 2878ms / 320k 可播放 约10.29M 931ms / 128k 可播放 约4.12M 720ms
酷狗音乐  可用  最高实测（无标签）   4373ms
          Hi-Res 52.83M 4373ms / FLAC 30.17M 858ms / 320k 10.29M 2505ms / 128k 4.12M 1311ms
QQ音乐    可用  最高实测 FLAC 无损  2512ms
          FLAC 52.83M 2512ms / 320k 10.29M 1431ms / 128k 4.12M 1043ms
网易音乐  失败  （各音质「不可用 / unknown error」）
咪咕音乐  失败  （各音质「不可用 / get music url failed」）
```
→ 结果分源展示可用/失败/延迟/体积，失败优雅不崩；复制结果/写入日志按钮出现 → **PASS**（顺带发现：酷狗「最高实测」标签缺音质值，P3 展示问题）

### E-5 语言切换（PASS）
基本设置 → 语言：简体中文 / 繁體中文 / English
- 切 English：设置 8 卡标题变 Sources / General / Playback / Download / Search & Lists / Music Tools / Extras / About Emo Music，不崩（截图 G3）
- 切回简体中文：恢复中文，不崩（截图 G4b）
- 备注：页面标题「我的」与卡片副标题为硬编码中文（中英混排），非阻塞

---

## F. 分屏 / 小窗 / 密度 / 品牌兼容

### F-1 窄窗模拟（wm size 800x1200 + wm density 320）
```
adb shell wm size 800x1200; adb shell wm density 320
dumpsys window displays: base=800x1200 320dpi cur=800x1200 app=800x1200
```
- 设置首页（F1）：2 列卡片、文字缩放正常、底部胶囊导航完整可见、无溢出/无崩溃
- 首页（F2）：内容跟随宽度重排、底部胶囊导航未被系统导航栏遮挡
- 播放器（F3）：布局跟随（封面/信息/控件/进度条均可见），**缺陷：歌词行与歌曲标题重叠**（「有朝一日终止会又相见」压在「爱的回归线」上方）→ **P2 布局瑕疵**
- 结束后：`wm size reset` → 1080x2340（已确认）

### F-2 密度 120 / 320 / 640
| density | 操作 | 结果 |
|---|---|---|
| 120 | 重启 App（force-stop + start，TotalTime 96ms） | 启动正常，首页/列表/底部胶囊渲染正常，无崩溃（F4） |
| 320 | 直接切换（3s 后截图） | 布局跟随，无崩溃（F5） |
| 640 | 直接切换 | 内容严重放大（270dp 宽），不崩溃但不可用（超手机合理密度范围，仅压力测试）（F6） |
- 恢复：`wm density 420` + `wm size reset` → `Physical size: 1080x2340 / Physical density: 450 / Override density: 420`，**与验收前状态一致**；重启 App 后 UI 恢复正常（F7/F8）
- 注意：切换 density 后需重启 App 才能正确重排（RN 运行时不响应 density 变化），验收已按要求重启验证

### F-3 设备兼容区块（PASS）
其他页底部（截图 59b）：
- 设备信息：SM-S938B · 三星 · samsung · Android 17 (API 37)
- 通知权限 已开启 / 所有文件访问权限 已允许 / 电池优化 已允许
- 自启动/后台运行「去设置」→ 打开系统 `com.android.settings/.applications.InstalledAppDetails`（回落到应用详情页，不崩）
- 系统应用设置 → 同样打开系统应用详情页，不崩（截图 60/61）
- 品牌保活提示：当前识别「三星」，给出电池/通知/后台限制操作指引

---

## G. 回归

### G-1 已回归页面（均可打开、不崩、可返回）
| 页面 | 证据 |
|---|---|
| 首页（卡片/最近播放/最近添加/最近下载） | 05/06/17b/29 等 |
| 本地音乐（全部歌曲/文件夹/专辑/艺人/最近添加 + 扫描 + 曲库体检） | 01/42/45/46/47/52/53 |
| 搜索页（历史/热门/结果列表/歌曲-歌单切换） | 15c/18a/23/31/32/36 |
| 播放器页（播放/暂停/上一首/下一首/进度/收藏/信息） | 13/50/54/G5 |
| 歌词页（歌词滚动/词曲信息/字号/翻译入口） | G6/G8 |
| 下载中心（任务列表/已完成/进度） | 40 |
| 设置 8 个页面 | E-card-*、34/56/57/59b/G1/G2 |
| 关于页 | 05 中的关于页内容 |
| 权限管理/日志/清缓存入口 | 56/57 |

### G-2 未独立覆盖
- 「收藏」独立列表页、「歌单」详情页未单独打开（本次从入口层级未稳定抵达，且时间预算用于 C/D/F）；回归不完整项，建议后续补测。**（不影响本轮主要结论）**

### G-3 日志
- `adb logcat | grep -c "FATAL EXCEPTION"` = **0**
- 无 New Architecture/JS 崩溃；仅少量系统 warning（InteractionJankMonitor / 图片圆角 WrappingUtils，非阻塞）

---

## H. 新发现缺陷清单（按优先级）

| 级别 | 缺陷 | 复现步骤 | 证据 |
|---|---|---|---|
| **P1** | 搜索输入框不可用：点输入框后搜索页 ~0.6s 自动关闭、键盘隐藏，无法手输关键词 | 首页→放大镜→点搜索输入框 → 搜索页退回首页 | 28a/28b/28c 截图 + logcat（showSoftInput→hideSoftInput→ScrollView initGoToTop） |
| **P1** | 下载 Hi-Res 实为 MP3(ID3) 流却命名 `.flac`；元数据/封面写入失败；下载中心/曲库标签显示 FLAC 与实际 320kbps 矛盾 | 搜索→⋮→下载→Hi-Res→开始下载 | 文件头 od=ID3、MediaStore mime=audio/mpeg、应用错误日志截图 57、40/42/50 |
| **P2** | 窄窗（800x1200@320dpi）播放器页歌词与标题重叠 | wm size 800x1200 + density 320 → 播放器页 | F3-narrow-player.png |
| **P2** | 「检查更新」无任何可见状态反馈（已最新/有新版本/无法检查/失败均未展示） | 音源管理→任一源「检查更新」 | 65/66a |
| **P3** | 实测检测「最高实测」标签在酷狗音乐缺音质值；「上次检测」时间格式可读性一般 | 音源管理→开始检测 | 82c |
| 风险 | universal 包 versionCode(181) < 已装 arm64 包(181003)，覆盖安装会被判降级 | aapt badging | A-1 |

## 环境复原确认
```
adb devices            → R5CY10H9VFW device
wm size                → Physical size: 1080x2340（无 override）
wm density             → Physical density: 450 / Override density: 420（验收前状态）
App                    → 运行中（pid 30306），未卸载、未清数据、未删除用户音乐文件
源码                    → 本 QA 未修改任何业务代码/配置（git 中的改动均为 Lead v3.7.0 交付内容）
```

---

## I. Lead 修复后复测（v3.7.0 最终包，2026-11-05 18:20~18:30）

针对 H 章的 2 个 P1 与 P2 做了修复并重新构建安装（同版本 3.7.0 / versionCode 181003，签名一致覆盖安装）。

### I-1 P1「搜索输入框不可用」——**已修复（PASS）**

根因（比 QA 初判更具体）：键盘弹起时窗口/布局高度被临时压小（实测 `windowSizeTools` 收到 `411x205` / `411x548`dp），
`isHorizontalMode(411, 205)` 判定为横屏 → `Home` 卸载竖屏树切到横屏布局 → SearchModal 被卸载 → 键盘 clearFocus。
logcat 里 `ScrollView initGoToTop ×2`（Home 的两个 ScrollView 重建）就是重建证据。

修复：
- `windowSizeTools.setWindowSize` 识别「输入法临时压缩」并忽略（IME inset > 0；或全屏下宽度不变、高度骤减 <70% 且 <500dp），分屏/小窗（`isInMultiWindowMode`）与旋转照常更新；
- `SizeView` 键盘期间不重算 `statusbarHeight`；
- 键盘弹出时收起底部胶囊导航（否则会浮在键盘上方挡住内容）。

复测证据：
- 点搜索框后键盘正常弹出、搜索页保持打开（`/tmp` 本地截图，QA 目录可对照 18b/28b 的旧行为）；
- 输入 `love` 回车后出现搜索结果列表；清除输入后历史/热词正常；
- logcat 可见 `[windowSizeTools] ignore keyboard transient size 411x548 (keep 411x891)`，无 SearchModal unmount。

### I-2 P1「下载 Hi-Res 实为 MP3 却命名 .flac」——**已实现修复，真机场景待复验**

- 新增文件头嗅探（`fLaC/ID3/0xFFEx/ftyp/OggS/RIFF/MAC /ADTS/<html`）与 `reconcileDownloadedFormat`：
  真实格式与计划不符 → 先刷新地址/强制换源重试（≤2 次）；仍不符则按真实格式改名并同步 `quality/ext/fileName/filePath`，
  清旧 MediaStore 记录、扫新路径，再写标签/封面/入库；HTML/错误页直接失败不入库。
- 单测：`detectAudioContainer` 对 10+ 组文件头按预期识别（fLaC→flac、ID3/0xFFFB→mp3、ADTS→aac、ftyp→m4a、OggS、RIFF、MAC、`<!DOCTYPE`→invalid、随机→null）。
- 真机：本轮重新下载验证受「种子/音源返回内容随机」与 adb 点击坐标漂移影响，未稳定复现「Hi-Res 实际返回 mp3」的原场景；
  旧的那首坏文件（`爱的回归线 ….flac`，内容 ID3）在复测中已删除任务与文件，重新下载后未再产生 `.flac` 后缀的 mp3。
  建议下个版本用固定测试源再跑一次该场景。

### I-3 P2「检查更新无可见状态」——**实测正常（QA 误判为点击未命中）**

在音源管理页点「检查更新」后，卡片下方出现「本地导入，无法检查更新 / 上次检查：2026-11-05 18:28」；
在线导入的脚本会显示「有新版本 vX」或「已是最新」。QA 当时的 65/66a 截图应为点击坐标未命中按钮。

### I-4 其他修复验证

- 音源列表音质 chips 去重：修复前 5 个相同「Hi-Res」chips；修复后显示 `Hi-Res / FLAC 无损 / 320k / 128k`（截图对比 77-source-top2 vs 最终版）。
- 播放失败自动换源：新增 `PlaybackError` → 刷新地址 → 强制换源重试 2 次的逻辑（代码 + tsc/eslint 通过），真机 404 场景未再稳定构造，保留为待复验项。
- 最终构建静态校验：tsc 0 错误、eslint 0 error；`node dependencies-patch.js --strict` 全通过。

### I-5 最终交付包（`/Users/wangbaye/Projects/MDL/dist/`）

| 文件 | 大小 | MD5 |
|---|---|---|
| EmoMusic-v3.7.0-arm64-v8a.apk | 16.8 MB | `449c9214169d0e0431a190c491e1ec4a` |
| EmoMusic-v3.7.0-armeabi-v7a.apk | 15.9 MB | `e9b41c17724b6d2ef686395c3b8e98f7` |
| EmoMusic-v3.7.0-universal.apk | 20.7 MB | `98227f8cc675e2637a9c8c259c5dea64` |

### I-6 仍然遗留

- 窄窗（800×1200@320dpi）播放器页歌词/标题重叠（P2，未在本次修复范围）；
- 播放失败自动换源、下载格式纠正的真机端到端场景（依赖源站行为）未稳定复验；
- 升级前已下坏的旧文件不会自动修复，需要重新下载；
- 16KB page size 设备限制（见 `doc/android-16-compat.md`）。

