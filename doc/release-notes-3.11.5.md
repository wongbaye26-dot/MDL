# EmoMusic v3.11.5 发行说明

> 版本 **3.11.5** / versionCode **253**

## 冷启动首次切页闪烁修复
- 根因：主 tab 页面首次访问才挂载，第一次切页把「页面挂载 + 淡入动画」叠在一起，出现闪一下/不丝滑；
- 修复：首页首屏后空闲时分批预挂载其余页面（500ms 起、每 300ms 一个），隐藏但保持挂载；
- 首次切页只切显隐，不再同时挂载，动画和页面内容都就绪。

## 验证
- 冷启动后依次点下载/本地/我的，0.25s 内页面已有完整内容；
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `bea711dbf102bf15627398dcaa9a57052ebfea2f850e9fcf6ec64f0d48feeb14` |
| armeabi-v7a | `2d8dbc9a439b44299ee4ebe1349144335ab0ec2454ea69cbfadac56289cb7577` |
| universal | `1efff6a8262af933a6b29f50c6da344996addd49adc899b8d1f0716f31b4cafd` |
