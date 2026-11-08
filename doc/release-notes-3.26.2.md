# EmoMusic v3.26.2 说明

> 版本 **3.26.2** / versionCode **314**

## 粤拼来源策略
- 网易云歌词插件本身会返回 `romalrc`（注音/罗马音），已优先使用；
- 粤语歌：远程 romalrc 有则直接用；没有则本地 `to-jyutping` 词典生成；
- 国语歌：丢弃远程 romalrc 的拼音行，只保留中文翻译，避免误显示拼音；
- 外语歌：保留翻译，不显示粤拼。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `66ba6ce6f48422b332d94815d95a09e5ee2081b30ecdfb0db4c9e32cc856b9f2` |
| armeabi-v7a | `9d4e7d8e5f4b0a20d6e6a1921d7a682f9e49b281e8c120a198af00cd7f3742d4` |
| universal | `787432f8b2beb22dfe1859820096ce8535a3331e5a7beb6a81981ade330ed079` |
