# v3.10.26 发布说明

> 版本 **3.10.26** / versionCode **246**

## 设置页显示不全修复
- `ValueRow` 值区域：宽度上限 45%→58%，允许 2 行，右对齐；
- `ChoiceRow` 胶囊：去掉固定 30dp 高度，改自适应高度 + 上下内边距，长文本不再被裁切；
- 修复：文件名格式前两个胶囊、资源缓存数字、关于页版本/框架/设计语言/平台。

## 本地曲库
- 「迁移自检」整组默认隐藏（`SHOW_MIGRATION_TOOLS=false`），普通用户不再看到。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.10.26-arm64-v8a.apk | `5beba41e19d1c63c1101df16ec3c62c0b2e914f0241e12952cab1cc93544fd8f` |
| universal | em-music-v3.10.26-universal.apk | `cc646ed38e3f396f15aedd84982bfd0075d936cd25cd7f26e8de09ee31d1759d` |
