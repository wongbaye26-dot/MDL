# EmoMusic v3.11.8 修复说明

> 版本 **3.11.8** / versionCode **256**

## 修复暗色背景变 M3 紫底
- 3.11.7 页面壳误用了 `c-content-background`（Material You 内容底色，深色下带紫调）；
- 改为页面实际使用的 `c-main-background`，暗色主题恢复黑色背景。
- 真机截图确认首页背景为正常黑色。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `9b622a23d34e12619469ba5a5456338eb7b4329cd375d20e2575106b6d7c0043` |
| armeabi-v7a | `08238ed5ce7b1f5b18c3eba48ca36bef006fad22036fe960b121ab93e6baf388` |
| universal | `aad4a3298d2e895ec09aec4bf3357b1d85e1a9aa87124a6a97dbd576f2a42fba` |
