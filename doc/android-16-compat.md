# Android 16（targetSdk 36）兼容改造说明

> 版本基线：EmoMusic v3.6.15（React Native 0.73.11 + react-native-navigation 7.39.2）
> 改造目标：`targetSdk` 升到 Android 16（API 36）、ABI 只保留 `arm64-v8a` + `armeabi-v7a`、
> 屏幕密度覆盖 120/160/240/320/480/640、适配分屏/小窗动态尺寸、增强国产 ROM 品牌兼容。

---

## 1. 本次改动一览

| 类别 | 文件 | 说明 |
| --- | --- | --- |
| 构建配置 | `android/build.gradle` | `targetSdkVersion 29 → 36`；`buildTools` 保持已验证的 `35.0.0` |
| 构建配置 | `android/gradle.properties` | `reactNativeArchitectures=arm64-v8a,armeabi-v7a` |
| 构建配置 | `android/app/build.gradle` | `reactNativeArchitectures()` 缺省值只保留两个 ABI；splits 注释 |
| Manifest | `android/app/src/main/AndroidManifest.xml` | `enableOnBackInvokedCallback=false`、`resizeableActivity=true`、FGS/通知权限、合并 `MusicService` 的 `foregroundServiceType` |
| 依赖补丁 | `dependencies-patch.js` | track-player 2.1.2：PendingIntent `FLAG_IMMUTABLE`、`startForeground` 类型 + 异常兜底 |
| 原生 | `MainActivity.java` | 底部导航栏 inset → 根内容 padding（分屏/小窗/导航模式动态更新） |
| 原生 | `utils/UtilsModule.java` | `getWindowInsets()`、`listenWindowSizeChanged()`、品牌信息/自启动/应用详情页方法；动态广播显式 `RECEIVER_NOT_EXPORTED` |
| 原生 | `lyric/Lyric.java` | 同上，动态广播显式 `RECEIVER_NOT_EXPORTED` |
| 资源 | `res/drawable-ldpi`、`drawable-land-ldpi`、`mipmap-ldpi` | 补齐 120dpi 资源 |
| JS | `src/utils/nativeModules/utils.ts` | 新原生方法封装；`onWindowSizeChange` 改为真正的原生事件订阅 |
| JS | `src/utils/windowSizeTools.ts` | 窗口尺寸/insets 三路刷新（Dimensions + 原生事件 + 首帧查询） |
| JS | `src/components/SizeView.tsx` | 分屏/小窗时重新量根视图、刷新 `statusbarHeight` |
| JS | `src/core/deviceCompat.ts`（新增） | 品牌识别、品牌保活提示、系统入口引导 |
| JS | `src/screens/Home/Views/Setting/settings/Other/DeviceCompat.tsx`（新增） | 设备兼容设置区块（由 Lead 接入 `Other/index.tsx`） |
| 发版 | `scripts/release.js` | 归档 `arm64-v8a` / `armeabi-v7a` / `universal` 三个包 |
| 文档 | 本文件 | — |

---

## 2. targetSdk 36（Android 16）行为变更清单

Android 16 起，>=36 的应用会强制生效以下行为，逐条对应本次处理：

### 2.1 Edge-to-edge 强制生效，不可 opt-out
- Android 15（API 35）开始对 targetSdk>=35 的应用强制 edge-to-edge；Android 16 延续该策略，
  `WindowCompat.setDecorFitsSystemWindows(window, true)` / `windowOptOutEdgeToEdgeEnforcement` 不再能回到旧行为。
- 本项目原本已经主动 edge-to-edge：`MainActivity.onCreate` 里 `setDecorFitsSystemWindows(false)`，
  但只处理了顶部状态栏（RN 侧 `statusbarHeight`），**底部导航栏没有留白** → 内容会被三键导航挡住。
- 处理：
  - `MainActivity` 用 `ViewCompat.setOnApplyWindowInsetsListener(android.R.id.content, …)`，
    把 `WindowInsetsCompat.Type.navigationBars().bottom` 作为根内容底部 padding；
    分屏 / 小窗 / 折叠屏形态、手势导航 ↔ 三键导航切换时系统重新分发 insets，padding 自动更新。
  - **只处理底部**：顶部状态栏仍由 RN 侧 `statusbarHeight` 处理；横屏挖孔左右留白仍由
    `CutoutCompensator`（`窗口宽 - 布局宽` 负 margin）处理，这里不能加左右 padding，否则会打架。
  - 同时把窗口/insets 变化推给 JS（见 §5），保证 RN 侧 `windowSizeTools` 跟着刷新。

