# EmoMusic v3.12.8 修复说明

> 版本 **3.12.8** / versionCode **271**

## 横屏首页最近播放/添加列宽
- 根因：横屏仍按 2 列布局，每列被拉满约半屏，列间出现大块空白；
- 修复：横屏改为 **4 列**，列宽按内容收窄；竖屏仍保持 2 列。

## 验证
- typecheck 0 / lint 0；assembleRelease 成功。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `5c9f3c485ae730956c78a53491c671245b815d42a49704bcaa8825088d596fb0` |
| armeabi-v7a | `8a37f64fb60eb6f3063c9428cf1e307693f450be2e37f056ce7f63896d537b18` |
| universal | `e9aa575150d7864ae0569fb6ff6efa5315786d27470ee5ca2ae21293c4883f97` |
