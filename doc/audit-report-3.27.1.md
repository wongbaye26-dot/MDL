# EmoMusic 代码审计报告

- **审计版本**：3.27.1（versionCode 317）
- **审计日期**：2026-11-08
- **代码基线**：`5c2e1927 fix: 粤语歌手兜底识别（v3.27.1）`
- **审计范围**：`src/` 全部 TS/TSX/JS、`android/` 清单与签名配置、构建/测试脚本、依赖清单
- **方法**：静态检查（typecheck/lint/unit/npm audit）+ 高风险模块人工走查 + 发布产物抽查
- **限制**：未做真机长时间压力测试、未做第三方源接口 fuzz、未做动态安全扫描

---

## 1. 结论摘要

| 项目 | 结果 |
|---|---|
| TypeScript 类型检查 | 通过（0 error） |
| ESLint | 通过（0 error，1 warning） |
| 单元测试 | 19/19 通过（3 个测试文件） |
| 生产依赖漏洞 | 2 critical / 9 high / 7 low（主要是构建链，不随 APK 分发） |
| 发布签名 | release 使用自定义 keystore（但配置有重复赋值隐患） |
| 最高风险 | 曲库 JSON / SQLite 双写分叉；FLAC 全文件重写；刮削网络无取消/无重试策略 |

**总体评价：功能迭代速度快，但数据层与批处理任务的技术债已经影响正确性和可维护性。建议先修 P0/P1 再继续加功能。**

---

## 2. 项目规模

| 指标 | 数值 |
|---|---|
| `src/` 源文件 | 652 |
| TS/TSX 总行数 | 76,380 |
| 超过 800 行的文件 | 7 |
| 最大文件 | `theme/themes.ts` 4540 行、`LocalMusic/index.tsx` 2854 行、`Player/index.tsx` 2212 行 |
| `console.log` | 435 处 / 132 个文件 |
| 空 `catch {}` | 46 处 |
| `as any` | 14 处 |
| TODO/FIXME/HACK/ts-expect-error | 27 处 |
| 测试文件 | 3 个（19 用例） |

---

## 3. 发现清单

### P0（高优先级，影响数据正确性）

#### P0-1 曲库双读源分叉，SQLite 读路径被强制禁用
**位置**
- `src/core/localLibrary/readSource.ts:18-22`
- `src/core/localLibrary/shadow.ts`
- `src/core/localLibrary/repository.ts:130+`

**问题**
`getReadSource()` 无论配置如何都返回 `'json'`：
```ts
const value = await getData<ReadSource>(KEY).catch(() => null)
if (value === 'json') return 'json'
return 'json'
```
但项目仍保留 SQLite 影子同步、数据库自检、备份/回滚演练等完整链路。

**影响**
1. JSON 与 SQLite 数据分叉不可见，数据库自检/备份演练结果失去意义；
2. 切换读源、迁移 id、恢复备份等能力实际不可用；
3. 新加的 `language/year/genre` 列只在 DB 写入侧存在，若未来恢复 repository 读源会再次出现“刮削后字段消失”；
4. `setReadSource()` 成为死代码，容易误用。

**建议**
- 短期：明确标注 JSON 为唯一权威源，删除/隔离 DB 读逻辑，或者修复 DB 读写并做一次双读差异校验后再切回；
- 增加启动自检：JSON 与 DB 行数/关键字段差异超过阈值时告警；
- 为 `language/year/genre` 增加 DB 迁移测试。

---

#### P0-2 FLAC 标签写入需要复制整个音频文件
**位置**：`src/utils/flacTag.ts` `writeFlacTags`

**问题**
写 `DATE/GENRE/LANGUAGE` 时：
1. 读 FLAC 头（最大按 4MB 递增）；
2. 写新 metadata 到 `.emo-tmp`；
3. 按 4MB 分块把整段音频复制到临时文件；
4. 原文件备份、临时文件替换。

**影响**
- 批量刮削 247 首约复制 6–7GB 数据，耗时长、闪存写入放大；
- 每次写入都会改变 mtime，触发 MediaStore 重新索引与增量扫描，导致播放 URI 失效（已在 3.22.5 做 URI 刷新缓解，但未消除根因）；
- 断电/进程被杀时依赖 backup 文件恢复，没有 fsync 与启动时残留恢复逻辑。

