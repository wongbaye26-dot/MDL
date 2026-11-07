# EmoMusic v3.11.9 发行说明

> 版本 **3.11.9** / versionCode **257**

## 首次切页闪烁修复
- 首次激活页面不再播 opacity 0→1 / 位移 / 缩放动画；
- 首帧直接按最终状态显示，避免“挂载 + 淡入”叠加造成的一下闪；
- 页面壳保留 `c-main-background` 底色，暗色主题仍为黑色。

## 验证
- 真机冷启动后点下载/本地，0.15s 内出现完整内容；
- typecheck 0 / lint 0；assembleRelease 成功。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `619f835d83cefae884eb4bec5170255dac5ae32cbfc563e57c28a243b9564a50` |
| armeabi-v7a | `bb9e6ecda35b6f1549815084e1f0c3ef2fc19a060b3ac4e7639cdae2a54d37d9` |
| universal | `5c142c993930f3ef89aa50b3e2353a28979e5fa47b8070b19e13e731a8e20324` |
