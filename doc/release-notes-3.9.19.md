# v3.9.19 发布说明

> 版本 **3.9.19** / versionCode **210**

## 曲库工具内部
- 工具卡片：标题 13.5、说明 10、圆角 24；
- 统计块：圆角 14、数值 18、标签 9.5；
- 信息行：数字 16 加粗；
- 主/次按钮、汇总 chip 与设置页新 UI 统一。

## 设置页迁移收尾
- 8 个一级分类的壳层、列表项、主要功能块均已统一到新设置 UI；
- 工具业务逻辑保持不变，仅统一容器与控件视觉。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.9.19-arm64-v8a.apk | `632700f6eba93d67f69f373e556de1a984070c1c74c6452dc90f15fdc93724f6` |
| universal | em-music-v3.9.19-universal.apk | `e32ceeff3ca2de505b9f33b32fe0ee1c7461a9d23d596f79527b123c578e9772` |
