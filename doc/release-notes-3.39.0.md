# EmoMusic v3.39.0 发行说明

> 版本 **3.39.0** / versionCode **329**

## 竖版歌词设置语种菜单错位修复
- 原因：歌词快捷菜单固定 `width: 56`，展开语种列表后仍被 56 宽容器限制，列表溢出/参差；
- 修复：
  - 语种菜单固定宽度 208，圆角 20；
  - 列表 `width: 100%`、每行 `alignSelf: stretch`；
  - 竖屏/横屏共用，选项行左右对齐。
- 真机截图确认：竖版「自动判断/粤语/普通话/英文/日文/韩文」列表对齐正常。

## 说明
- 歌词菜单的语种选项会持久化到本地歌 meta / 在线歌覆盖表；
- 顶部「自动判断」可恢复自动识别。

## 门禁
- typecheck 0 / lint 0 / test 32/32 / assembleRelease + verify:release 通过。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `349392258f07e6a8f75a1fcf10ce14c67bb2676fe9dd896cbbb21cd2e420984f` |
| armeabi-v7a | `484db507a64ae58c2a6ad184e02ce4ebc1d7b1d3135fbaddf731aebba0c90ffa` |
| universal | `6e17bd07af935e3cbea333f97e5cf92054fafee064a7c599479299666f3bf653` |
