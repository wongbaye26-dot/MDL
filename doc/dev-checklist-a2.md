# A-2 曲库存储与身份迁移 · 开发清单

- 依据：`doc/adr-0002-local-library-storage.md`、`doc/progress-3.9-4.0.md` §3.4
- 原则：**先 PoC 再迁移；旧 JSON 全程保留；双写→校验→切读→清理；任何阶段可回滚。**
- 门禁：每项跑 `typecheck` + `lint` + `test:unit`；真机不可用项标 NOT RUN。

| ID | 任务 | 产出 | 状态 |
|---|---|---|---|
| A2-01 | 存储选型 ADR + schema + 迁移/回滚方案 | `doc/adr-0002-local-library-storage.md` | ✅ 2026-11-07 |
| A2-02 | SQLite PoC：RN 0.73/Hermes 构建、10k 插入/查询/事务基准、license 登记 | ✅ `react-native-sqlite-2` 3.6.3：整包构建通过；10k 插入 1,141ms / 合计 1,193ms；MIT |
| A2-03 | `LocalLibraryRepository`：schema 建表、CRUD、事务、WAL、错误处理 | ✅ tracks/playlists/scan_roots/recycle/meta 建表、upsert/get/count、事务封装；playlist CRUD 待 A2-04；10k 基准真机通过 | ✅ |
| A2-04 | 双写影子表：旧 JSON 写路径同步写 DB；差异对比日志 | shadow writer + 对比脚本 | ⏳ |
| A2-05 | 迁移 + 回滚演练：备份、10k 扫描入库、checksum、断电恢复 | 迁移脚本 + 回滚演练记录 | ⏳ |
| A2-06 | 身份模型：指纹（首尾采样+size+duration）、MediaStore id、legacy 映射、懒迁移 | `identity.ts` + 单测 | ⏳ |
| A2-07 | 三路扫描统一：MediaStore/SAF/直读目录 → repository；增量/失权/重复 | scan service + 回归 | ⏳ |
| A2-08 | CUE 解析 + 样本 | `cue.ts` + 样本/单测 | ⏳ |
| A2-09 | CUE 分段播放链路（虚拟 track、seek 偏移） | player 接入 + 真机 | ⏳ |
| A2-10 | 全量回归 + v3.10.0 发版（扫描/排序/播放/队列/M3U/歌词/回收） | release notes + tag | ⏳ |

## A2-02 开工前置（硬条件）

1. 验证 `op-sqlite` 在 RN 0.73.11 / Hermes / minSdk 21 / arm64 / targetSdk 36 可构建运行；不通过则评估 `react-native-sqlite-storage`。
2. 解决 vendor `prepare: bob build` 阻断 `npm install` 的问题（本地 aar 或 patch + `--ignore-scripts` 方案）。
3. 10k 基准脚本可重复：插入、按 album/artist 查询、事务批量、冷启动打开时间。
4. 记录 SQLite 版本/许可到 `doc/third-party-licenses` 或 README。

## 迁移验收（A2-05）

- 旧 JSON 备份 checksum 一致；
- 10k 迁移 < 30s、内存增量 < 80MB；
- 收藏/用户歌单/隐藏/回收/队列引用零丢失；
- 中途杀进程后重启可继续/回滚；
- 关闭 flag 回旧 JSON 后功能全部可用。
