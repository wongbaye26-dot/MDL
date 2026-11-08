# EmoMusic v3.29.0 发行说明（审计修复第二批）

> 版本 **3.29.0** / versionCode **319**

## 可观测性
- 新增 Babel 插件 `scripts/babel-plugin-strip-console.js`：release 构建移除 `console.log/debug/info`，保留 `warn/error`；
- 刮削单曲失败改为 `log.warn` 记录歌名/错误，不再静默吞掉；
- FLAC 扩展标签写入失败记录具体路径与错误。

## 性能/存储
- 批量刮削写文件增加并发闸门：网络仍 6 路并发，磁盘同时最多 2 个写入，降低 I/O 抖动。

## 清理
- 修复 Player `useMemo` 依赖 warning，lint 归零（0 error / 0 warning）。

## 门禁
- typecheck 0 / lint 0 / test 24/24 / assembleRelease 成功；
- 真机安装 3.29.0 并启动正常。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `4e3b70082be5fe79cea76398dd38a21ec8cd117214fd7da80e953dd8451e1e02` |
| armeabi-v7a | `f9df3d64966cf76d31f4f4c462e3234742e5d23328e8af5a82c943648f74fd82` |
| universal | `033692c864fdc682afa4af5eff69e5add9d32761f6767e19c5b9914c46b07d0b` |
