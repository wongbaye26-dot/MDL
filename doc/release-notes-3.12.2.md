# EmoMusic v3.12.2 修复说明

> 版本 **3.12.2** / versionCode **265**

## 横版胶囊导航专辑封面/进度环对齐竖版
- 横版左侧胶囊原用旧 `AlbumDiscButton`（30dp 小封面 + 36 段分段环）；
- 改为与竖屏底部胶囊相同的 `AlbumDiscSpin`（48dp 封面、54dp 外圈、圆环进度、自转、高光/阴影）；
- 进度样式仍遵循设置 `common.navProgressStyle`（ring/border/none）。

## 验证
- typecheck 0 / lint 0 / unit test 19/19；assembleRelease 成功。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `0831223f27416360a0e94923aa17b5643b48151f69c61b589a84e96bd45f9b77` |
| armeabi-v7a | `ff3edb8121e850d4f0d235d869f48f86d9815d5601b519e7e245463b2063fb11` |
| universal | `b2ebffdfca98b5e7cecc530d2568d79f5553ff28ceda8eca908045cf53ed22db` |
