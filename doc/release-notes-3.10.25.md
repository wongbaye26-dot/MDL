# v3.10.25 发布说明

> 版本 **3.10.25** / versionCode **245**

## 旧设置死代码清理
删除确认无引用的旧设置模块：
- `settings/Other`
- `settings/Download`
- `settings/SearchList`
- `settings/List`
- `settings/Search`
- `settings/About.tsx`

保留：
- `Vertical/Grid`（设置主页实际在用）
- `settings/Player` 中被歌词设置面板引用的控件
- `Basic/UserApiEditModal`、`Backup/actions` 等功能模块

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功；安装启动成功。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.10.25-arm64-v8a.apk | `1bbab78e1ce2797ff63268ca73f844a1223aa97893c92a8223346bb752c9057f` |
| universal | em-music-v3.10.25-universal.apk | `ee0757b278c7e5b898f1f457c02cc6476982a7e7bc82e62f7e846dc3ac406747` |
