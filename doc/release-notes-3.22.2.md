# EmoMusic v3.22.2 修复说明

> 版本 **3.22.2** / versionCode **299**

## 刮削直接崩溃
- 日志：`FATAL EXCEPTION ... Could not invoke RNFSManager.readFile`
- 根因：对 SAF/content:// 条目强行用纯 JS 读 FLAC 文件，真实路径不可读导致原生崩溃；
- 修复：
  - 只在写入目标包含真实路径、且 `existsFile` 校验通过时才补写 FLAC 扩展标签；
  - SAF 条目跳过纯 JS 扩展写入，只回写曲库，不再崩溃。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `eb4f99564edf48719811967329ea527e1ae8192b83bd3e2fbed2aa30a9e168a0` |
| armeabi-v7a | `195de39e52852310a567f891165e237d0cff2e6c0433701f5bae21cebf1c682c` |
| universal | `75e76d809db985cc102e6f55c6fc97685c07ae6ca3c70771fb079c7f68f4a115` |
