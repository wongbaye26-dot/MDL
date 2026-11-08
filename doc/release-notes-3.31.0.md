# EmoMusic v3.31.0 发行说明（审计修复第四批）

> 版本 **3.31.0** / versionCode **321**

## 关键数据一致性修复
- 发现 `tracks` 表新增 `language/year/genre` 三列后，`upsertTracks` 的 values 仍只有 24 个参数，列/值数量不匹配，SQLite 双写整批失败（之前只记 warn）。
- 已补齐 `language/year/genre` 参数；
- 增加运行时断言：列数与值数不一致直接抛错并定位，不再静默。
- 说明：默认读源仍是 JSON；此修复保证影子 DB 与数据库自检/备份链路可用。

## 依赖升级尝试
- `npm audit fix` 因 vendor 包 `bob build` 缺失中断，未改动 lockfile；依赖漏洞治理延后到独立升级窗口，避免功能版本混入构建风险。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `53dec3fbf975a8b4a584311f310a004c9c97b6e6efb97d36292e2da6b3963cc7` |
| armeabi-v7a | `ed56c5349fd72ca74298fb45013a46e6b44a62fc828b2a5e057d32275986ce9f` |
| universal | `04276eff17fcb2f3d37bbbb13afe231503e15b56b5c239837a5ea7d8b5525ed3` |
