# EmoMusic v3.35.0 发行说明（审计修复第八批）

> 版本 **3.35.0** / versionCode **325**

## HTTP 明文流量可观测
- 设置 → 本地曲库 → 标签刮削 新增「HTTP 明文域名」：
  - 列出运行时实际请求过的 http:// 域名；
  - 可长按复制；
  - 用于后续做域名白名单、逐步关闭全局明文。

## 依赖升级状态
- 尝试给 vendor 暴露 rimraf/tsc 后，`react-native-track-player` 的 prepare 仍因缺少 `react-native` 类型声明失败；
- 为避免破坏原生播放构建，**lockfile 未改动**，依赖升级继续延后到专门窗口。

## 门禁
- typecheck 0 / lint 0 / test 30/30 / assembleRelease + verify:release 通过；
- 真机安装 3.35.0。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `7cb6fe90289d9cfbcae1a8d569b0f1f2a694aec9a376f3a480575bed7d3d8738` |
| armeabi-v7a | `06c37a74b64f4e4b839a0fd5c6f51ab3e8890123973b6d4ce43ff7c9dbd87bf6` |
| universal | `8bcd5679c63280c0ac5438988556b19a280ff6939e0a41690bfee59d5c3d5fcb` |
