# EmoMusic v3.24.0 发行说明

> 版本 **3.24.0** / versionCode **306**

## MusicBrainz 元数据源（Lyrico musicbrainz 插件同源）
- 新增 `src/core/localMusic/musicbrainz.ts`：
  - recording search 取首次发行年份、release 封面；
  - recording detail `inc=genres` 取风格；
  - 1 请求/秒限速 + 内存缓存 + User-Agent；
  - 现场/remix/karaoke 版本降权，优先录音室版本。
- 只对非中文歌启用，避免中文歌查不到还拖慢刮削。
- 刮削顺序：现有 kw/tx/wy 快速匹配 → 缺风格时用 MusicBrainz 补年份/风格/封面。

## QQ/网易年份
- 按 Lyrico 插件字段解析 `time_public` / `publishTime`，搜索结果直接带年份，不额外请求。

| ABI | SHA256 |
|---|---|
| arm64-v8a | `7ce50b8dcb9b8be85e17f5a3479c1318a28d5b4e6f48dcafb9326ecd41b3e0d2` |
| armeabi-v7a | `f0b28b1f50857682d94cebb265bd2872ca65ae569575d97d39cdd25baa787c80` |
| universal | `61d04164a72065df62b3045c0958816fa2a2b1a53584f21f9b92c6dd25aa0bcb` |
