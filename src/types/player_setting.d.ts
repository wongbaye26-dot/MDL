export {}

// 播放器/歌词相关设置项，单独声明以避免修改体积较大的 app_setting.d.ts
declare global {
  namespace LX {
    interface AppSetting {
      /**
       * 歌词逐字显示（关闭则整行高亮）
       */
      'player.isWordByWordLyric': boolean

      /**
       * 歌词单行显示（只显示当前行）
       */
      'player.isSingleLineLyric': boolean
    }
  }
}
