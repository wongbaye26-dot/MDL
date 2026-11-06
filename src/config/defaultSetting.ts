const defaultSetting: LX.AppSetting = {
  // 设置版本号：设置项结构/默认值有变更时 +0.1，配合 migrateSettingValues 做一次性迁移
  version: '2.3',
  'common.isAutoTheme': true,
  'common.langId': null,
  'common.apiSource': '',
  'common.sourceNameType': 'alias',
  'common.shareType': 'system',
  'common.isAgreePact': true,
  'common.autoHidePlayBar': true,
  'common.drawerLayoutPosition': 'left',
  'common.homePageScroll': true,
  'common.allowProgressBarSeek': true,
  'common.useSystemFileSelector': true,
  'common.alwaysKeepStatusbarHeight': false,
  'common.reduceMotion': false,
  'common.homeCardMotion': true,
  'common.coverRotation': true,

  'player.startupAutoPlay': false,
  'player.togglePlayMethod': 'listLoop',
  'player.playQuality': '128k',
  'player.isSavePlayTime': false,
  'player.volume': 1,
  'player.playbackRate': 1,
  'player.fadeSeconds': 0,
  'player.lyricOffsetMs': 0,
  'player.cacheSize': '1024',
  'player.isAutoCleanPlayedList': false,
  'player.isHandleAudioFocus': true,
  'player.isEnableAudioOffload': false,
  'player.isShowLyricTranslation': true,
  'player.isShowLyricRoma': false,
  'player.isAutoJyutping': false,
  'player.isShowNotificationImage': true,
  'player.isS2t': false,
  'player.isShowBluetoothLyric': false,
  'player.isShowBluetoothFullLyric': false,

  'search.isShowHotSearch': false,
  'search.isShowHistorySearch': false,

  'list.isClickPlayList': false,
  'list.isShowAlbumName': false,
  'list.isShowInterval': true,
  'list.addMusicLocationType': 'top',

  'download.fileName': '歌名 - 歌手',
  'download.savePath': '',
  'download.quality': '320k',
  'download.maxDownloadNum': 5,
  'download.isUseOtherSource': true,
  'download.isDownloadLyric': true,
  'download.isDownloadPic': true,
  'download.isWriteMetadata': true,
  'download.autoSaveWhilePlaying': false,


  // EMO 品牌默认主题
  'theme.id': 'emo',
  'theme.lightId': 'emo_light',
  'theme.darkId': 'emo',
  'theme.hideBgDark': false,
  'theme.dynamicBg': false,
  'theme.fontShadow': false,
  // Material You 动态主题
  'theme.seedColor': '#6C5CE7',
  'theme.useSeed': false,
  'theme.seedDark': true,
  // 歌词显示
  'player.isWordByWordLyric': true,
  'player.isSingleLineLyric': false,
  'player.lyricSizeIndex': 1,
  'player.lyricAlign': 'auto',
  // 底部导航胶囊左右滑动切歌
  'common.navSwipeSwitch': true,
  // 底部胶囊进度样式：默认显示封面外圈圆环（progress=0 也保留一圈淡色轨道）
  'common.navProgressStyle': 'ring',
  'common.navGlassStyle': 'liquid',
}

export default defaultSetting
