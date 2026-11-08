# EmoMusic v3.37.0 发行说明（审计修复第九批）

> 版本 **3.37.0** / versionCode **327**

## P1-4 明文流量收敛
- 基础配置改为 **默认禁止明文**；
- 仅对音乐源/CDN 域名允许 http：
  - 酷我：`*.kuwo.cn`、`*.kwcdn.kuwo.cn`
  - 酷狗：`*.kugou.com`、`*.kgcdn.com`
  - QQ：`*.qq.com`、`*.gtimg.cn`
  - 网易：`*.163.com`、`*.126.net`、`*.127.net`
  - 咪咕：`*.migu.cn`
  - 百度：`*.qianqian.com`、`*.taihe.com`、`*.baidu.com`、`*.bdstatic.com`
- 更新、MusicBrainz、CoverArt 继续强制 HTTPS；
- 依据为真机「请求域名」采集到的 http 域名 + 各源已知 CDN 后缀。

## 验证
- 安装后启动无 `Cleartext HTTP traffic not permitted`；
- 本地播放不受影响；
- 在线源需逐个回归（酷我/QQ/酷狗/网易/咪咕）。

## 回滚
- 若某音源播放/封面失败，在 `network_security_config.xml` 补对应域名后重新打包。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `9859666fa158a8032c734c5448eabb3e1d00d2ba6d37fed1ca3fac407aa32904` |
| armeabi-v7a | `e698b9bc1c2dc5dc0ad8691c74ee7e3ccb49590d4d25f4ade4901ee4a00dfbbc` |
| universal | `761f628b2adc54410d839770be7bd9b3892fdb71291077627279f57a331faf48` |
