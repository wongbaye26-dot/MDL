# v3.9.27 发布说明

> 版本 **3.9.27** / versionCode **218**

## 严重修复
`saveLocalMusicList` 内部误调用自身（`await saveLocalMusicList(list)`），导致：
- 本地曲库任何写盘（扫描保存、删除、加歌、回收站移入）都会 `Maximum call stack size exceeded`；
- 回收站自检在「移入回收站」一步失败即暴露该 bug。

修复：改为 `await saveData(STORAGE_KEY, list)`，再异步影子同步。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功；
- 待真机复跑回收站自检（含清空）。

## 真机结果（2026-11-07）
回收站自检（含清空）通过：
创建临时文件 → 移入回收站 → 校验原文件已移除/回收文件存在 → 恢复原路径 → 索引清理 → 二次移入回收站 → 清空回收站（删除 2 条）→ 清空校验通过。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.9.27-arm64-v8a.apk | `c26aeba1f2d25dff20d733b9f3755b3cb3fc4e3f0ee74104d4e209fb3de0c722` |
| universal | em-music-v3.9.27-universal.apk | `57c7cb1b2df02ef8ce86fe7149cb94d1d105904274313282f7a34727382e88f6` |
