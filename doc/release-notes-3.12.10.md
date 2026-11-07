# EmoMusic v3.12.10 修复说明

> 版本 **3.12.10** / versionCode **273**

## 播放器歌名/歌词上下剃头
- 3.12.9 只修了歌词正文行高；播放器页头歌名、歌手、封面态当前歌词、底部歌名仍是固定 lineHeight（20/16/22/20）；
- 字体放大后这些固定行高小于实际字高，导致上下被裁；
- 本次移除这些固定 lineHeight，改为跟随 Text 实际字号自动行高；封面态歌词增加少量上下 padding。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `cf05d98ca12b0952ddcb749f6a517290c7ac729269417953800eb4e77117b9cb` |
| armeabi-v7a | `b157a931411ab2b8b94e7ef48356adc947cb0364a12331a4cfd9650e524c41fb` |
| universal | `2957b35c8fc7f8741025ae1a5035699c89ad82d8bb5b02c46aba36a5be2c27ab` |
