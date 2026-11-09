# v3.50.0 之后 · 优化与改进清单

- 日期：2026-11-09
- 当前基线：**v3.50.0**（RN 0.80.3 新架构 / RNN 8.6.2 / React 19.1 / 自研 GlassBlurView）
- 说明：按「稳定性 → 性能 → 技术债 → 功能 → 工程化」排序，P0 建议发下一版前完成，P1 两周内，P2/P3 按迭代排。

---

## P0 · 稳定性与发布门禁（下一版前）

| 项 | 内容 | 验收 |
|---|---|---|
| P0-1 | **v3.50.0 全量真机回归**：按 `doc/qa-3.41.0-rn076.md` 17 项 + 「未覆盖」清单（弱网/断网重试、断点续传、锁屏媒体卡、队列/收藏杀进程恢复、M3U 往返、歌词偏移与同名 .lrc、横屏播放页、分屏/折叠屏） | 逐项记录 ✅/❌/系统限制 |
| P0-2 | **低端机/低版本验证**：armeabi-v7a 真机、API<31 设备（自研 blur 软件模糊首次全版本可用）、Android 16/16KB 设备 | 安装启动、播放、模糊、无崩溃 |
| P0-3 | **CI 正式发版链路**：配置 GitHub Secrets（KEYSTORE_*），验证 `release.yml` 自动建 tag + GitHub Release + 三 APK；当前只有本地 dist 与手工 tag | Release 页面可见三 APK + SHA |
| P0-4 | **回滚预案演练**：从 v3.50.0 回退到 v3.42.3/v3.41.0 的步骤与数据兼容性（旧包仍在 dist-archive） | 一次实际回滚+恢复 |
| P0-5 | **单元测试补核心路径**：下载目录解析（默认/SAF）、删除回退、曲库迁移、设置子页导航状态机；当前仅 7 个测试文件 / 32 用例 | CI 跑通 + 覆盖率基线 |
| P0-6 | **崩溃可观测性**：release 已有自建日志 + exception handler；增加「一键导出诊断包」（日志、设备信息、最近操作路径），不含第三方统计 | 设置页可导出 zip |

## P1 · 性能

| 项 | 内容 | 预期收益 |
|---|---|---|
| P1-1 | **圆盘自转空闲暂停**：播放中长时间无操作时暂停胶囊/播放器封面自转，触摸恢复；当前播放+空闲仍有 ~25% RenderThread | RenderThread 25% → ~2–5%（播放空闲） |
| P1-2 | **多玻璃层共享快照**：同屏底部胶囊 + 页头 + 搜索胶囊各抓一次窗口；改为每帧一次共享快照、各层裁切 | UI 线程捕获 -50% |
| P1-3 | **模糊分级**：设置里加「模糊质量/关闭」；低端机自动降采样或纯色；box blur 移出 UI 线程 | 低端机可用性 |
| P1-4 | **启动耗时打点**：Application → RNN 初始化 → Fabric 首帧 → 首页数据就绪，分阶段日志 + 基线值 | 冷启动可量化（当前未测） |
| P1-5 | **内存基线**：启动、滚动 5 分钟、播放 1 小时 RSS；排查 Fresco/图片缓存、播放缓存、DB 连接上限 | 无持续增长/无 OOM |
| P1-6 | **APK 体积**：arm64 30.5MB；MaterialCommunityIcons 字体 1.15MB、dex 7MB、res 图片；做图标字体子集化、未用资源清理、R8 full mode 评估 | -2~4MB |
| P1-7 | **动画省电模式**（可选设置）：全局 30fps 上限/减少同时动画数量；现有 8s 空闲暂停已上线 | 低端机/省电场景 |

## P2 · 技术债与架构

