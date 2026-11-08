# EmoMusic v3.32.0 发行说明（审计修复第五批）

> 版本 **3.32.0** / versionCode **322**

## 数据层重构与回归测试
- 抽出 `src/core/localLibrary/trackColumns.ts`：
  - `TRACK_COLUMNS` 与 `buildTrackValues()` 成为唯一列/值来源；
  - `upsertTracks` 直接复用，避免以后加列再出现「列 27 / 值 24」。
- 抽出 `src/core/localMusic/tagCompare.ts`：
  - `sameText/tagsMatch` 成为纯函数，供刮削跳过逻辑使用；
  - 不再依赖 RN/文件系统，可直接单测。

## 测试
- 新增 `tests/db-row.test.js`：列数与值数一致、language/year/genre 映射正确；
- 新增 `tests/tag-compare.test.js`：标签相等/不等/读不到/空白归一化；
- 单元测试 24 → **30**，全部通过。

## 门禁
- typecheck 0 / lint 0 / test 30/30 / assembleRelease 成功；
- 真机安装 3.32.0 并启动正常。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `0b9433c49da83bee16608410cd5719f745974337466365a50120529d372926f7` |
| armeabi-v7a | `7108b0167f63947b55eefc110128bf31d0e0cf45295f798864fda98a9e4ebd99` |
| universal | `ed2755ba4dec8a4df7b26aaf6de0f2065f4649aa209ba89dce755c7973aa8fb6` |
