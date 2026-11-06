# v3.9.17 发布说明

> 版本 **3.9.17** / versionCode **208**

## 音质矩阵
- 改用新 `Group` 卡片 + 胶囊列表：
  - 音源名 + 最高音质实心标签；
  - 每档音质 tonal 胶囊，最高档实心主色；
  - 不再使用旧 `Chip` 组件。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.9.17-arm64-v8a.apk | `659be0ee70aa0806bdcc8e731bd36da9d49e3dcf508fab11396511ae25a87dc5` |
| universal | em-music-v3.9.17-universal.apk | `087893b7e274dcd86b350c00f160e4087e494268d61fdbbae8b9e67358af94bb` |
