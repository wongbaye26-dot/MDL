# EmoMusic v3.38.0 发行说明（审计修复第十批）

> 版本 **3.38.0** / versionCode **328**

## 依赖升级结论：回滚
- 尝试升级依赖后 npm audit 从 18 降到 13（1 critical / 5 high），但引入了嵌套 `react-native@0.86.3`，导致：
  - `@types/react` 19 与 RN 0.73 类型冲突；
  - Metro 解析异常。
- 已回滚 package.json / package-lock 到升级前基线，保留全部功能修复；依赖治理继续等独立窗口。

## Vendor 安装修复
- `setup-vendor` 会为 vendor 包链接根项目 `node_modules`，让 `track-player` 的 prepare 能找到 rimraf/tsc/react-native 类型；
- 使用 `npm install --install-links` 把 `file:` 依赖物化为真实目录，避免 Metro 不跟随符号链接导致模块解析失败。

## 门禁
- typecheck 0 / lint 0 / test 32/32 / assembleRelease + verify:release 通过；
- 真机安装 3.38.0 并启动正常。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `62559a1f3d6ccb4db3da334f9f83c30f06fef5777afdf4e423799d2472f1111c` |
| armeabi-v7a | `473a0c1963bf9dc50ba18b69bd4d1c064ae65a2353b48c11f800cc08fd315f79` |
| universal | `ce66b9e561f4cdd3e1cdcd8ce42447913a569d8cf6dd98ed8ddf2f7b99542b10` |
