# EmoMusic v3.12.5 发行说明

> 版本 **3.12.5** / versionCode **268**

## 横版首页行距
- 左右（列与列）间距在横屏下从 12dp 收紧到 6dp，与竖版视觉更接近。

## 播放器歌词设置
- 歌词快捷菜单新增「逐字显示」图标开关（format-text）；
- 横屏打开时菜单改为横排、靠右显示在歌词设置按钮左侧，不再落在左下角；
- 设置与设置页共用 `player.isWordByWordLyric`。

## 验证
- typecheck 0 / lint 0 / test 19/19 / assembleRelease 成功；
- 设备 ADB 在打包时掉线，未完成安装与真机截图验证。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `448495228545e4b6fac68a436558ea3f205040dd8bddce491898f6149c9b4daa` |
| armeabi-v7a | `ea179424ae4fbf0b12fc8d8cc6dfbe0a01cb1bdddc8d1eb179883f50f377bd3c` |
| universal | `463f3a0e420a7f377a17bde4d0fb118d04de5f1b66f3f1a2c283db7919dea794` |
