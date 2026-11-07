# v3.10.19 发布说明

> 版本 **3.10.19** / versionCode **239**

## 本地音乐页签跟手度
- 页签高亮仍立即切换；
- 列表数据改用 `useDeferredValue(tab)` 延迟一帧构建，避免点击时同步重建几百行阻塞 UI；
- 切 tab 时先保留旧列表，下一帧再替换，减少「点了没反应」的感觉。

## 收藏页 UI 对齐
- 歌单卡改为统一圆角卡片：内缩封面、细边框、主题色底；
- 删除按钮/长按删除保留；
- 新增无歌单时的虚线空状态卡片；
- 卡片内文字/数量间距统一。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.10.19-arm64-v8a.apk | `3ad297da0f5fb2f739d1bb6d0b05740db6869c80149e449e1bdfd0809265667b` |
| universal | em-music-v3.10.19-universal.apk | `3cc557afcad9d894d5300316e5f1836f34fb7b7b992b657fc38ef6f3d96c7073` |
