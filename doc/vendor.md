# 原生依赖治理

这个 App 有 4 个原生依赖用的是**第三方维护的 fork**，不是 npm 上的官方包；它们不属于 lxmusic 应用项目源码，属于原生库依赖。
它们放在仓库**外面**的 `../vendor/`（因为包含完整原生工程，体积大、且需要能独立 git 操作）。

## 清单

| 包 | 上游 | 钉住的 commit | 用途 / 为什么 fork |
|---|---|---|---|
| `react-native-track-player` | `lyswhut/react-native-track-player` | `d76fe8ff` | 播放内核。fork 里加了 `updateNowPlayingTitles` / `isCached` / `getCacheSize` / `clearCache` |
| `react-native-file-system` | `lyswhut/react-native-file-system` | `fcb0e6f5` | 文件读写（含 SAF 目录树）。`package.json` 的 `types` 指向不存在的文件 |
| `react-native-local-media-metadata` | `lyswhut/react-native-local-media-metadata` | `1b5be310` | 读音频标签/封面。`types` 同样有问题，且没读采样率 |
| `react-native-background-timer` | `lyswhut/react-native-background-timer` | `55ecaa80` | 后台计时器（切歌去抖、睡眠定时） |

`package.json` 里它们都写成 `file:../vendor/xxx`，**所以新机器 clone 下来直接 `npm i` 一定失败**。

## 首次搭建

```bash
npm run setup:vendor   # 按上表的 commit 拉取 4 个 fork 到 ../vendor
npm i                  # 装依赖，postinstall 会自动跑 dependencies-patch.js
npm run vendor:check   # 校验：目录在、commit 对、补丁都打上了
```

> **RN 0.76 起注意**：仓库根有 `.npmrc`（`install-links=true`），`npm i` 会把 `file:../vendor/*`
> 物化成 `node_modules` 下的真实目录。**不要**手动改成软链装法（`npm i --ignore-scripts` 后手建
> 软链之类）：RN 0.76 的 Metro 不跟随指向仓库外的软链，release 打包会报
> `Unable to resolve module react-native-*`。

`setup:vendor` 是幂等的：已存在且 commit 正确就跳过，不一致会重新拉。每次运行都会做一遍
「归一化」（对已有目录也生效）：

- 给 fork 加 `node_modules` 软链（让 fork 的 prepare/tsc 能解析到根项目依赖）；
- 删掉 `file-system` / `local-media-metadata` 的 `prepare`（Metro 直接用 src，不需要 bob 产物）；
- 删掉 `track-player` 的 `prepare`（`rimraf lib && tsc` 在干净环境会因根依赖未就绪而失败），
  并把 `src/`、`tsconfig.json` 加进 `files` 白名单——`dependencies-patch.js` 会在 postinstall
  里用根项目的 `tsc` 重新生成 `lib/`，保证 Metro（`main: lib/index.js`）和类型检查都能用；
- 如果 vendor 工作树有历史补丁残留会打印提示（补丁以 `node_modules` 为准，可 `git checkout -- .` 清理）。

## 必须在装完之后打的补丁

这些改动没法放在 fork 仓库里（fork 是公共仓库，且我们不控制它的提交），
所以放在 `dependencies-patch.js` 里，`postinstall` 自动执行：

| 补丁 | 文件 | 内容 | 不打会怎样 |
|---|---|---|---|
| 类型指向 | `react-native-file-system/package.json` | `types` → `src/index.ts` | `utils/fs.ts` 整层没有类型，tsc 报 4 个 TS2307 + 一串隐式 any |
| 类型指向 | `react-native-local-media-metadata/package.json` | 同上 | 同上 |
| 采样率 | `.../localmediametadata/Metadata.java` | 多返回一个 `sampleRate` | 本地音乐列表不显示「44.1 kHz」 |
| AGP8 | `react-native-linear-gradient/android/build.gradle` | 补 `namespace` | Android 构建直接失败 |

脚本是**幂等**的：已打过就跳过，锚点找不到会打印提示而不是静默失败。

## 升级某个 fork 的流程

1. 在 `../vendor/<包>` 里 `git fetch && git checkout <新 commit>`
2. 同步改 `scripts/setup-vendor.js` 里的 `commit`（这是唯一的「版本锁」）
3. 同步改 `scripts/check-vendor.js` 里的 `PINNED`
4. `npm i` 重新安装该包 → `npm run vendor:check` → `npm run typecheck` → 出包冒烟

> 注意：`check-vendor.js` 里还校验了 track-player 的 4 个扩展方法。
> 升级到官方版本会直接报错 —— 那是提醒你「这个 fork 的能力丢了」。

## CI

4 个 fork 在仓库外，所以 **任何在干净 runner 上执行的 npm 安装都必须先跑 `setup:vendor`**。
这一步已收敛到 `.github/actions/setup`（composite action），`build.yml`(release) / `beta-pack` /
`build-test` / `check` 全部复用；`.nvmrc` 同步为 Node 20。

> 2026-11 修复：此前 `release.yml` / `build-test.yml` / composite setup 都没有拉 vendor，CI 在
> `Setup Env` 的 `npm ci` 就失败；另外 track-player 的 prepare 在没有根依赖时会以
> `rimraf: command not found` 失败。两处均已修复并做了「干净目录 + 空 vendor」的安装演练。

## 已知风险

- 4 个 fork 都停在 2021~2022 年的版本，没有上游安全更新。
- `react-native-track-player` 是 2.1.2，与 RN 的兼容性靠 fork 维持。RN 0.73 → 0.76 升级时已逐项
  对照 RN 0.76.9 的 Java API 审计（无删除/签名变更），并在真机回归播放/进度/歌词/通知/MediaSession，
  结果正常（见 `doc/rn-0.76-upgrade.md` §3）。
- `scripts/check-vendor.js` 对 track-player 扩展方法的检查同时支持源码（软链装法）与
  `lib/trackPlayer.d.ts`（`install-links` 物化装法）。
