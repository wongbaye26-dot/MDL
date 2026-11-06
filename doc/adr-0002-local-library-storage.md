# ADR-0002：本地曲库存储选型与迁移（A-2-01）

- 状态：**Proposed**（待 A2-02 PoC 验证后转 Accepted）
- 日期：2026-11-07
- 关联：`doc/requirements-local-library-playback-2.0.md`、`doc/progress-3.9-4.0.md` §3.4、`doc/dev-checklist-local-library-2.0.md`

## 1. 背景

当前本地曲库全部存在 AsyncStorage 的 JSON 里：

| Key | 内容 | 写入频率 |
|---|---|---|
| `local_music_list` | 全部本地歌曲 `MusicInfoLocal[]` | 扫描/删歌/编辑标签时整体重写 |
| `local_music_index_v1` | 2.0 派生索引（专辑/艺人/文件夹/封面） | 列表变化后 2s 防抖重建 |
| `local_music_dirs` | 扫描根目录 | 低频 |
| `local_music_scan_report_v1` | 最近扫描报告 | 每次扫描 |
| `local_music_view_prefs_v1` | 排序/筛选 | 低频 |
| `local_music_hidden_v1` | 隐藏歌曲/文件夹 | 低频 |
| `local_music_recycle_v1` | 回收站索引（文件在私有目录） | 删文件时 |
| `play_info` / 列表 JSON | 队列、收藏、用户歌单、试听列表 | 播放/收藏/列表操作 |

问题：

1. **整体重写**：10k 曲库每次扫描/编辑都序列化整份数组，主线程 JSON 解析与 IO 抖动明显。
2. **查询能力弱**：重复、缺失、标签筛选都要全量 reduce；2.0 用派生索引缓解，但仍无法增量更新单条索引。
3. **身份不稳定**：主键是 `local_${filePath}`，移动文件/换挂载点会丢引用；A-2 要求指纹/媒体 ID。
4. **多写者冲突**：扫描、标签写入、批量任务、回收站同时改 JSON 时只能整份覆盖，缺少事务。
5. **CUE/分段/多艺术家**：JSON 平面结构难以表达 track↔artist、cuesheet、segment。

## 2. 决策

**引入 SQLite 作为「本地曲库 + 用户列表」的唯一事实源（single source of truth），JSON 降级为迁移期影子/兼容层。**

- 引擎：优先 **op-sqlite（JSI）**；若 RN 0.73/Hermes 构建不通过，回退 `react-native-sqlite-storage`。
- 访问层：`LocalLibraryRepository`（纯数据访问）+ `LocalLibraryService`（业务：扫描/去重/播放列表），UI 不直接拼 SQL。
- 迁移期：**双写（DB 主 + 旧 JSON 影子）**，读默认仍走旧 JSON；通过 feature flag 切读，保留一键回滚。
- 派生索引 `libraryIndex` 改为从 DB 查询/增量构建，不再持久化全量 JSON 索引（可保留 1 个版本做回滚缓存）。

### 2.1 候选评估

| 方案 | 优点 | 风险 | 结论 |
|---|---|---|---|
| **op-sqlite** | JSI、同步/异步 API、性能好、MIT、活跃 | 需验证 RN 0.73.11 / Hermes / minSdk 21 / arm64 构建；新架构偏好未知 | **首选，PoC 验证** |
| react-native-sqlite-storage | 老牌、API 简单、纯 bridge | 维护活跃度低、性能弱、事务/线程一般 | 回退 |
| expo-sqlite | API 完整、维护好 | bare RN 引入 expo-modules-core，包体/构建面变大 | 不选 |
| Realm / WatermelonDB | 对象模型强、响应式 | 包体大、迁移复杂、许可/学习成本 | 不选 |
| 继续 JSON + 派生索引 | 零迁移 | 无法满足 A-2 事务/身份/CUE | 仅作为回滚路径 |

### 2.2 必须满足的硬约束

- RN **0.73.11**、Hermes、Android 16 target（targetSdk 36）、minSdk 21、arm64-v8a；
- 不要求开启 New Architecture；若必须开启，先单独 ADR 评估；
- 数据库文件位于应用私有目录，不进入备份/云同步；
- 单条写入 < 10ms（中端机），10k 首全量迁移 < 30s，峰值内存增量 < 80MB；
- 迁移中断可恢复：事务 + `migration_state` 表 + 旧 JSON 保留；
- 回滚：关闭 flag 即回旧 JSON，不需要重装。

## 3. 目标 schema（v1）

