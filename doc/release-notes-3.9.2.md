# v3.9.2 修复发布说明

> 版本 **3.9.2** / versionCode **193**（arm64-v8a 包 193003、armeabi-v7a 包 193001）
> Android 16（targetSdk 36），`minSdk 21`，ABI：`arm64-v8a` + `armeabi-v7a`。

## 修复

### M3U 导出失败
- 3.9.1 及以前的导出走内置目录选择器，依赖 `WRITE_EXTERNAL_STORAGE`；Android 10+ 已忽略该权限，真机表现为“行行行”授权后仍提示拒绝，无法写出文件。
- 修复：导出改用 **系统 SAF 目录授权**（`ACTION_OPEN_DOCUMENT_TREE`），用户选择目录并允许访问后，直接写入该目录的 content URI。
- 真机验证（SM-S938B / Android 17）：
  - 选择 `Download/emo_m3u` → 允许访问；
  - 写出 `emo_local_2026-11-06.m3u8`，**24,007 字节 / 238 首**；
  - 首行 `#EXTM3U`，条目形如 `#EXTINF:321,张韶涵 - 阿刁 (Live)` + 原文件路径。

## 说明

- 导入路径未改（系统文件选择器），3.9.1 已验证可生成「导入歌单 …」。
- 同名 `.lrc` 真机加载/歌词偏移听感仍 NOT RUN；本轮测试文件已从设备清理。
- 批量删除回收目录、扫描失权 UI 仍待做。

## 验证

- `npm run typecheck`：0
- `npm run lint`：0
- `npm run test:unit`：12/12
- `./gradlew :app:assembleRelease`：BUILD SUCCESSFUL
- 真机：versionName 3.9.2 / versionCode 193

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.9.2-arm64-v8a.apk | `cac13e3344e006c19f189ffd4952e198b3a8f4f30ee7c412b9539b287cdadeaf` |
| universal | em-music-v3.9.2-universal.apk | `741618d379d6a13a32a933f4fac5d1a3948303ef2bb5fcc730b1d80be9ff928e` |
