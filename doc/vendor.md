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

`setup:vendor` 是幂等的：已存在且 commit 正确就跳过，不一致会重新拉。

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

## 已知风险

- 4 个 fork 都停在 2021~2022 年的版本，没有上游安全更新。
- `react-native-track-player` 是 2.1.2，与 RN 0.73 的兼容性靠 fork 维持，升级 RN 要重点回归播放。
