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

      /**
       * 歌词字号档位：0 小 / 1 标准 / 2 大 / 3 超大（对应播放器 LYRIC_SIZES）
       */
      'player.lyricSizeIndex': number

      /**
       * 歌词对齐：auto 自动（竖屏居中、横屏左对齐）/ center / left
       */
      'player.lyricAlign': 'auto' | 'center' | 'left'

      /**
       * 底部导航胶囊左右滑动切歌
       */
      'common.navSwipeSwitch': boolean

      /**
       * 底部胶囊的播放进度样式：封面外圈圆环 / 关闭
       * （「胶囊描边」在 v3.8.2 已下线，存量 'border' 由 config/migrate.ts 迁成 'ring'）
       */
      'common.navProgressStyle': 'ring' | 'none'

      /**
       * 底部胶囊/迷你播放器的玻璃效果：液态玻璃 / 毛玻璃 / 关闭
       */
      'common.navGlassStyle': 'liquid' | 'frosted' | 'none'
    }
  }
}
