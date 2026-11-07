# v3.10.20 发布说明

> 版本 **3.10.20** / versionCode **240**

## 本地 tab 跟手度（进一步）
- 不再在切 tab 时重建 rows；
- 列表加载/筛选变化时**一次性预计算 5 个 tab 的 rows** 并缓存；
- 切 tab 直接取缓存，页签高亮 + 列表数据都无需同步构建；
- 搜索/专辑详情/文件夹详情仍按需构建。

## 收藏页 UI 重排
- 歌单从 2 列大网格改为**横向列表卡片**：
  - 52dp 封面 + 歌单名 + 数量；
  - 右侧删除按钮 + chevron；
  - 与本地曲库/设置列表同一套圆角卡片语言；
- 保留长按删除、空状态虚线卡片。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.10.20-arm64-v8a.apk | `a6e789925c191fab216465d919b2585471b03a2a454efa3941a5690b0f9becf7` |
| universal | em-music-v3.10.20-universal.apk | `7629d6e173d1a88f91c6011df52566df68821735404e056ace7be5b43ac39d66` |
