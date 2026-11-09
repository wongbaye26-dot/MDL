# 播放器三页交互 + SAF 文件删除修复（2026-11）

## 1. 先做的真机对照（Salt Player `com.salt.music`）

在用户手机上实际安装并操作 Salt Player：

- 主播放器（封面页）**左滑 → 歌词页**；歌词页**右滑 → 封面页**；封面页右滑无额外页面。
- 封面页与歌词页共用同一套背景（模糊封面），切换是整页横向滑动动画。
- 「歌曲信息」不是横向页面，而是菜单里的 **BottomSheet**，字段包括：标题/艺术家/专辑/专辑艺术家/
  媒体来源/播放次数/时长/比特率/采样率/位深/大小/格式…（截图：`/tmp/salt-info2.png`，未入库）。
  用户要求在此基础上多一个「文件来源（本地/在线）」。

## 2. 播放器实现

按 Salt 的操作逻辑改成 **3 页原生 PagerView**（`react-native-pager-view`，左→右）：

1. **歌曲信息页**（新，页 0）
   - 背景：与歌词页相同的模糊封面 + 暗色渐变；
   - 字段沿用播放器 `detailRows`，并新增 **文件来源**：本地文件 / `在线 · 音源`；
   - 不含底部播放控制（和 Salt 信息页一致）。
2. **歌曲页面**（页 1，保持原有封面页）
   - 保留封面、底部信息/进度/控制；
   - 点封面仍可切到歌词页；
   - **移除信息按钮**（`information-outline` 相关入口全部删除，横竖屏都去掉）。
3. **歌词页面**（页 2）
   - 保留原有歌词滚动/逐字/单行/翻译等逻辑；
   - **移除左上角下箭头**（右滑回歌曲页即可；Android 返回键仍可关闭播放器）。

动画：由 PagerView 原生横向滑动，和 Salt 一样整页跟手滑动，不再用 JS 手势模拟；
删除此前的 1/3 信息面板、封面/歌词手势层和相关的 PanResponder/touch 临时实现。

## 3. SAF（content://）文件删除修复

用户反馈：下载到 `content://…tree/primary:Music/EmoMusic/document/…` 的歌曲，在本地音乐删除后重新扫描又出现。

根因：
- 批量「删除到回收站」的 `moveSongToRecycle` 先 `cpFile` 到回收目录，再 `unlink(originalPath)`；
  `unlink` 对 `content://` 文档 uri **静默失败**（不抛错），函数仍按成功处理并删掉曲库记录，原文件还在 → 重新扫描又出现。
- `removeLocalFile` 对 SAF 授权丢失的场景只尝试了 `deleteDocument(realPath)`，没有继续尝试真实路径 unlink/MediaStore。

修复：
- `removeLocalFile` 改为导出，并补全删除退让链：
  `deleteDocument(content uri)` → `deleteDocument(real path)` → `unlink(real path)` →
  `findAudioByPath(realPath)?.contentUri` 再删 → 存在性复核。
- `moveSongToRecycle` 复制成功后调用 `removeLocalFile(item)`，失败则删除回收副本并返回错误，
  不再出现「记录删了、文件还在」。
- 本地音乐批量「更多」新增 **彻底删除文件（不可恢复）**，直接 `deleteLocalMusic(item, true)`，
  与「删除到回收站」并列；适合需要真正删除文件的场景。

## 4. 验证

- `npm run typecheck` / `npm run lint` → 0 error（2 条既有 warning）
- `npm run test:unit` → 32/32
- release arm64 构建成功并安装到 SM-S938B
- 真机验证播放器：信息页 / 歌曲页 / 歌词页三页左右滑动正常，信息页含「文件来源=本地文件」，
  歌曲页信息按钮已消失，歌词页无左上角下箭头（截图 `/tmp/pager-cover.png`、`/tmp/pager-state.png`、`/tmp/pg-lyric.png`）
- **SAF 删除未真机验证**：需要一首 `content://…Music/EmoMusic/…` 的下载歌曲做删除+重扫；
  当前设备曲库文件多为迁移后的 `/storage/emulated/0/Music/EmoMusic/...` 真实路径。
  代码已按 SAF 文档删除链修复，建议用用户提供的 `content://…牡丹…` 文件做一次删除→重扫验证。
- 旧 SAF 下载文件「没有歌词」：下载附加文件写入逻辑使用 `writeTextToSibling`，本次未改动；
  若删除修复后仍缺歌词，下一次单独排查 SAF 目录 `.lrc` 写入返回值。