| 项 | 内容 | 说明 |
|---|---|---|
| P2-1 | **8 个自研模块 TurboModule codegen 化**：先挑 Cache/Crypto/Utils 做 PoC，量化启动/调用收益 | interop 可用，非必须；PoC 5–8 人日 |
| P2-2 | **vendor fork 收敛**：track-player 2.1.2 fork 补丁已不少（bridgeless headless、MediaSession、深路径 import）；评估官方 4.x 迁移或至少补丁上游化+版本化 | `dependencies-patch.js` 已 586 行 |
| P2-3 | **workaround 清单化**：tsconfig customConditions、Fabric fontSize clamp、自研 blur、KSP 覆盖、RNN activity 时序等，记录「引入版本/移除条件」 | 后续升级逐个清理 |
| P2-4 | **RN 版本跟踪**：RN 0.81（Android 16 官方、edge-to-edge、predictive back）/0.82（新架构 only）；RNN 8.7+ 映射；先等 RNN 官方支持再评估 | 下一跳预算 5–8 人日 |
| P2-5 | **Jetifier/AndroidX 收敛**：track-player fork 仍用 support-v4 等旧包；迁移后关闭 jetifier，构建提速 | 中长期 |
| P2-6 | **本地库 A-2 切读**：影子表双写已具备，完成 SQLite 切读 + 回滚开关（见 `doc/plan-next-after-local-2.0.md`） | 大项，8 周计划中 |
| P2-7 | **媒体扫描一致性**：MediaStore vs SAF 双来源去重、增量扫描性能、缺失文件自动清理/提示、权限撤销检测 | 与 P0-1 联动 |

## P3 · 功能与体验

- **播放器**：锁屏/通知展开区完整媒体卡（Samsung One UI 系统接管限制需记录）、Android 13+ 媒体控制、音频焦点/duck、无缝播放、均衡器（可选）。
- **下载/SAF**：旧 `content://` 条目批量转真实路径或「仅移除」工具；断点续传恢复；下载完成自动 MediaStore 扫描；权限撤销引导。
- **本地曲库**：CUE 分轨、M3U 导入导出、同名 .lrc、标签回填（language/year/genre 已有）、无效条目清理入口可发现性。
- **设置**：新增「模糊质量/关闭」「动画省电模式」；「减少动态效果」覆盖更多动效。
- **无障碍/大字体**：TalkBack 标签、字体缩放边界（已做 fontSize 兜底）、对比度检查。
- **用户脚本（UserApi）**：QuickJS 沙箱限制（memory/stack/timeout）、脚本错误提示、权限说明。

## P4 · 工程化 / 文档 / 安全

- **发布**：CHANGELOG 补 v3.13–v3.37 缺口；QA 文档更新到 v3.50.0；beta 通道 `beta-pack.yml` 验证；版本号规则统一（3.42.3 → 3.50.0 的跳号需在 release.md 写明）。
- **CI**：Gradle/CMake/NDK 缓存、双 ABI 并行、APK 体积 diff、单元覆盖门槛；新架构构建时长监控。
- **安全**：UserApi 脚本沙箱、明文 HTTP 域名白名单、`MANAGE_EXTERNAL_STORAGE` 上架政策风险（逐步 SAF-first）、依赖 `npm audit` 与 license 清单。
- **分支策略**：单人项目可直接 master；若多人协作，切 feature branch + PR + CI required checks。

---

## 建议排期（约 2–3 周）

1. **第 1 周**：P0-1/P0-2 真机回归 → 修回归；P0-3 CI Secrets + 自动 Release；P0-5 测试补强。
2. **第 2 周**：P1-1/P1-2/P1-3 性能；P1-4/P1-5 启动/内存基线；P1-6 体积。
3. **第 3 周**：P2-2 vendor 决策、P2-1 TurboModule PoC 立项、P2-6 A-2 切读方案评审。

## 可立即做的 Quick Wins

1. 配置 GitHub Secrets → 下次发版自动出 GitHub Release（当前手工 tag）。
2. 播放中空闲停圆盘自转（约省 25% RenderThread）。
3. 多玻璃层共享快照（UI 线程捕获减半）。
4. 图标字体子集化 + 未用资源清理（约 -2MB）。
5. 设置里加「模糊质量/关闭」开关。
6. 导出诊断包入口（日志+设备信息）。
