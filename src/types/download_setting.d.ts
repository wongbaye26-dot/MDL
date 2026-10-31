export {}

// 下载相关设置项，单独声明以避免修改体积较大的 app_setting.d.ts
declare global {
  namespace LX {
    interface AppSetting {
      /**
       * 下载保存目录，为空时使用默认目录
       */
      'download.savePath': string

      /**
       * 下载音质
       */
      'download.quality': LX.Quality

      /**
       * 同时下载的任务数
       */
      'download.maxDownloadNum': number

      /**
       * 下载失败时是否自动切换其他音源
       */
      'download.isUseOtherSource': boolean

      /**
       * 是否下载歌词文件
       */
      'download.isDownloadLyric': boolean

      /**
       * 是否下载歌曲封面
       */
      'download.isDownloadPic': boolean

      /**
       * 是否写入歌曲标签（歌名/歌手/专辑）
       */
      'download.isWriteMetadata': boolean

      /**
       * 边听边存：播放的在线歌曲自动保存到下载目录
       */
      'download.autoSaveWhilePlaying': boolean
    }
  }
}
