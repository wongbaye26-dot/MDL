# EmoMusic v3.12.12 修复说明

> 版本 **3.12.12** / versionCode **275**

## 设置主页最后一行被胶囊栏遮挡
- 设置主页 ScrollView 的 `paddingBottom` 从 0 改为 `NAV_BAR_SPACE`；
- 大字号下可滚到「缓存、日志与关于」，最后一行完整显示在胶囊任务栏上方。
- 真机 130% 字体截图确认。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `ab022c13a96827c07fac477cf7faf7442eb9b5b5d7fb13f5953b9af45ba91fb0` |
| armeabi-v7a | `651ce57c7d66ca72975f7b638b3aa4810d505218522a0b2d3cf6633c3a1d7728` |
| universal | `507847c661bb089b39607b50e944df874500d8866a56a00d3e8ca5b69e099192` |
