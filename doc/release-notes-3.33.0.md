# EmoMusic v3.33.0 发行说明（审计修复第六批）

> 版本 **3.33.0** / versionCode **323**

## 发版校验自动化
新增 `npm run verify:release`：
- 校验 dist 目录 APK 的 SHA256；
- 调用 apksigner 校验 release 证书必须为 `CN=Emo Music`；
- 校验 `SHA256SUMS` 是否存在；
- 本次 3.33.0 已通过。

## Vendor 构建可复现性
- `scripts/setup-vendor.js` 拉取 `react-native-file-system` / `react-native-local-media-metadata` 后自动移除 `prepare: bob build`：
  - 这两个包 Metro 入口是 `src`，types 由 dependencies-patch 指向 `src`，不需要 bob 产物；
  - 避免新机器 `npm i` 因缺少 bob 直接失败。

## 依赖升级状态
- 仍被 vendor `react-native-track-player` 的 `prepare` 阻塞：它需要 `rimraf`/`tsc`，npm 生命周期 PATH 里找不到；
- 为避免破坏原生构建，本批未强行升级 vendor 依赖；`npm audit` 结果保持不变。

## 门禁
- typecheck 0 / lint 0 / test 30/30 / assembleRelease + verify:release 通过；
- 真机安装 3.33.0。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `80a45589567d8be41cd96ba961244ea6ff0354e0d11e23b372ba2df7564e68ad` |
| armeabi-v7a | `f0648bfbd6763d093d4d7a3d40f466304fd1bba551a4c80d5c830d8364c8fa74` |
| universal | `ed33320c151247897163108f557e3940cd0e50e4fdbd95fe04d15aa9640a2159` |
