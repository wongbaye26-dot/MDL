# v3.9.25 发布说明

> 版本 **3.9.25** / versionCode **216**

## CUE 分段自测入口
设置 → 本地曲库 → 迁移自检新增「CUE 分段自测」：
- 取曲库第一首本地文件；
- 用 `parseCue` + `buildCueVirtualTracks` 生成 00:08 / 00:16 两段；
- 创建「CUE 自测」歌单并立即播放第一段；
- 预期：播放器从 8s 起播「分段 A」，到 16s 自动切「分段 B」。

不依赖 SAF 文件选择器，可直接真机验收 A2-09 起播偏移/段末切段。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功。

## 真机结果（2026-11-07）
- 点击「生成并播放」后：
  - 起播 `position=8080ms`，metadata「分段 A」，专辑「CUE 自测」；
  - 约 10s 后 metadata 变「分段 B」，`position=16349ms`；
- 说明起播 seek 到 8s、段末 16s 自动切段均正常。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.9.25-arm64-v8a.apk | `f34cb2a31dc38dfcdafb25283329e52857df56161a99ec7c23ee9c561a439175` |
| universal | em-music-v3.9.25-universal.apk | `20b19b7a508e209c39c46a27925895227a8655588ed83d9295a1d2c16afea0e4` |
