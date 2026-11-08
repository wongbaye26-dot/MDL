# EmoMusic v3.22.5 修复说明

> 版本 **3.22.5** / versionCode **302**

## 刮削后信息不显示 / 播放 10 秒才起播
真机日志：
```
PlaybackError: java.io.FileNotFoundException: No item at content://media/external/audio/media/6391
```
根因：
- FLAC 扩展标签写入是「临时文件替换原文件」；
- MediaStore 里的旧 media id 随文件替换失效，曲库还存着旧 `contentUri` → 播放器重试约 10 秒后报错切歌；
- 扫描重建条目时又无法从原生标签读到语言/年份/风格，导致信息消失。

修复：
1. 写文件后调用 MediaScanner，并轮询 `findAudioByPath` 拿新 `contentUri` 回写曲库；
2. 播放本地歌曲前**先按路径重新反查最新 contentUri**，旧 id 不再使用；
3. 扫描 FLAC 时直接解析文件头 `LANGUAGE/DATE/GENRE`，即使曲库字段丢失也能恢复；
4. 扫描重建条目继承旧字段。

## 仍待处理
- 「刮削后台运行」尚未实现：JS 批量任务切到后台/锁屏后会被系统挂起，需要接入前台服务或原生任务。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `03266777b186fc84e4477ce911d341ee276117c0ce29d0f4b809e078b8edb42f` |
| armeabi-v7a | `2c7f3f2934fb16469f43f5547fa2f249357b9201fbe417b639803c73a49ce22f` |
| universal | `9fb1dfbbb15d4510fe701f52cab1fe740be426456581da954eb7f1af64bfef99` |
