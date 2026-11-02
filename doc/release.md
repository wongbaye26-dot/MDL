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

脚本做的事：改版本号 → 强制重打 JS bundle → `assembleRelease` → 把 `arm64-v8a` 和 `universal`
拷成 `dist/EMO-v<版本>-<abi>.apk` → 把超出保留数的旧版本移到 `dist-archive/`。

> **装包时注意**：`arm64-v8a` 的 versionCode 带 ABI 后缀（如 `146003`），能覆盖升级；
> `universal` 的 versionCode 是裸的 `146`，**低于**已装版本会报「降级」，
> 只能用于全新安装/发给别人。

## 签名密钥

release 签名用的是 `android/app/mdl-release.keystore`，配置在 `android/keystore.properties`
（该文件已 gitignore，不入库）。

```bash
npm run keystore:info   # 打印密钥路径、别名、SHA-256/SHA-1 指纹（不打印密码）
```

当前指纹：

```
SHA-256 : 25:2A:06:5F:6C:FC:DA:A0:6E:7F:A1:B9:53:DF:81:65:52:3D:0A:5E:20:5B:CF:11:0F:5B:29:F2:D5:14:71:20
SHA-1   : 1F:16:8C:87:A8:F5:97:43:07:1C:D0:B2:E8:F8:9E:BF:9D:4E:9A:79
```

### 必须做的事

**把 `mdl-release.keystore` 和 `keystore.properties` 备份到密码管理器 / 加密云盘。**

签名不一致的后果：老用户装不上新版本，只能卸载重装 —— **本地音乐库、歌单、播放记录全丢**。
没有别的补救办法，Google Play / 各应用商店也不接受换钥匙。

备份内容：两个文件本身 + 上面两行指纹（用来日后核对是不是同一把钥匙）。

## 冒烟

```bash
npm run smoke    # 启动 / 扫描 / 播放 三条链路（需要手机连 adb）
```

下载链路无法自动化（首页大卡片有常驻动画，`uiautomator` 永远等不到 idle），
手动核对清单写在 `scripts/smoke.js` 文件头。
