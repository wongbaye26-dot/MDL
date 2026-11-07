# EmoMusic v3.11.4 发行说明

> 版本 **3.11.4** / versionCode **252**

## 5 秒卡顿真正根因（已修复）
- Hermes 上 `String.localeCompare(..., 'zh-Hans-CN')` 极慢：244 首排序约 **1.1s**；
- 4 个 tab 预取串起来 → **约 5s** JS 线程阻塞，表现为打开本地音乐黑屏、切 tab 没反应。
- 修复：排序键只计算一次（decorate-sort-undecorate），比较改用普通字符串比较；
- 实测 buildRows：**1147ms → 6ms**。

## 冷启动后台预加载
- 首页启动期间后台读取曲库到内存；
- 打开本地页直接命中内存列表。

## 验证
- 日志实测 buildRows 6ms；typecheck 0 / lint 0 / test 19/19；assembleRelease 成功。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `31542cde36742ef350cbf0760d14ddfdc3c2b1c3d314fdb62a7428ad57aa98f0` |
| armeabi-v7a | `d8c8e2002a58f3548680d076a1f20aef271828e7081eb7df5270b68463b9b8bd` |
| universal | `c0d215db566bf03b58227d247672576855e6147f49f3f2688cc0e3f5bd23cb5b` |
