# v3.9.1 修复发布说明

> 版本 **3.9.1** / versionCode **192**（arm64-v8a 包 192003、armeabi-v7a 包 192001）
> Android 16（targetSdk 36），`minSdk 21`，ABI：`arm64-v8a` + `armeabi-v7a`。

v3.9.0 发布后发现并修复两个真实问题，建议所有 3.9.0 用户升级。

## 修复

### 冷启动自动出声（默认暂停）
- 关闭「启动后自动播放音乐」时，冷启动恢复上次队列/进度后应保持暂停。
- 根因有两层：
  1. 核心 `handlePlay` 在异步恢复完成前就清掉 `restorePlayInfo`，插件误判为普通播放；
  2. 原生播放队列跨进程保留，插件走「队列已存在」分支时无条件 `play()`。
- 修复：恢复标记延迟到插件消费；队列已存在的恢复分支也保持 `pause`；启动后 5 秒内兜底，一旦检测到真的开始播就暂停。
- 真机验证：关闭自动播放 → `force-stop` → 冷启动，媒体会话为 `PAUSED`。

### 关于页版本号显示旧值
- 3.9.0 首次构建复用了 `createBundleReleaseJsAndAssets` 旧缓存，APK 内 JS bundle 仍是 3.8.8，导致「关于」显示 v3.8.8。
- 修复：发版前删除该缓存；`scripts/release.js` 已有该逻辑，本次手动构建补做。3.9.1 关于页显示 v3.9.1。

## 同时合入

- 重复歌曲清理：清理前把收藏 / 用户歌单里的多余条目替换为保留条目。
- 测试基线：`npm run test:unit`（node:test + Babel 注册器，零新增依赖）12/12；10k 纯索引基准 16.7ms / +3.2MB。
- 同名 `.lrc` 路径推导抽成纯函数并单测。

## 验证

- `npm run typecheck`：0
- `npm run lint`：0
- `npm run test:unit`：12/12
- `./gradlew :app:assembleRelease`：BUILD SUCCESSFUL
- 真机：SM-S938B / Android 17，versionName 3.9.1 / versionCode 192；About 显示 v3.9.1；关闭自动播放后冷启动 PAUSED。

## 仍未做 / NOT RUN

- M3U 实际导入（系统选择器已走到，未确认歌单落库）；导出被 Android 存储权限拒绝，NOT RUN。
- 同目录 `.lrc` 真机加载、歌词偏移听感。
- 批量删除回收目录、扫描失权 UI。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.9.1-arm64-v8a.apk | `af2c91ebd815bb8942c8aeb3e89ac2a8c2d6eee552ace57080f291364db787bd` |
| universal | em-music-v3.9.1-universal.apk | `4f65922ab12df35b52639565e5560201cfcb620a7d4b8c81c2139643deea17f3` |