```sql
-- 元信息 / 迁移
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE migration_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  phase TEXT NOT NULL,          -- idle|backup|copy|verify|switch|done|failed
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  error TEXT,
  old_count INTEGER,
  new_count INTEGER,
  checksum TEXT
);

-- 曲目（本地；在线/下载曲目仍走现有列表 JSON）
CREATE TABLE tracks (
  id TEXT PRIMARY KEY,              -- 新稳定 id：fp:<fingerprint> 或 media:<mediaId>
  legacy_id TEXT UNIQUE,            -- 旧 local_<path>，迁移/回滚用
  fingerprint TEXT,                 -- 首尾采样 hash + size + duration
  media_id TEXT,                    -- MediaStore _id（可空）
  path TEXT NOT NULL,
  content_uri TEXT,
  title TEXT NOT NULL,
  album_name TEXT,
  album_artist TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  format TEXT,
  bitrate INTEGER,
  sample_rate INTEGER,
  channels INTEGER,
  size INTEGER,
  mtime INTEGER,
  added_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  cover_key TEXT,
  source TEXT NOT NULL DEFAULT 'local',
  is_hidden INTEGER NOT NULL DEFAULT 0,
  is_missing INTEGER NOT NULL DEFAULT 0,
  cue_path TEXT,
  cue_track INTEGER
);
CREATE INDEX idx_tracks_path ON tracks(path);
CREATE INDEX idx_tracks_fp ON tracks(fingerprint);
CREATE INDEX idx_tracks_album ON tracks(album_name, album_artist);
CREATE INDEX idx_tracks_updated ON tracks(updated_at);

CREATE TABLE artists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_key TEXT NOT NULL,
  UNIQUE(name, sort_key)
);
CREATE TABLE track_artists (
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'main',   -- main|feat|album
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(track_id, artist_id, role)
);

CREATE TABLE folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES folders(id)
);

-- 用户列表（收藏/默认/用户歌单/试听）
CREATE TABLE playlists (
  id TEXT PRIMARY KEY,               -- love/default/temp/userlist_xxx
  type TEXT NOT NULL,                -- love|default|temp|user
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);
CREATE TABLE playlist_tracks (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY(playlist_id, track_id),
  UNIQUE(playlist_id, position)
);
CREATE INDEX idx_playlist_tracks_track ON playlist_tracks(track_id);

-- 扫描根目录 / 报告
CREATE TABLE scan_roots (
  path TEXT PRIMARY KEY,
  tree_uri TEXT,
  last_scan_at INTEGER,
  need_auth INTEGER NOT NULL DEFAULT 0
);

-- 回收站（文件仍放私有目录，这里存索引）
CREATE TABLE recycle (
  id TEXT PRIMARY KEY,
  name TEXT,
  singer TEXT,
  original_path TEXT NOT NULL,
  recycle_path TEXT NOT NULL,
  size INTEGER,
  deleted_at INTEGER NOT NULL
);
```

说明：

- **不把封面二进制放 DB**：`cover_key` 指向现有缓存文件/内嵌图路径；避免 DB 膨胀。
- `tracks.id` 迁移策略：优先 `fp:<fingerprint>`；无法算指纹（content:// 不可读）回退 `media:<MediaStore id>`；再失败 `legacy:<旧 id>`，并标记 `needs_identity=1` 待后续归并。
- 播放队列不单独建表：`player_queue` 继续存 `play_info`，但引用新 track id；迁移时通过 `legacy_id` 映射。
- 视图偏好/隐藏可先保持 KV；隐藏最终改为 `tracks.is_hidden`，隐藏文件夹用 `folders` + `hidden_folders` 表（v2）。

## 4. 迁移方案

### 阶段（与 A2-02～A2-06 对应）

| 阶段 | 动作 | 门禁 |
|---|---|---|
| M0 PoC | 装 SQLite、建空库、10k 插入/查询/事务基准 | RN 0.73 真机可跑；单条 <10ms；10k <30s |
| M1 备份 | 把旧 JSON 全量复制到 `local_library_backup_v1`（含列表/收藏/隐藏/回收/扫描目录） | 备份 checksum 校验通过 |
| M2 复制 | 事务内建 tracks/artists/albums/playlists/playlist_tracks；写入 `legacy_id` 映射 | new_count == old_count；抽查 100 条字段一致 |
| M3 校验 | 计算数量/专辑/艺人/收藏/歌单引用差异；只允许「已知归一化合并」 | 差异报告人工确认 |
| M4 双写 | 读旧 JSON；所有写操作同时写 DB（影子）；对比读一致性 | 双写 2 个版本周期无差异日志 |
| M5 切读 | flag 打开，读 DB；旧 JSON 冻结只写不改 | 真机回归：扫描/排序/播放/收藏/歌单/隐藏/回收 |
| M6 清理 | 删除旧 JSON 与影子（保留备份 N 版本） | 回滚窗口结束、无 P0 |

### 回滚