**建议**
- 刮削前比较文件现有标签，内容无变化就跳过写文件；
- 引入「只更新曲库」模式（本地曲库字段为主，文件标签按需写）；
- 写入前 `fsync`，启动时清理/恢复 `.emo-tmp/.emo-bak`；
- 对批量任务限制并发写入（建议 1–2），避免存储抖动。

---

### P1（高优先级，影响稳定性/安全）

#### P1-1 刮削网络请求没有真正取消，超时只是 Promise.race
**位置**：`src/core/localMusic/scrape.ts`（`withTimeout`、`getTxAlbumMeta*`、`getResultLyric`）、`src/screens/Home/Views/Setting/settings/Tools/tagScrape.ts`

**问题**
- `withTimeout()` 超时后不会调用 `httpFetch` 的 `cancelHttp()`，底层请求继续占用；
- 6 路并发 + 每首最多 3 个请求（搜索、歌词、QQ 专辑），停止任务时在途请求仍在跑；
- QQ 专辑按「专辑名 + 歌手」反查没有全局并发/频率限制；
- MusicBrainz 用 1.1s 串行队列，会拖住 6 个 worker。

**影响**：流量浪费、源站限流、停止按钮“停不干净”、批量任务退出慢。

**建议**：把 `cancelHttp` 传进超时包装；每个任务维护 AbortController 集；对 QQ/MB 分别做令牌桶；停止时统一 cancel。

---

#### P1-2 语言识别靠启发式，误判会影响粤拼和翻译
**位置**：`src/utils/language.ts`、`src/screens/Home/Views/Player/index.tsx:457-471`

**问题**
- 以繁体字比例、粤语用字、歌手白名单判断语种；
- 台湾国语歌可能因繁体比例被判粤语；粤语歌可能因用字少被判普通话（护花使者已用歌手白名单兜底）；
- 结果直接驱动「自动粤拼 / 自动翻译」开关，误判会造成明显体验问题。

**建议**
- 引入置信度（歌词命中率、歌手白名单、专辑语种、用户手动修正）；
- 用户可在播放器长按/设置里“纠正语种”，写回 `meta.language`；
- 建立回归样本集（至少 100 首粤语/国语/外语）做单元测试。

---

#### P1-3 发布签名配置存在重复赋值
**位置**：`android/app/build.gradle:160-176`

```gradle
release {
  signingConfig signingConfigs.debug
  ...
  signingConfig signingConfigs.release
}
```
当前 Groovy 后赋值生效，产物是 release keystore；但这是明显的配置错误，一旦顺序调整会导致 release 包用 debug key 签名，无法覆盖安装/上架。

**建议**：删除 `signingConfig signingConfigs.debug`；增加 CI 校验 `apksigner verify --print-certs` 的 CN 必须为 `Emo Music`。

---

#### P1-4 网络安全配置全局允许明文，权限偏宽
**位置**：`android/app/src/main/AndroidManifest.xml`、`res/xml/network_security_config.xml`

- `cleartextTrafficPermitted="true"` 全局放开；
- 申请 `MANAGE_EXTERNAL_STORAGE`、`REQUEST_INSTALL_PACKAGES`。

**影响**：明文接口可被中间人篡改；上架 Google Play 审核风险；安装包权限过宽。

**建议**
- 仅对必要的第三方域名开启 cleartext（`domain-config`），其余默认禁止；
- 自更新下载后校验 SHA256 或与 GitHub Release 元数据比对；
- 评估是否必须保留 `MANAGE_EXTERNAL_STORAGE`，优先 SAF 目录授权。

---

#### P1-5 依赖漏洞与版本落后
**数据**：`npm audit --omit=dev`：2 critical / 9 high / 7 low。
- `shell-quote`（critical，命令注入）
- `tar`（critical，路径穿越）
- `joi/brace-expansion/compression/image-size/js-yaml`（high）
- React Native 0.73.11 已停止维护，后续安全/兼容性风险上升。

