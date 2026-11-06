# 本地音乐管理与播放 2.0 · 实施记录

- 需求：`doc/requirements-local-library-playback-2.0.md`
- 清单：`doc/dev-checklist-local-library-2.0.md`
- 状态：W1～W5 全部代码完成；真机可复现项已验，依赖手动选文件/听感/杀进程的项标 NOT RUN。

## 交付清单

| ID | 交付 | 主要文件 | 验证 |
|---|---|---|---|
| D-01 | 派生索引层（专辑/艺人/文件夹/最近/封面聚合，持久化） | `core/localMusic/libraryIndex.ts` | 代码；真机网格封面通过 |
| D-02 | 索引接入本地音乐页（分组封面/详情按 songIds） | `LocalMusic/index.tsx` | 真机专辑网格通过 |
| D-03 | 增量扫描（path+mtime+size 复用，新增/更新/删除/失败统计） | `core/localMusic/index.ts`、`libraryIndex.ts` | 代码；扫描报告 UI 已接 |
| D-04 | 扫描报告 + 失权/失败 banner + 面板摘要 | `LocalMusic/index.tsx` | 代码；入口可见 |
| D-05 | 排序（6 键、升降序、按 tab 记忆） | `core/localMusic/viewPrefs.ts`、`LocalMusic/index.tsx` | 真机排序面板通过 |
| D-06 | 筛选（格式/封面） | 同上 | 代码；入口可见 |
| D-07 | 搜索扩展（文件名/路径/拼音首字母） | `LocalMusic/index.tsx` | 代码 |
| D-08 | 专辑/艺人 3 列网格 | `LocalMusic/index.tsx` | 真机通过 |
| D-09 | 重复歌曲（既有 duplicates.ts：同名+歌手分组、只移除记录） | `Setting/settings/Tools/duplicates.ts` | 真机体检显示重复 3 |
| D-10 | 缺失文件（既有 invalid.ts） | `Setting/settings/Tools/invalid.ts` | 真机无效 0 |
| D-11 | 隐藏歌曲/文件夹 + 恢复入口 | `core/localMusic/hidden.ts`、`LocalMusic/index.tsx`、`Tools/HiddenSection.tsx` | 真机隐藏一首通过 |
| D-12 | 不可解码标记（APE/WMA/DSF/DFF） | `core/localMusic/formats.ts`、`LocalMusic/Row` | 代码；无样本 NOT RUN |
| D-13 | 倍速设置（0.5×～2×） | `Setting/.../PlaybackRate.tsx` | 真机 UI 通过 |
| D-14 | 切歌淡入淡出（0/2/4/6/8/12s） | `core/player/player.ts`、`FadeSeconds.tsx` | 真机 UI 通过；听感 NOT RUN |
| D-15 | 队列/进度持久化 + 丢失文件跳过 + 默认暂停 | `core/init/player/playInfo.ts`、`playProgress.ts` | 代码；杀进程恢复 NOT RUN |
| D-16 | 播放位置恢复 | 同上 | 代码；NOT RUN |
| D-17 | M3U/M3U8 导入导出 | `core/localMusic/m3u.ts`、`LocalMusic/index.tsx` | 入口真机通过；实际选文件 NOT RUN |
| D-18 | 本地歌词：内嵌→同名 .lrc；歌词偏移 | `core/music/local.ts`、`Player/index.tsx`、`LyricOffset.tsx` | 代码；UI/听感 NOT RUN |
| D-19 | 批量管理：队列/歌单/隐藏/移除 | `LocalMusic/index.tsx`（选择模式 + 操作条） | 真机选择 2 首、操作条通过 |
| D-20 | 清单/实施记录/QA/最终门禁 | 本文档 + checklist | 通过 |

## 门禁结果

- `npm run typecheck`：0 error
- `npm run lint`：0 problem
- `npx react-native bundle --platform android --dev true`：成功（多次）
- `./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a`：成功，已真机安装

## NOT RUN / 已知限制

1. 杀进程后的队列/进度恢复、播放位置恢复；
2. 淡入淡出实际听感（爆音、音量恢复）、倍速听感；
3. M3U/M3U8 实际选文件导入、选目录导出；
4. 同名 `.lrc` 实际加载与歌词偏移 UI/听感；
5. 不可解码格式样本（APE/WMA/DSD）；
6. 隐藏内容恢复页（真机入口未走完）、重复清理的收藏/歌单引用迁移（未实现）；
7. 10k 曲库性能压测（P0-04/P0-05 前置未完成）。

## 回滚

- 全部新增存储键带 `_v1`：`local_music_index_v1`、`local_music_scan_report_v1`、`local_music_view_prefs_v1`、`local_music_hidden_v1`、`player.lyricOffsetMs/player.fadeSeconds` 设置项；删除/重置即可回到原行为。
- 未改 `MusicInfoLocal.id`，队列/收藏/歌单引用不受影响。
