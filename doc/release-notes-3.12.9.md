# EmoMusic v3.12.9 修复说明

> 版本 **3.12.9** / versionCode **272**

## 字体放大后歌词“剃头”
- 根因：歌词 `lineHeight` 用固定字号计算，应用字体大小调大后实际字号变大、行高没变，字头被裁掉；
- 修复：主歌词、高亮行、翻译/注音、逐字歌词的行高统一改为按实际渲染字号计算（`getTextSize(u(size)) * fontScale * ratio`）。

## 验证
- typecheck 0 / lint 0 / test 19/19；assembleRelease 成功；真机安装成功。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `24647fbcc1aa79ac5656628986c223a7a50c42c18cf4efa170cd752a135f721c` |
| armeabi-v7a | `5704c0d2d4cf706986d172c7306c2930a5d87500af2bbee86a4399503998a0a3` |
| universal | `6584a4277101d1e61d55844ba5ada909aef808ac80c293c5003a8bece7ca2ce4` |