**说明**：多数来自构建链（RN CLI/打包工具），不会进入 APK 运行时，但仍应治理。

**建议**：先 `npm audit fix` 升级可安全升级项；建立 CI 漏洞门禁；规划 RN 0.76/0.77 升级评估。

---

### P2（中优先级，可维护性/可观测性）

#### P2-1 空 catch 过多，失败不可见
46 处 `catch {}`，集中在本地音乐扫描、封面、标签写入、DB 同步。用户只看到“没反应”，日志里也没有原因。

建议：统一 `log.warn/error`，关键路径（写标签、DB、备份）失败必须 toast 或诊断页可见。

#### P2-2 生产代码 435 处 console.log
建议：接入 `log` 模块分级；release 构建移除 `console.log`（babel plugin）或只在 debug 打开。

#### P2-3 巨型文件
`LocalMusic/index.tsx` 2854 行、`Player/index.tsx` 2212 行、`Favorites.tsx` 974 行，状态/副作用/UI 耦合严重。

建议：Player 拆 `LyricView / PlayerTools / QueueView`；LocalMusic 拆 `tabs / list / search / detail`；Favorites 拆 `playlist grid / detail`。

#### P2-4 测试覆盖不足
仅 3 个测试文件，未覆盖：
- FLAC 写入/回滚；
- 曲库 JSON/DB 迁移；
- 刮削解析与语言判断；
- 播放器语种自动切换；
- 设置页工具批处理。

建议：为纯函数模块补单测，给 `writeFlacTags` 加临时文件回滚测试，给语种判断加样本集。

#### P2-5 SQLite 迁移容错不透明
`ALTER TABLE` 使用空回调吞错；若列添加失败，后续 `upsertTracks` 会失败但只记 warn，数据静默不落库。

建议：迁移后用 `PRAGMA table_info(tracks)` 校验；失败时禁用 DB 并提示用户。

#### P2-6 自动更新下载无完整性校验
`src/utils/version.js` 直接从 GitHub Release 下载 APK 并安装；Android 同签名校验能防替换，但无法防 CDN/GitHub 账号被入侵后的恶意包。

建议：在 `version.json` 中提供 SHA256/signature，下载后校验再安装。

#### P2-7 备份文件未加密且仅单份
`local_library_backup` 含文件路径/歌曲元数据；只有一份备份，无轮转/加密。

建议：至少保留 3 份轮转；提供导出/恢复 UI；敏感路径可脱敏。

---

### P3（低优先级）

- `readSource.setReadSource`、`compareReadSources` 等死代码/未使用 API；
- `musicbrainz.ts` 的 User-Agent 使用了不存在的占位 URL；
- `build.gradle` 注释仍保留 RN 模板的 “signingConfig signingConfigs.debug”；
- `theme/themes.ts` 4540 行生成文件应移出版本库或标记 generated；
- 1 条 `react-hooks/exhaustive-deps` warning（Player 的 `lyricLanguage` useMemo 依赖不完整）。

---

## 4. 做得好的地方

- 本地曲库有 JSON 备份、影子同步、回滚演练、断电演练基础能力；
- FLAC 写入有临时文件 + 备份 + 失败回滚，避免半截文件；
- 批量工具任务有互斥锁（`acquireToolsBusy`），避免并发写库；
- 媒体 URI 失效后播放前会重新反查 MediaStore（3.22.5）；
- 类型检查/ESLint/单元测试在当前基线为绿；
- 发布产物有 SHA256、版本 tag、release notes，可追溯。

---

## 5. 发行前门禁建议

每次发版至少执行：

```bash
npm run typecheck
npm run lint
npm run test:unit
cd android && ./gradlew :app:assembleRelease
# 校验签名
apksigner verify --print-certs dist/.../arm64.apk | grep "CN=Emo Music"
# 校验 SHA256
shasum -a 256 dist/.../*.apk
```

新增必过项：
1. `npm audit --omit=dev` 不得新增 critical/high（允许白名单）；
2. 任何 `catch {}` 新增需在 PR 说明原因；
3. 数据层改动（localLibrary/readSource/backup）必须有单测或回滚演练。