- 任何阶段失败：`migration_state.phase=failed`，应用继续用旧 JSON；
- M4/M5 回滚：关 flag → 读旧 JSON；删除/重建 DB（旧数据未删）；
- 迁移前备份 `local_library_backup_v1` 保留至少 3 个版本；
- 回滚验收：冷启动/扫描/播放/收藏/用户歌单/隐藏/回收全部可用，且 id 映射可逆。

### 身份迁移兼容

- 旧 id 出现在：`play_info`、收藏/用户歌单 JSON、`playedList`/`tempPlayList`、最近播放、回收站、隐藏、播放历史统计。
- 迁移脚本统一处理：
  - 读所有引用 → 通过 `legacy_id` 映射到新 id；
  - 写入新引用；
  - **旧 JSON 同时保留旧 id**（双写期），避免回滚后找不到；
  - 新写入统一新 id；旧 id 只读兼容 1 个版本。
- `Player` 播放时遇到的旧 id：`resolveTrack(id)` 先查新 id，再查 `legacy_id`，懒迁移引用。

## 5. 风险与缓解

| 风险 | 缓解 |
|---|---|
| SQLite 原生依赖构建失败（vendor prepare 已阻塞 npm install） | A2-02 先做「不跑 prepare 的依赖安装/本地 aar」PoC；失败回退 react-native-sqlite-storage |
| 迁移中断/断电 | 事务 + migration_state + 旧 JSON 不动；启动检测 phase 继续/回滚 |
| 指纹计算慢（10k 文件读首尾） | 增量指纹缓存；只对新文件/变化文件算；后台低优先级 |
| content:// 无法读指纹 | 回退 MediaStore id/旧 id，标 needs_identity |
| 播放队列引用断裂 | legacy_id 映射 + resolveTrack 懒迁移 + 双写期回归 |
| DB 损坏 | WAL + 每日备份到私有目录；损坏时回旧 JSON |
| 包体/内存 | 仅本地曲库进 DB；封面/歌词仍文件缓存 |

## 6. 开放问题（A2-02 前必须回答）

1. op-sqlite 在 RN 0.73.11 + Hermes 的构建/运行验证；是否必须新架构？
2. 数据库加密需求？（当前无；若上锁屏隐私需 SQLCipher，成本另算）
3. 10k 指纹计算的真机耗时与电量；
4. 下载/在线列表是否同步迁 DB（本 ADR 先只迁本地曲库与用户列表引用）。

## 7. 验收标准（A-2 完成）

- 迁移 10k 首成功率 100%，耗时 < 30s，内存增量 < 80MB；
- 收藏/用户歌单/隐藏/回收/队列引用零丢失（对照备份 checksum）；
- 移动/重命名文件后基于指纹重新识别，不产生重复条目；
- 回滚演练一次通过；
- 真机回归：扫描、增量、排序筛选、专辑艺人网格、播放、队列恢复、M3U、歌词、回收站。

---

**Decision owner**：Lead；**Reviewers**：Android/性能；**PoC 结果回填本 ADR 后转 Accepted。**

## 8. A2-02 PoC 结果（2026-11-07）

### 结论：采用 `react-native-sqlite-2` 3.6.3 作为 A-2 PoC 引擎

| 候选 | 结果 | 证据 |
|---|---|---|
| `@op-engineering/op-sqlite` 19.0.5 | ❌ 构建失败 | CMake: `Target "op-sqlite" links to target "ReactAndroid::reactnative" but the target was not found`；RN 0.73 旧架构（`newArchEnabled=false`）不提供该 prefab target；需新架构/更新 RN |
| `react-native-sqlite-2` 3.6.3 | ✅ 模块与整包构建通过 | 需两处 AGP8 补丁：`namespace "dog.craftz.sqlite_2"`、删除 AndroidManifest 的 `package` 属性；补丁已加入 `dependencies-patch.js`；`assembleRelease` 成功 |
| `react-native-nitro-sqlite` 10.2.0 | ❌ 不适用 | peer 要求 RN >=0.75、nitro-modules |
| `react-native-sqlite-storage` 6.0.1 | ❌ 高风险 | 旧 AGP/无 namespace、维护停滞 |

### 现状与边界

- 依赖已写入 `package.json` 与 `package-lock.json`（`react-native-sqlite-2@3.6.3`）；
- 补丁随 `npm install` 的 `postinstall`（`dependencies-patch.js`）应用；
- **运行期基准尚未做**：打开 DB、建表、10k 插入/查询/事务耗时与内存，属 A2-03 门禁；
- JS API 为 WebSQL 兼容（`openDatabase` / `transaction` / `executeSql`），不引入新架构依赖。

### A2-03 开始前

- 若运行期基准不达标（单条 >10ms、10k >30s），退回「JSON + 派生索引」或重新评估新架构；
- 在 repository 层封装 Promise API，禁止业务代码直接用 WebSQL 回调。
