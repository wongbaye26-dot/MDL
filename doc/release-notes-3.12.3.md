# EmoMusic v3.12.3 修复说明

> 版本 **3.12.3** / versionCode **266**

## 设置权限/日志页文字截断
- `ValueRow` 值区域宽度按字符数进一步放宽（`length*9+24`，上限 240），支持 2 行；
- 修复「系统与权限」权限/后台与通知的「已开启/已允许/去设置/打开」显示不全；
- 修复「缓存、日志与关于」查看错误日志右侧「打开」显示不全。

## 验证
- 真机截图确认两页值完整；typecheck 0 / lint 0；assembleRelease 成功。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `29996d938c92ed8ff8a78f49718feb7870ac5e083f6c998538c871e460f8e2e9` |
| armeabi-v7a | `4b21b49909fbfe41a62ae4bbde7ca65431c426ff85df3688de30b1cf40ad757a` |
| universal | `19e17b152ee457479e00dc6e80a81e6f5ec218d299d2e232f3b125cca4c27d4f` |