---

## 6. 建议修复顺序（两周）

**第 1 周**
1. 明确并修复曲库唯一权威源（P0-1）；
2. 刮削跳过“标签无变化”的文件写入（P0-2）；
3. 网络请求真正取消 + 频率限制（P1-1）；
4. 修正签名配置并加 CI 校验（P1-3）。

**第 2 周**
5. 语种判断置信度 + 用户纠正入口（P1-2）；
6. 清理生产 console / 空 catch（P2-1/2）；
7. 补 FLAC/迁移/刮削单测（P2-4）；
8. 依赖升级与漏洞门禁（P1-5）。

---

*报告基于静态审查与当前构建产物，未对第三方音乐接口做稳定性/合规性评估。*

---

## 7. 修复进展（v3.28.0）

| 发现 | 状态 |
|---|---|
| P0-1 曲库读源分叉 | 已修：默认 JSON，repository 需显式开启 |
| P0-2 FLAC 无变化仍重写 | 已修：写前比对文件标签，一致则跳过 |
| P1-1 超时不取消请求 | 已修：超时调用 cancelHttp |
| P1-3 release 签名配置错误 | 已修：删除 debug 赋值，apksigner 校验 CN=Emo Music |
| P2-4 测试不足 | 部分：新增语种判断测试，24/24 |
| P1-5 依赖漏洞 | 未修（需单独升级窗口） |
| P1-2 语种置信度 | 未修（建议下一批） |

---

## 8. 修复进展（v3.29.0 第二批）

| 发现 | 状态 |
|---|---|
| P2-1 空 catch 静默失败 | 部分修复：刮削单曲/FLAC 写入失败已记录日志 |
| P2-2 生产 console.log | 已修：release 构建自动移除 log/debug/info |
| P2 性能：批量写文件 I/O | 已修：写入并发限 2 |
| P2-4 测试 | 24/24；语种判断有回归测试 |
| P1-2 语种置信度/人工纠正 | 未修 |
| P1-5 依赖漏洞 | 未修，待独立升级窗口 |

---

## 9. 修复进展（v3.30.0 第三批）

| 发现 | 状态 |
|---|---|
| P1-2 语种误判无法纠正 | 已修：歌词菜单新增语种纠正，本地写回 meta、在线持久化覆盖 |
| P1-5 依赖漏洞 | 未修，待升级窗口 |
| P1-4 明文流量 | 未修，需源站兼容性验证 |
| P2-5 SQLite 迁移校验 | 未修，等读源方案定稿 |

---

## 10. 修复进展（v3.31.0 第四批）

| 发现 | 状态 |
|---|---|
| P2-5 SQLite 迁移/双写 | 已修：补齐 `upsertTracks` 缺失的 3 个参数，并加列/值数量断言；此前 DB 双写实际整批失败 |
| P1-5 依赖漏洞 | 尝试升级被 vendor `bob build` 中断，lockfile 未改动；延后独立窗口 |
| P1-4 明文流量 | 未修，需按音源 CDN 域名灰度验证，避免影响播放 |

---

## 11. 修复进展（v3.32.0 第五批）

| 发现 | 状态 |
|---|---|
| P2-4 测试不足（数据层） | 已补：DB 列/值一致性、language/year/genre 映射、标签比较；30/30 |
| P2-5 列/值漂移 | 已从结构上收敛：唯一 `TRACK_COLUMNS/buildTrackValues` 来源 + 断言 |
| P1-5 依赖漏洞 | 仍未修：vendor `bob build` 阻塞，需单独窗口 |
| P1-4 明文流量 | 仍未修：需按域名灰度 |

---

## 12. 修复进展（v3.33.0 第六批）

| 发现 | 状态 |
|---|---|
| 发布门禁缺少签名校验 | 已修：新增 `npm run verify:release`，自动校验 CN=Emo Music + SHA256 |
| 新机器 vendor 安装失败 | 部分修复：setup-vendor 移除两个包的 bob prepare |
| P1-5 依赖升级 | 仍阻塞：track-player 的 prepare 依赖 rimraf/tsc PATH，需单独设计 vendor 构建缓存 |
