# EmoMusic v3.12.18 修复说明

> 版本 **3.12.18** / versionCode **281**

## 歌单内歌曲不能播放
- 根因：歌单列表点击后把「显示顺序的 index」传给 `playList`，而 `playList` 按原始列表 index 取歌；
  歌单有排序/过滤时取到错误或空条目，表现就是点击不播放/播放错歌；
- 修复：列表点击改为按歌曲 id 调用 `playListById`，不再依赖 index。

## 验证
- typecheck 0 / lint 0 / test 19/19 / assembleRelease 成功。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `7be6e8ef87e250798abc720e587e8b1553c43396ceacdb620c003891eea92266` |
| armeabi-v7a | `71c8548940826bcc1491d91fe52368220aec2e66aa308a58963144b807ca2432` |
| universal | `8a1d11ff6414abdb5fbe4bbdb5ffdab665525a32583cc11878f308862121f538` |
