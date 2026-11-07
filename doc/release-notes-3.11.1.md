# EmoMusic v3.11.1 发行说明

> 版本 **3.11.1** / versionCode **249**

## 冷启动卡死/切页无响应修复（重要）
根因：上一版为了 tab 切换快，把 5 个 tab 的 rows 一次性预计算；冷启动扫描/补封面期间列表每次更新都会同步重算 5 遍，JS 线程被连续堵住十几秒，导致：
- 本地列表迟迟不出来；
- 左右切下载中心/设置无响应；
- 底部胶囊导航点不动。

修复：
- 只构建**当前 tab** 的 rows；
- tab 切换按需构建（切一次算一次），不再在列表更新时跑 5 份；
- 保留排序函数纯化，避免 tab 变化让缓存全失效。

## 验证
- 冷启动后 0.8s 内可切到下载中心并完整渲染；
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功。

## SHA256

| ABI | SHA256 |
|---|---|
| arm64-v8a | `541a2056581c588132690f80b18cbb07b3ee1b3a58130a9935df2c4f52b1bb94` |
| armeabi-v7a | `cc609b8e6775af4432fc6c76c50b2da9f4ed5c24ef1e24c723e1748073ff503c` |
| universal | `514000a53ffe4f79250b2fd7ea1cf70fecd8a088d31035c42f6f7c31c15a5e66` |
