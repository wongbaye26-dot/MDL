# EmoMusic v3.34.0 发行说明（审计修复第七批）

> 版本 **3.34.0** / versionCode **324**

## 明文流量收敛（P1-4 部分）
- `network_security_config.xml` 对敏感/可控域名强制 HTTPS：
  - `github.com` / `githubusercontent.com` / `githubassets.com`（更新源）
  - `musicbrainz.org` / `coverartarchive.org`（元数据/封面）
- 音乐源（酷我/QQ/酷狗/网易/咪咕）仍保留明文兼容，避免搜索/封面/播放失败。
- JS 请求层记录实际访问的 `http://` 域名到 `global.lx.httpHosts`，为后续按域名白名单收紧提供数据。

## 构建修复
- 修正 `request.js` 使用了 Babel 未启用的 `??=` 语法导致 release 打包失败。

## 门禁
- typecheck 0 / lint 0 / test 30/30 / assembleRelease + verify:release 通过；
- 真机安装 3.34.0 并启动正常。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `4591ce65cb1ad7f9fd78e63c03c6ea74160412cd16d4fea4d15013c5e471265d` |
| armeabi-v7a | `075f0bc394d193bfbbf4cb9c5c134863b3cbdd82009a6dd4281d650ec9cec638` |
| universal | `42d783fede6cedb80416eac24f7a0e78d12b19ca59a9f38cd0c4ca241207ee07` |
