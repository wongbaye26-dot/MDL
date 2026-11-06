# 出包与签名

## 一键出包

```bash
npm run release              # 用当前版本号构建 + 归档
npm run release:patch        # 版本号 +0.0.1、versionCode +1，再构建归档
node scripts/release.js --bump minor
node scripts/release.js --no-build          # 只归档已有产物
node scripts/release.js --keep 3            # 只保留最近 3 个版本
node scripts/release.js --prune-delete      # 旧版本直接删（默认移到 dist-archive）
```

脚本做的事：改版本号 → 前置检查（`tsc` / `npm run lint` / 依赖补丁）→ 强制重打 JS bundle →
`assembleRelease` → 把 `arm64-v8a` / `armeabi-v7a` / `universal` 拷成 `dist/EmoMusic-v<版本>-<abi>.apk` →
从 `CHANGELOG.md` 生成 `publish/version.json`（App 内「检查更新」的数据源）→ 把超出保留数的旧版本移到 `dist-archive/`。

> **更新链路**：关于页的「检查更新」读 `publish/version.json`，下载地址指向 GitHub Release 的
> `em-music-v<版本>-<abi>.apk`。所以发版时要**先跑 `node scripts/release.js --bump patch`，把
> `package.json` + `publish/version.json` 一起提交**，再推 `master`；CI 会建 tag、GitHub Release 并上传三个 APK。
> 只推代码不跑 release.js，线上 App 检测不到新版本。

> **装包时注意**：`arm64-v8a` 的 versionCode 带 ABI 后缀（如 `146003`），能覆盖升级；
> `universal` 的 versionCode 是裸的 `146`，**低于**已装版本会报「降级」，
> 只能用于全新安装/发给别人。

## 签名密钥

release 签名用的是 `android/app/emomusic-release.keystore`（与旧 lxmusic 包完全隔离；旧密钥已归档到 `android/legacy-signing/`），配置在 `android/keystore.properties`
（该文件已 gitignore，不入库）。

```bash
npm run keystore:info   # 打印密钥路径、别名、SHA-256/SHA-1 指纹（不打印密码）
```

当前指纹：

```
SHA-256 : 02:0C:0C:4B:77:07:66:2D:CD:E2:86:A1:73:AB:C5:1A:82:D7:57:68:25:EE:CF:8F:C6:18:06:93:7B:09:89:0A
SHA-1   : EE:65:67:28:2E:E4:F9:F3:7C:95:37:47:53:73:49:9A:1A:2F:EE:DB
```

### 必须做的事

**把 `android/app/emomusic-release.keystore` 和 `android/keystore.properties` 备份到密码管理器 / 加密云盘。**

> 版本 3.6.0 起包名从 `cn.toside.music.mobile` 改为 `cn.emomusic.mobile`、签名换成全新的 `emomusic` 密钥，
> 与 lxmusic 官方包及旧 EMO 包在安装层面完全隔离（可共存、数据互不可见）。旧包如需继续更新，
> 请使用 `android/legacy-signing/lxmusic-release.keystore`（已归档，不要删除）。

签名不一致的后果：老用户装不上新版本，只能卸载重装 —— **本地音乐库、歌单、播放记录全丢**。
没有别的补救办法，Google Play / 各应用商店也不接受换钥匙。

备份内容：两个文件本身 + 上面两行指纹（用来日后核对是不是同一把钥匙）。

## 冒烟

```bash
npm run smoke    # 启动 / 扫描 / 播放 三条链路（需要手机连 adb）
```

下载链路无法自动化（首页大卡片有常驻动画，`uiautomator` 永远等不到 idle），
手动核对清单写在 `scripts/smoke.js` 文件头。
