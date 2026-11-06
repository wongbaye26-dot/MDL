
## 真机结果（2026-11-07）
- 设置 → 本地曲库 → 迁移自检 → 运行：
  - **通过：DB 0 → 中断 142 → 恢复 238**
  - 旧 JSON 238 首，缺失 0 / 多余 0，13416ms
- 演练只操作 SQLite 影子表；旧 JSON、收藏、歌单引用未动。

## 构建产物

| ABI | 文件 | SHA256 |
|---|---|---|
| arm64-v8a | em-music-v3.9.24-arm64-v8a.apk | `1d27c73fe8fcb079e3028235575b1f7f641136c55892e65e3692e51d74187621` |
| universal | em-music-v3.9.24-universal.apk | `69f979e84a18c571c02ca1ffe4ee8f1532fa527ca41d66f53051b1334fb792b4` |
