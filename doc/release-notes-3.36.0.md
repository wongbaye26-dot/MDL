# EmoMusic v3.36.0 说明

> 版本 **3.36.0** / versionCode **326**

## 请求域名诊断修复
- 原实现用 `new URL()` 解析，Hermes 下可能不可用且异常被吞，导致「HTTP 明文域名」一直为空；
- 改为纯正则 `getHttpHost()`，并记录 http/https 两种请求域名；
- 诊断页改名「请求域名」，显示：
  - `http://host`（需要后续白名单治理）
  - `https://host`
- 新增 `tests/http-host.test.js`，单测 30 → **32**。

## 说明
- 只有触发搜索/播放/刮削等网络请求后才会出现记录。
- 原生图片/音频加载不经过 JS 请求层，不在本次采集范围，后续需要原生侧采集。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `0311a0db5490f164c3e8c163605be7bf6394c9c217d59ca4ed617d1b8fb68f00` |
| armeabi-v7a | `d565d1df9cef985d4f5e06ce652be3d395ecc051319248e4cfaaca62519c5ed5` |
| universal | `29656f4d3c1e6a9f888dd5a50cdd7866041fdf394861eedf024079fe339e6498` |
