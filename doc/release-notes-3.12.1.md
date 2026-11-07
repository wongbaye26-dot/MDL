# EmoMusic v3.12.1 修复说明

> 版本 **3.12.1** / versionCode **264**

## 横版首页卡片尺寸
- 横屏时卡片宽度原按“横向视口 42%”计算，导致卡片过大；
- 现改为以屏幕短边为基准（短边 42%），横屏卡片与竖屏尺寸接近；
- 高度仍按宽度的 0.87 计算。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `d7ebb5722ce315bd7464ef5f33a746c1ac8b5ed819bd20e76be9018ca6ff5988` |
| armeabi-v7a | `fb2b2139be93ac6b2881a02f40e7bf1aee260034383c0cb2bfac42ac6be342fa` |
| universal | `83e0e318266dd7708de42535df7c8a9f73c1d1d21d7b1fa9a7ffc92ab7ffe3ed` |
