# EmoMusic v3.26.3 说明

> 版本 **3.26.3** / versionCode **315**

## 新增「刮削请求诊断」
- 设置 → 本地曲库 → 标签刮削 → 「查看刮削请求」；
- 每首歌显示：
  - 匹配源、返回的标题/歌手/专辑；
  - albumId、songmid；
  - 最终年份/风格/语言；
  - 原始返回 JSON（截断 1200 字）；
  - QQ 专辑接口返回的 aDate/genre/lan。
- 最多保留最近 120 条，仅内存。

## 移除
- 歌曲信息页底部的「曲库字段诊断」JSON 区块已删除。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `7883cf74bfac0653099fe97392bc403f43d0e0b64f75fd58b5d14605abf623c5` |
| armeabi-v7a | `3304e53675c84874e9546063c9311bf8ab4d5a5c3ab667e22aebc76fe0723eee` |
| universal | `6a5845b2403ccb94c66f735e38dc89f8641dec83e4ffd963e787502822420f04` |
