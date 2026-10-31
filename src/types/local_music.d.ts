export {}

// 扫描本地音乐时补充的字段
declare global {
  namespace LX {
    namespace Music {
      interface MusicInfoMeta_local {
        /** 文件大小（字节），扫描时写入 */
        size?: number
      }
    }
  }
}
