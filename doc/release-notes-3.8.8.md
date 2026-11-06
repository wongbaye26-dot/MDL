# v3.8.8 发布说明

> 版本 **3.8.8** / versionCode **190**（arm64-v8a 包 190003、armeabi-v7a 包 190001）
> Android 16（targetSdk 36），`minSdk 21`，ABI：`arm64-v8a` + `armeabi-v7a`。

---

## 设置页视觉与字体大小

- **设置主页 + 全部子设置页重做**：
  - 和普通页面共用背景，不再铺设置页自己的渐变背景；
  - 分组保留圆角卡片，浅色主题去掉白色卡片底，改为主题淡色半透明表面；
  - 分组头加图标，入口统一为圆角图标 + 标题/摘要 + chevron；
  - 「播放与下载」改为双列入口卡；内容/系统分组保持列表。
- **设置主页一屏显示**：压缩页头、行高和分组间距，竖屏设置主页关闭滚动，8 个入口一屏可见。
- **字体大小实时生效**：设置 → 基本设置 → 界面 → 字体大小，点选后立即生效，无需重启；面板包含当前百分比、字号预览和 80–130 六档选择。
- **横屏设置**同步套用新的卡片与导航样式。

## 稳定性与发版

- 修复 Material You「跟随系统主题色」切换明暗时生成 `rgb(NaN,NaN,NaN)`、导致 LinearGradient 崩溃的问题。
- `release.js` 自动生成 `publish/version.json`；关于页新增「检查更新」；CI 发布时上传 GitHub Release 资产。
- `npm run lint` 接入出包前置检查；忽略第三方压缩词典，修复全量 lint 报错。
- 清理评论页、lx 同步、桌面歌词（含原生悬浮窗与 `SYSTEM_ALERT_WINDOW`）、定时退出、备份设置页；蓝牙/锁屏歌词保留。

---

## 验证

- `npm run typecheck`：0 error
- `npm run lint`：0 problem
- `./gradlew :app:assembleRelease`：BUILD SUCCESSFUL
- 真机：SM-S938B / Android 17，版本 3.8.8 / versionCode 190，冷启动无 FATAL；设置页浅色/深色/横屏与字体大小实时切换均已验收。