### 2.2 预测性返回（Predictive Back）默认开启
- Android 16 起 targetSdk 36 的应用默认启用预测性返回，系统不再把 `onBackPressed()` / `KEYCODE_BACK`
  分发给应用，而改用 `OnBackInvokedDispatcher`。
- 官方文档说明：targetSdk 36 的 App 在 Android 16+ 设备上预测性返回系统动画默认开启，
  **`onBackPressed()` 不再被调用、`KEYCODE_BACK` 也不再派发**（见
  [Behavior changes: apps targeting Android 16+](https://developer.android.com/about/versions/16/behavior-changes-16#predictive-back)）。
- react-native-navigation 7.39 已迁移到 `androidx.activity.OnBackPressedDispatcher`，但 RNN 的返回栈
  与 RN JS `BackHandler` 的组合行为在无设备时无法验证，因此本次采取保守方案：
  `AndroidManifest.xml` 的 `<application>` 增加 `android:enableOnBackInvokedCallback="false"`，
  保持 legacy 返回行为（RNN 的返回栈、侧滑返回、JS BackHandler 全部维持现状）。
- 注意：该 opt-out 开关是官方临时保留的兼容手段（Google 已说明未来版本会移除，届时预测性返回强制生效），
  所以**必须真机回归**返回键/手势返回；如果实测发现开关在部分 ROM 上不生效（系统动画仍拦截返回），
  临时回退方案是去掉该开关并验证 RNN 的 `OnBackPressedDispatcher` 路径是否已能覆盖所有场景
  （RNN 7.39 内部已注册 `OnBackPressedCallback`，但 JS `BackHandler` 依赖 `onKeyUp(KEYCODE_BACK)`，
  预测性返回下不派发，需要给 RNN 打补丁或升级）。
- **后续迁移路线**（后续版本再做）：
  1. 去掉 `enableOnBackInvokedCallback=false`；
  2. RNN 升级到明确支持 predictive back 的版本（或替换导航方案）；
  3. 用 `OnBackInvokedCallback` / `BackHandler` 统一处理返回，补 `OnBackAnimationCallback` 动画；
  4. 真机回归：返回键、手势返回、侧滑返回、弹窗关闭、多级页面回退、RNN Modal。
- 风险：部分 ROM 对 `enableOnBackInvokedCallback=false` 的实现不完全一致（如手势返回仍走预测动画），
  需真机验证（见 §9）。

### 2.3 前台服务（FGS）强化 —— 必须声明类型
- targetSdk 34+（Android 14）起：启动前台服务必须声明 `foregroundServiceType` 并申请对应普通权限，
  否则 `startForeground()` 抛 `MissingForegroundServiceTypeException`。
- targetSdk 31+（Android 12）起：从后台启动前台服务会抛 `ForegroundServiceStartNotAllowedException`。
- 本项目播放服务来自 `react-native-track-player@2.1.2`（库 manifest 没有声明类型），处理：
  1. app manifest 合并 `com.guichaguri.trackplayer.service.MusicService` +
     `android:foregroundServiceType="mediaPlayback"`；
  2. manifest 补 `FOREGROUND_SERVICE`、`FOREGROUND_SERVICE_MEDIA_PLAYBACK` 权限；
  3. 依赖补丁让两处 `startForeground` 在 Android 10+ 显式传
     `ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK`，并用 try/catch 兜底两类异常（降级为只记日志，
     不再崩溃）。
- 三星等 ROM 的媒体通知还依赖 `POST_NOTIFICATIONS`（Android 13+ 运行时权限），manifest 已补，
  JS 侧启动时仍会走 `requestStartupPermissions`（`src/core/permissions.ts`）申请一次。

### 2.4 动态注册广播接收器必须显式声明导出标志
- targetSdk 34+：动态注册非系统广播时必须传 `RECEIVER_EXPORTED` / `RECEIVER_NOT_EXPORTED`，
  否则抛 `SecurityException`。
- `UtilsModule.java` 与 `lyric/Lyric.java` 各有 `SCREEN_ON/SCREEN_OFF` 监听，已统一改为：
  `ContextCompat.registerReceiver(ctx, receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)`，
  低版本自动退化为旧 API，兼容 minSdk 21。

### 2.5 通知权限（Android 13+）
- `POST_NOTIFICATIONS` 是运行时权限，未授予时：前台服务仍能运行，但通知不显示。
- 设置页新增「设备与权限」区块，可一键跳系统通知设置；首次启动仍由 `requestStartupPermissions` 申请。

### 2.6 16KB 页大小（Android 16 部分设备）
- 详见 §7「已知限制」，本次不处理。

### 2.7 其他需要回归的 targetSdk 变化
- **存储（重要，跨任务）**：targetSdk 30+ 起分区存储强制生效，`requestLegacyExternalStorage="true"` 完全失效。
  升级前（targetSdk 29）在 Android 11+ 上仍可走 legacy 路径直接读写 `/storage/emulated/0/Music`；
  升级到 36 后，**没有「所有文件访问权限」（MANAGE_EXTERNAL_STORAGE）时直接文件路径读写会被拒**。
  影响：下载落到公共目录、本地曲库直接 walk 目录。缓解：`MANAGE_EXTERNAL_STORAGE` 仍保留，
  设置页新增的「设备与权限 → 所有文件访问权限」引导；下载/扫描侧（task-1）需回落到
  MediaStore / SAF / app 私有目录。**发版后必须回归：下载 → 本地曲库 → 重扫。**
- **导航栏底色**：Android 15+ 强制 edge-to-edge 后 `Window.setNavigationBarColor` 基本被忽略，
  RNN options 里的 `navigationBar.backgroundColor` 可能不再生效；底部导航栏区域显示的是窗口底色
  （`UtilsModule.setWindowBackgroundColor` 跟随主题），需回归三键导航下的视觉。
- **方向/尺寸限制**：Android 16 起 targetSdk 36 的应用在 SW>=600dp 的大屏上不能再限制方向/resize，
  已加 `android:resizeableActivity="true"` 并依赖现有横竖布局切换。
- **精确闹钟 / 后台启动 Activity**：本应用未使用。
- **`WindowInsets` 动画**：键盘弹出时 `adjustResize` 在 edge-to-edge 下的行为需真机回归（见 §9 验证项）。

---

## 3. Manifest 变更详解

```xml
<!-- 权限 -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />

<!-- application -->
<application
    …
    android:enableOnBackInvokedCallback="false">

  <!-- MainActivity -->
  <activity android:name=".MainActivity" …
      android:resizeableActivity="true" />

  <!-- 合并 track-player 的播放服务类型 -->
  <service
      android:name="com.guichaguri.trackplayer.service.MusicService"
      android:foregroundServiceType="mediaPlayback"
      android:exported="true" />
</application>
```

说明：
- 库自身的 `MusicService` 没有声明 `foregroundServiceType`，app 层声明后 manifest merger 会合并属性，
  **不需要 `tools:replace`**（没有属性冲突）；库里的 `exported=true` 与 `MEDIA_BUTTON` intent-filter 保留。
- 带 intent-filter 的组件（`MainActivity`、`MediaButtonReceiver`）都已有 `android:exported`，
  `DirectoryPickerActivity`、`FileProvider` 为 `exported=false`，targetSdk 31+ 的 exported 强制要求已满足。

---

## 4. 依赖补丁（`dependencies-patch.js`）

`react-native-track-player` 是 `file:../vendor/react-native-track-player` 的本地依赖，
`npm install` 会把它复制进 `node_modules`，再由 `postinstall` 里的 `node dependencies-patch.js` 打补丁。
本次新增 3 组幂等补丁（锚点均为 2.1.2 上游原文，上游改动导致锚点消失时会报错而不是写坏文件）：

### 4.1 `MetadataManager` 通知点击 PendingIntent
```java
// 补丁前
builder.setContentIntent(PendingIntent.getActivity(context, 0, openApp, PendingIntent.FLAG_CANCEL_CURRENT));
// 补丁后：保留 FLAG_CANCEL_CURRENT，Android 6.0+ 追加 FLAG_IMMUTABLE
int contentIntentFlags = PendingIntent.FLAG_CANCEL_CURRENT;
if(Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) contentIntentFlags |= PendingIntent.FLAG_IMMUTABLE;
builder.setContentIntent(PendingIntent.getActivity(context, 0, openApp, contentIntentFlags));
```
原因：targetSdk 31+ 创建 PendingIntent 必须显式指定可变性，否则播放时抛 `IllegalArgumentException` 直接崩溃。
（库内收藏/循环按钮的 `PendingIntent.getService` 此前已通过旧补丁加了 `FLAG_IMMUTABLE`。）

### 4.2 `MusicService` 两处 `startForeground`
- `onCreate()`：try/catch 包住，失败 `Log.e` + `stopSelf()`，不崩进程；
- `onStartForeground()`（媒体键后台拉起路径）：try/catch 后照旧 `stopSelf()`，只记日志；
- 抽公共方法 `startForegroundWithNotification(channel)`：Android 10+ 用三参
  `startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)`。
- `MetadataManager.updateNotification()` 的 `service.startForeground(...)` 同样带类型 + try/catch。

### 4.3 校验方式
```bash
node dependencies-patch.js --strict   # 任一补丁没生效 → 非零退出
```
`scripts/release.js` 在构建前已经强制跑 `--strict`，发版不会漏补丁。

幂等性验证（模拟全新 `npm install`）：
```bash
# 把 node_modules 里被补丁改过的两个文件还原成 vendor 原始版本，再跑一次
cp ../vendor/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/MusicService.java \
   node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/MusicService.java
cp ../vendor/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java \
   node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java
node dependencies-patch.js --strict      # 应全部 Patched，退出码 0
node dependencies-patch.js --strict      # 再跑一次应全部 Skipping（24 条），且文件内容不变
```
本次已实测：从 vendor 原始文件全量打补丁 → 结果与预期补丁后文件完全一致；重复执行 24 条全部 skip、
没有重复插入。

> 升级 track-player 时：如果 `--strict` 报「没找到锚点」，说明上游源码变了，
> 需要按新版本源码重写锚点（或确认上游已自行修复后删除对应补丁）。

---

## 5. 分屏 / 小窗动态响应

### 5.1 原生侧
- `MainActivity.setupBottomInsetPadding()`：
  - `ViewCompat.setOnApplyWindowInsetsListener(android.R.id.content, …)`；
  - `bottom = 初始 padding + navigationBars.bottom`，变化时 `setPadding` 并 `view.post(() -> UtilsModule.notifyWindowMetricsChanged())`；
  - 不消费 insets（return insets），子 View 仍能拿到原始值。
- `UtilsModule`：
  - `getWindowInsets()`（ReactMethod，Promise）：返回 px 单位的
    `statusBars / navigationBars / systemBars / cutout / ime` + `density` + `isInMultiWindowMode`；
  - `listenWindowSizeChanged()`：JS 订阅后给 decor view 挂 `OnLayoutChangeListener`，
    窗口尺寸变化时发 `screen-size-changed` 事件；
  - 事件负载：`{ width, height }`（dp，等于 RN 可用区域）、`{ pixelWidth, pixelHeight }`（px）、
    `density`、五组 insets（px）、`isInMultiWindowMode`；
  - `onHostResume()` 时重挂监听（Activity 重建后仍有效）。

> 为什么不能只靠 RN 的 `Dimensions`：RN 0.73 在 Android 上只在旋转时重新初始化 `DisplayMetricsHolder`，
> Android 15/16 上拖拽分屏/小窗改变窗口尺寸时 `Dimensions` 可能不更新；原生事件是唯一可靠来源。

### 5.2 JS 侧
- `src/utils/nativeModules/utils.ts`：
  - `onWindowSizeChange(handler)`：订阅原生 `screen-size-changed`（原实现调用了不存在的原生方法，已修复）；
  - `getWindowInsets()`、`getDeviceCompatInfo()`、`getManufacturer/getBrand/getModel()`、
    `openAutoStartSettings()`、`openAppDetailsSettings()` 的封装。
- `src/utils/windowSizeTools.ts`：
  - `size` 仍为 `{ width, height }`（dp），新增 `insets`（px）/`getInsets()`/`onInsetsChanged()`/
    `applyWindowMetrics()`；
  - 三路刷新：`Dimensions.change`（旋转/部分 ROM）、原生 `screen-size-changed`（分屏/小窗/导航栏变化）、
    `init()` 首帧直查原生窗口尺寸；尺寸没变不重复通知，避免布局循环。
- `src/components/SizeView.tsx`：
  - 收到原生窗口尺寸事件后重新 `measureInWindow` 根视图，重算 `statusbarHeight` 并同步 `windowSizeTools`；
  - 修复分屏拖拽时 `Dimensions` 不刷新导致 `statusbarHeight`/窗口尺寸不更新的问题。
- 已有布局无需重写：`useWindowSize()`/`isHorizontalMode()` 都基于 `windowSizeTools`，
  分屏/小窗尺寸变化后会自动重新渲染；窄窗（横屏分屏）沿用现有 `isHorizontalMode` 的横/竖布局切换。
  底部遮挡由原生 padding 统一兜底，RN 各页面不需要自己再加 navigation inset。

### 5.3 验证方法（真机）
```bash
# 进入分屏：先打开 EmoMusic，再进入最近任务 → 长按卡片 → 分屏，或：
adb shell am start -n cn.emomusic.mobile/.MainActivity
adb shell input keyevent KEYCODE_APP_SWITCH
# 自由窗口（部分系统需要先开开发者选项）：
adb shell settings put global enable_freeform_support 1   # 需重启生效
adb shell am start -n cn.emomusic.mobile/.MainActivity --windowingMode 5

# 观察窗口尺寸/insets
adb logcat -s ReactNativeJS:V | grep -i 'win size'

# 拖动分屏分隔条，确认：
#  1. 底部导航栏不遮挡内容（三键导航最明显）；
#  2. 横竖布局随可用尺寸切换（isHorizontalMode）；
#  3. 设置页/首页/播放器无溢出、无重复留白；
#  4. 切回全屏后 padding 恢复。
```

---

## 6. ABI 与屏幕密度矩阵

### 6.1 ABI
| 项 | 值 |
| --- | --- |
| 支持 ABI | `arm64-v8a`、`armeabi-v7a`（x86/x86_64 不再产出正式包） |
| gradle 开关 | `android/gradle.properties` → `reactNativeArchitectures=arm64-v8a,armeabi-v7a` |
| splits | `enableSeparateBuildPerCPUArchitecture=true` + `universalApk=true` → 每 ABI 一个包 + universal |
| versionCode | `versionCode * 1000 + {armeabi-v7a:1, arm64-v8a:3}`；universal 不覆盖 versionCode |
| 产物 | `em-music-vX.Y.Z-arm64-v8a.apk`、`em-music-vX.Y.Z-armeabi-v7a.apk`、`em-music-vX.Y.Z-universal.apk` |
| 归档 | `scripts/release.js` → `dist/EmoMusic-vX.Y.Z-{arm64-v8a,armeabi-v7a,universal}.apk`（缺失的会告警跳过） |

校验命令：
```bash
# universal 只应包含两个 ABI（不应出现 x86 / x86_64）
unzip -l dist/EmoMusic-vX.Y.Z-universal.apk | grep -E 'lib/[^/]+/' | awk -F'lib/' '{print $2}' | cut -d/ -f1 | sort -u
# 期望输出：armeabi-v7a  arm64-v8a

# 单 ABI 包只包含对应目录
unzip -l dist/EmoMusic-vX.Y.Z-arm64-v8a.apk | grep 'lib/' | head

# aapt 校验 targetSdk / 密度 / native-code
$ANDROID_HOME/build-tools/35.0.0/aapt dump badging dist/EmoMusic-vX.Y.Z-universal.apk | grep -E "targetSdkVersion|native-code|densities"
# 期望：targetSdkVersion:'36'
#       native-code: 'arm64-v8a' 'armeabi-v7a'
#       densities: '120' '160' '240' '320' '480' '640'
```

### 6.2 屏幕密度
| 密度 | dpi | 缩放（相对 mdpi） | launch_screen（竖） | launch_screen（横） | ic_launcher / round | ic_launcher_emo |
| --- | --- | --- | --- | --- | --- | --- |
| ldpi | 120 | 0.75 | 203×360 | 360×203 | 36×36 | 81×81 |
| mdpi | 160 | 1.0 | 270×480 | 480×270 | 48×48 | 108×108 |
| hdpi | 240 | 1.5 | 356×634 | — | 72×72 | 162×162 |
| xhdpi | 320 | 2.0 | 540×960 | — | 96×96 | 216×216 |
| xxhdpi | 480 | 3.0 | 810×1440 | — | 144×144 | 324×324 |
| xxxhdpi | 640 | 4.0 | 1080×1920 | — | 192×192 | 432×432 |

- 本次新增 `res/drawable-ldpi/`、`res/drawable-land-ldpi/`、`res/mipmap-ldpi/`，
  全部由 mdpi 资源用 macOS `sips -z H W` 等比缩放（0.75 倍后四舍五入），PNG 格式与原资源一致。
- hdpi 的 `launch_screen.png` 是历史素材（356×634，非严格按 1.5 倍），未改动。
- `mipmap-anydpi-v26` 的自适应图标（API 26+）优先于密度位图，只有 API<26 的老设备才会用到 `mipmap-ldpi` 的位图。
- 缺图时的 fallback：Android 资源系统会按密度就近取图（ldpi 设备缺某密度资源时通常向上取 mdpi），
  启动主题 `styles.xml` 里没有按密度写死的尺寸，无需额外处理。

模拟密度验证：
```bash
adb shell wm density            # 当前密度
adb shell wm density 120        # 切到 ldpi，重启 App 观察启动图/图标/布局
adb shell wm density reset
```

---

## 7. 已知限制

1. **16KB 页大小（Android 16 部分设备）**
   - 检查方式（arm64 预编译 so）：
     ```bash
     unzip -o dist/EmoMusic-vX.Y.Z-arm64-v8a.apk 'lib/arm64-v8a/*' -d /tmp/apk-lib
     readelf -lW /tmp/apk-lib/lib/arm64-v8a/libhermes.so | grep LOAD
     # p_align 仍是 0x1000（4KB）→ 16KB 页大小设备上加载会失败
     ```
   - 现状：RN 0.73 官方预编译 `.so`（libhermes / libreactnativejni / libappmodules 等）都是 4KB 对齐，
     在 16KB page size 的设备（部分 Android 16 新机）上启动会 `dlopen` 失败。
   - 根治需要升级 RN 到 0.79+ / 使用 16KB 对齐的 so，或自行用 `-Wl,-z,max-page-size=16384` 重编所有 native 库。
     **本次不做**（工程量与风险都超出兼容升级范围），需在发版说明里注明支持设备范围。
   - **RN 0.76.9 复核（v3.41.0，2026-11-08）**：`libjsi.so` / `libreactnative.so` / `libquickbase64.so` /
     `libquickmd5.so`（arm64）仍全部 `p_align=0x1000`（4KB）。RN 0.77 才引入 16KB 支持；
     本项目走站内/侧载分发，暂不受 Google Play 的 16KB 要求阻断，待新架构升级（RN 0.77+）一起解决。
2. **预测性返回**
   - 本次用 `enableOnBackInvokedCallback=false` 保守关闭，未接入 predictive back 动画；
     后续迁移路线见 §2.2。
3. **键盘（IME）与 edge-to-edge**
   - `adjustResize` 在强制 edge-to-edge 下的行为随 ROM 有差异，本次只处理底部导航栏 inset，
     未把 IME inset 加入根 padding（避免与 `adjustResize` 双重留白）。需真机回归输入框是否被键盘遮挡；
     如出现遮挡，可在 `MainActivity` 的 insets listener 里按 `ime().bottom > navigationBars.bottom`
     追加 IME 留白（注意同时确认 window 是否已被 resize）。
4. **密度资源**
   - 只补了 120dpi 关键资源（启动图 + 启动图标）；没有为每个密度重画高清素材，ldpi 是缩放图，可能略糊。
5. **厂商自启动页**
   - 各 ROM 的 Activity 名称随系统版本变化，intent 链式 fallback 无法覆盖所有版本；
     全部失败时回落到应用详情页（有提示），不会崩溃。

---

## 8. 品牌兼容

### 8.1 原生接口（`UtilsModule.java`）
| 方法 | 返回 | 说明 |
| --- | --- | --- |
| `getManufacturer()` / `getBrand()` / `getModel()` | `string` | `Build.*` 字段 |
| `getDeviceCompatInfo()` | `{ manufacturer, brand, model, device, osVersion, sdkInt }` | 设备信息汇总 |
| `openAutoStartSettings()` | `{ opened: boolean, target: string }` | 打开厂商自启动页，失败回落应用详情页；target = 实际打开的包名 / `appDetails` / `none` |
| `openAppDetailsSettings()` | `boolean` | 系统应用详情页（最终兜底） |

### 8.2 品牌 intent 表
按 `Build.MANUFACTURER/Build.BRAND` 关键字匹配，按顺序尝试，命中且 `resolveActivity != null` 才启动：

| 品牌 | 关键字 | 尝试的 ComponentName |
| --- | --- | --- |
| 小米 / 红米 / POCO | xiaomi / redmi / poco | `com.miui.securitycenter/com.miui.permcenter.autostart.AutoStartManagementActivity` → `com.miui.securitycenter/com.miui.powercenter.PowerSettings` |
| 华为 / 荣耀 | huawei / honor / harmony | `com.huawei.systemmanager/...startupmgr.ui.StartupNormalAppListActivity` → `...appcontrol.activity.StartupAppControlActivity` → `...optimize.process.ProtectActivity` |
| OPPO / 一加 / realme | oppo / oplus / oneplus / realme | `com.coloros.safecenter/...permission.startup.StartupAppListActivity` → `...startupapp.StartupAppListActivity` → `com.oplus.safecenter/...permission.startup.StartupAppListActivity` → `com.oneplus.security/...chainlaunch.view.ChainLaunchAppListActivity` |
| vivo / iQOO | vivo / iqoo | `com.vivo.permissionmanager/...activity.BgStartUpManagerActivity` → `com.iqoo.secure/...ui.phoneoptimize.BgStartUpManager` |
| 三星 | samsung | `com.samsung.android.lool/...sm.ui.battery.BatteryActivity` → AOSP `Settings$HighPowerApplicationsActivity`（三星无独立自启动开关） |
| 魅族 | meizu / mblu | `com.meizu.safe/...permission.SmartBGActivity` → `com.meizu.safe/...security.SecureMainActivity` |
| 通用兜底 | — | `com.android.settings/com.android.settings.Settings$HighPowerApplicationsActivity` → 应用详情页 → 系统设置首页 |

所有跳转都在 try/catch 内，组件不存在、未导出、被 ROM 拦截都不会崩溃。

### 8.3 JS 侧
- `src/core/deviceCompat.ts`：
  - `readDeviceBrandInfo()`：品牌归类（`xiaomi/huawei/oppo/vivo/samsung/meizu/generic`）+ 名称；
  - `getBrandTips()`：各品牌后台保活文案；
  - `readDeviceCompatStatus()`：通知权限 / 所有文件访问 / 电池优化三项状态；
  - `openNotificationGuide()` / `openAllFilesAccessGuide()` / `openBatteryOptimizationGuide()` /
    `openAutoStartGuide()`：带兜底（打不开就回应用详情页）。
- `src/screens/Home/Views/Setting/settings/Other/DeviceCompat.tsx`：
  - 以现有 `Section` + 行式（图标 + 标题/描述 + 右侧状态/箭头）风格展示；
  - 设备信息、通知权限、所有文件访问、电池优化、自启动、系统应用设置；
  - 品牌保活提示列表；`AppState` 变 active 时自动刷新状态；
  - **由 Lead 接入 `Other/index.tsx`，本文件不改语言包**（文案暂为中文硬编码）。

---

## 9. 构建与真机验证清单

> 构建由 Lead 统一执行（避免多 agent 同时 gradle 产生构建目录冲突）。

### 9.1 构建前
```bash
cd /Users/wangbaye/Projects/MDL/EmoMusic
npx tsc --noEmit -p tsconfig.json          # 必须 0 错误
node dependencies-patch.js --strict        # 必须全部生效
```

### 9.2 构建
```bash
cd android && ./gradlew :app:assembleRelease
# 或直接：node scripts/release.js --no-build 之外的完整流程（会先跑 tsc + --strict）
```

### 9.3 产物校验（不装设备也能做）
```bash
APK=android/app/build/outputs/apk/release/em-music-vX.Y.Z-universal.apk
$ANDROID_HOME/build-tools/35.0.0/aapt dump badging "$APK" | grep -E "package:|targetSdkVersion|native-code|densities"
unzip -l "$APK" | grep -E 'lib/[^/]+/' | awk -F'lib/' '{print $2}' | cut -d/ -f1 | sort -u
# 期望只有 armeabi-v7a / arm64-v8a
unzip -l "$APK" | grep -E 'res/drawable-ldpi|res/mipmap-ldpi' || true
# ldpi 资源会被编译进 resources.arsc，可用 aapt dump resources 查：
$ANDROID_HOME/build-tools/35.0.0/aapt dump resources "$APK" | grep -i 'ldpi' | head
```

### 9.4 真机验证（设备：SM-S938B / Android 17，targetSdk 36 行为在 Android 16+ 生效）
```bash
# 安装（Lead/QA）
adb install -r dist/EmoMusic-vX.Y.Z-arm64-v8a.apk

# 1) 返回键 / 侧滑返回：逐级回退，不应崩溃、不应直接退出
adb shell input keyevent 4
adb logcat -c && adb shell input keyevent 4 && adb logcat -d | grep -iE 'AndroidRuntime|FATAL|BackInvoked|OnBackPressed'

# 2) 播放 → 通知 / 前台服务
adb logcat -c
# 在 App 里播放一首歌
adb logcat -d -s RNTrackPlayer:V AndroidRuntime:E | grep -iE 'startForeground|MissingForegroundServiceType|ForegroundServiceStartNotAllowed|IllegalArgumentException|SecurityException'
adb shell dumpsys activity services cn.emomusic.mobile | grep -iE 'MusicService|foregroundServiceType|isForeground'
# 期望：MusicService isForeground=true，类型含 mediaPlayback，无异常日志

# 3) 通知权限
adb shell dumpsys package cn.emomusic.mobile | grep -E 'POST_NOTIFICATIONS|FOREGROUND_SERVICE'
adb shell cmd notification list | grep -i emo

# 4) 分屏 / 小窗（见 §5.3）
# 5) 密度
adb shell wm density 120 && adb shell am force-stop cn.emomusic.mobile && adb shell am start -n cn.emomusic.mobile/.MainActivity
adb shell wm density reset

# 6) ABI（安装后确认 primaryCpuAbi）
adb shell dumpsys package cn.emomusic.mobile | grep -iE 'primaryCpuAbi|secondaryCpuAbi'
```

### 9.5 回归重点
- 启动 → 首页 → 播放器 → 设置页 → 搜索（键盘）→ 下载，全流程不崩。
- 三键导航下底部按钮不被遮挡；手势导航下留白正确。
- 横屏挖孔左侧留白与改造前一致（CutoutCompensator 不回归）。
- 通知栏播放控制（播放/暂停/上一首/下一首/收藏/循环）正常，点击通知能回 App。

---

## 10. 回滚方式

本次改动未提交 git 历史（工作区改动），按文件回滚即可：

```bash
cd /Users/wangbaye/Projects/MDL/EmoMusic

# 1) 还原构建配置 / Manifest / 原生代码 / JS / 脚本 / 文档
git checkout -- \
  android/build.gradle \
  android/gradle.properties \
  android/app/build.gradle \
  android/app/src/main/AndroidManifest.xml \
  android/app/src/main/java/cn/emomusic/mobile/MainActivity.java \
  android/app/src/main/java/cn/emomusic/mobile/utils/UtilsModule.java \
  android/app/src/main/java/cn/emomusic/mobile/lyric/Lyric.java \
  dependencies-patch.js \
  scripts/release.js \
  src/utils/nativeModules/utils.ts \
  src/utils/windowSizeTools.ts \
  src/components/SizeView.tsx
rm -f src/core/deviceCompat.ts
rm -f src/screens/Home/Views/Setting/settings/Other/DeviceCompat.tsx
rm -f doc/android-16-compat.md
rm -rf android/app/src/main/res/drawable-ldpi \
       android/app/src/main/res/drawable-land-ldpi \
       android/app/src/main/res/mipmap-ldpi

# 2) 撤销 node_modules 里的 track-player 补丁（重装依赖最干净）
npm install       # postinstall 会跑旧版 dependencies-patch.js
# 或者：从 vendor 重新复制
node scripts/setup-vendor.js
```

只回滚 targetSdk（保留其它优化）时：把 `android/build.gradle` 的 `targetSdkVersion` 改回 `29`、
删掉 manifest 里的 `enableOnBackInvokedCallback` / FGS 权限 / MusicService 合并（或保留，都是兼容旧版本的），
并按需删掉 `dependencies-patch.js` 新增的三组补丁后 `npm install`。
