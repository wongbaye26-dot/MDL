# EmoMusic v3.12.4 发行说明

> 版本 **3.12.4** / versionCode **267**

## 横版首页
- 最近播放/最近添加的歌曲列表行距收紧：横屏单元格高 56→50、行间距 6→1。

## 横版播放器
- 顶部工具行新增「歌词设置」入口（tune 图标）；
- 打开后复用同一套 `LyricSettingsPanel`，其中包含「逐字显示」开关。

## 横版播放队列
- 点击专辑封面只居中，不再直接切歌；
- 通过中间卡上方的播放按钮播放对应歌曲；
- 播放按钮图标按「选中卡是否为当前歌」显示播放/暂停。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `24fe9bbf13f3b62e81fcdaf353bb1bf52ef02b3398e229d71c8ae2fbecd95d08` |
| armeabi-v7a | `83b26ee1e482af621d821638aeab31fb9efe95929cc970963ed9831c754bed0f` |
| universal | `b0ee7b9bc02794e52aff986a8adfaedade1543148ad05fe67062e4c76577fbce` |
