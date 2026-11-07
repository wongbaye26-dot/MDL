# EmoMusic v3.11.10 修复说明

> 版本 **3.11.10** / versionCode **258**

## 本地搜索不生成结果列表
- 根因：tab rows 缓存 key 未包含搜索态，搜索时命中非搜索缓存，结果列表不更新；
- 修复：搜索/专辑详情/文件夹详情直接绕过 tab 缓存，始终按当前关键词构建；
- 真机验证：本地搜索弹出结果列表并正常显示命中歌曲。

## 验证
- typecheck 0 / lint 0；assembleRelease 成功。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `706c387829d0b262b68e03240a2637b253d34b54794935b2fc012660ca0464bc` |
| armeabi-v7a | `f8b7e06e1ad1f078594f49063366e7f7c913a1020dadda2a9e01a32899aab452` |
| universal | `86c73cbd32b02b60e64245a9dbcdd226655d85da0f0950f35e366fdc839bc7c7` |
