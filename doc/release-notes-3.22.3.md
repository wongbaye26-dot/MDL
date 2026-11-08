# EmoMusic v3.22.3 修复说明

> 版本 **3.22.3** / versionCode **300**

## 刮削崩溃（OOM）
- 真机日志根因：`OutOfMemoryError: Failed to allocate a 49427976 byte allocation ... RNFSManager.readFile`
- 原实现把整首 FLAC 以 base64 读进内存再重写，36MB 的 FLAC 需要约 49MB 字符串，直接 OOM 闪退；
- 修复为**流式写入**：
  - 只读 FLAC 头部（4MB 起按需递增），解析 metadata blocks；
  - 新 metadata 区单独组装写出；
  - 音频帧按 4MB 分块读取并追加，内存占用恒定；
  - 备份/替换逻辑保留，失败可回滚。
- 同时 `readFlacTags` 本来只读头部，不受影响。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `8ee2ab44146555c8a7e6fa3553526da9b0d98f883f9cbed6dcc9ce9ea1b85a07` |
| armeabi-v7a | `129c85644094847aefbe0b8aa9ab290bfaf5f287df6a67480a0c94d2ffef13b9` |
| universal | `441277ddbd0c4b95a986bb6a88a23622ed76371c29a14e84a6e4ae074c7fa9fc` |
