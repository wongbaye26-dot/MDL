# EmoMusic v3.23.1 修复说明

> 版本 **3.23.1** / versionCode **304**

## 本地列表仍显示文件名
- 增加启动迁移：加载曲库时自动去掉歌名里的扩展名和「 - 歌手」后缀，并保存；
- 扫描/刮削写入前同样清洗，避免再次写坏 TITLE。

## 刮削速度
- 并发从 4 路提到 6 路；
- 歌词超时 8s → 2.5s。

## 语言
- 默认中文标签为「普通话」。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `da0dc4f25a05818f2367d1a807e44877741ebc2bce2efef05a3efe0bf5c7c4d5` |
| armeabi-v7a | `36a3684ff266f80b50e9f27f8e886198c94fc4bd4d9e5e06d2af0cc38604e502` |
| universal | `37d5bdcd013dbb3582df197e6a6b21369768df590f65149ce96b98a364d532c6` |
