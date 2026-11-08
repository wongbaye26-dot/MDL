# EmoMusic v3.27.0 发行说明

> 版本 **3.27.0** / versionCode **316**

## 歌词语种自动处理
- 新增 `src/utils/language.ts`：从歌词判断粤语/普通话/英文/日文/韩文；
- 在线音乐没有 `meta.language` 时，歌词加载后自动判断；
- 粤语歌：自动开启粤拼；有网易 `romalrc` 优先用，没有则本地 to-jyutping；
- 其他外语：自动开启中文翻译；
- 普通话：不显示粤拼、不自动翻译；
- 曲库语言若是「普通话」但歌词明显是粤语，以歌词为准（修复刮削误判）。

## 说明
- 翻译依赖音源提供的中文翻译；没有翻译时保持原文。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `67cb20766a2dc54a70fff3b9c36d5522a1ad9a62da0de479db3ee7d0fa151e50` |
| armeabi-v7a | `d83c58b5d3fc101ae698370cf3c2986e0dd0d643c4d7dec4288122c68f4e7757` |
| universal | `fe28696e0f19b69fa65da743f592a1a8761abf80753578ebbfbd960c7e18983d` |
