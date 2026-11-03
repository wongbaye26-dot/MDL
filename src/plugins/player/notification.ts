/**
 * 通知栏 / 锁屏媒体卡片的 options 构建与状态同步。
 *
 * 通知本身由 react-native-track-player 的 native 层（MetadataManager）构建，
 * 这里只负责把「当前主题色 / 收藏状态 / 播放模式」等状态通过 TrackPlayer.updateOptions
 * 传给 native，并监听对应的变化事件在需要时重新下发：
 *  - 主题切换（Material You 主色）→ 通知整体 color
 *  - 切歌 / 我的收藏列表变化 → 收藏按钮图标（实心 / 线框）
 *  - 播放模式变化 → 循环按钮图标（列表循环 / 单曲循环 / 随机 / 顺序）
 *  - 标准媒体按钮（上一首 / 播放 / 暂停 / 下一首）统一成 Material 矢量图标（emo_media_*），
 *    不再混用库内置 PNG，避免锁屏大播放器里图标风格不一致
 *
 * native 侧会按 settings 里的 drawable 资源名（emo_notif_* / emo_media_*）在 app 包内用
 * getIdentifier 解析图标，所以这里传的是资源名字符串而不是 require() 资源。
 */
import { Capability, type MetadataOptions } from 'react-native-track-player'

import themeState from '@/store/theme/state'
import settingState from '@/store/setting/state'
import playerState from '@/store/player/state'
import { getListMusicSync } from '@/utils/listManage'
import { LIST_IDS } from '@/config/constant'
import { toHexColor } from '@/theme/solid'

/** 与播放器页 handleCycleMode 保持一致的循环顺序 */
export const PLAY_MODES = ['listLoop', 'random', 'singleLoop', 'list'] as const
export type PlayMode = typeof PLAY_MODES[number]

/** 收藏按钮图标（android/app/src/main/res/drawable/） */
const FAVORITE_ICON_LIKED = 'emo_notif_fav_filled'
const FAVORITE_ICON_UNLIKED = 'emo_notif_fav_outline'
/** 循环按钮图标：四种播放模式各一个 */
const LOOP_ICON: Record<PlayMode | 'none', string> = {
  listLoop: 'emo_notif_loop',
  random: 'emo_notif_random',
  singleLoop: 'emo_notif_loop_single',
  list: 'emo_notif_order',
  none: 'emo_notif_order',
}

/**
 * 通知栏 compact / 锁屏大播放器的标准媒体按钮图标。
 * 库默认用内置 PNG，和收藏 / 循环的 Material 矢量风格不一致；这里统一成
 * 同一套 24dp 白色 Material 实心矢量（native getIcon 已扩展支持传资源名字符串）。
 */
const MEDIA_ICON_PREVIOUS = 'emo_media_previous'
const MEDIA_ICON_PLAY = 'emo_media_play'
const MEDIA_ICON_PAUSE = 'emo_media_pause'
const MEDIA_ICON_NEXT = 'emo_media_next'

/** 自定义按钮的文案（native 里也会兜底，这里传过去方便以后本地化） */
const FAVORITE_TITLE = '收藏'
const LOOP_TITLE = '播放模式'

/**
 * native 能从 Bundle 里多读到的自定义字段。
 *
 * 注意：previousIcon / playIcon / pauseIcon / nextIcon 传的是 drawable 资源名字符串
 * （如 'emo_media_previous'），而 MetadataOptions 里同名字段类型是资源 id（number）。
 * native 侧 getIcon 已扩展支持按 app 包资源名解析，解析失败会回退库内置图标。
 */
interface EmoNotificationOptions extends Omit<MetadataOptions, 'icon' | 'previousIcon' | 'playIcon' | 'pauseIcon' | 'stopIcon' | 'nextIcon' | 'rewindIcon' | 'forwardIcon'> {
  favoriteIcon?: string
  loopIcon?: string
  favoriteTitle?: string
  loopTitle?: string
  previousIcon?: string
  playIcon?: string
  pauseIcon?: string
  nextIcon?: string
}

/** 当前播放歌曲是否已在我的收藏里（与播放器页 handleToggleCollect 的判断方式一致） */
export const isCurrentMusicLiked = () => {
  const id = playerState.playMusicInfo.musicInfo?.id
  if (!id) return false
  return getListMusicSync(LIST_IDS.LOVE).some(m => m.id === id)
}

/** 主题主色 → Android ARGB color int（不透明），用于通知整体配色 */
export const getNotificationColor = () => {
  const hex = toHexColor(themeState.theme['c-primary'], '#4DAF7C')
  return 0xFF000000 | Number.parseInt(hex.slice(1), 16)
}

const getPlayMode = (): PlayMode | 'none' => {
  return (settingState.setting['player.togglePlayMethod'] ?? 'listLoop') as PlayMode
}

export const buildNotificationOptions = (): MetadataOptions => {
  const playMode = getPlayMode()
  const options: EmoNotificationOptions = {
    // 媒体会话全部能力
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.Stop,
      Capability.SeekTo,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
    ],

    // 通知栏 / 状态栏媒体卡片：去掉 Stop（它等于退出 App），
    // 只保留 上一首 / 播放暂停 / 下一首（展开后再加上收藏 / 循环）
    notificationCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToPrevious,
      Capability.SkipToNext,
      Capability.SeekTo,
    ],

    // 锁屏 / 通知 compact 视图最多 3 个按钮：上一首 / 播放暂停 / 下一首。
    // 加进 SkipToPrevious 锁屏小组件才有「上一曲」。
    compactCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToPrevious,
      Capability.SkipToNext,
    ],

    // Material You 配色：通知整体 color 跟随主题主色（图标由系统统一着色）
    color: getNotificationColor(),

    // 收藏 / 循环按钮：图标状态跟当前歌曲收藏状态、播放模式同步
    favoriteIcon: isCurrentMusicLiked() ? FAVORITE_ICON_LIKED : FAVORITE_ICON_UNLIKED,
    loopIcon: LOOP_ICON[playMode] ?? LOOP_ICON.listLoop,
    favoriteTitle: FAVORITE_TITLE,
    loopTitle: LOOP_TITLE,

    // 标准媒体按钮：显式传 app drawable 资源名，让通知 compact / 锁屏大播放器
    // 的上一首 / 播放 / 暂停 / 下一首与收藏 / 循环使用同一套 Material 图标
    previousIcon: MEDIA_ICON_PREVIOUS,
    playIcon: MEDIA_ICON_PLAY,
    pauseIcon: MEDIA_ICON_PAUSE,
    nextIcon: MEDIA_ICON_NEXT,
  }

  // 这几个字段 native 侧读的是 drawable 资源名（String），而 MetadataOptions 里
  // 声明的是资源 id（number）；native getIcon 已扩展支持字符串，这里强转绕过 JS 类型。
  return options as unknown as MetadataOptions
}

let isListening = false

/**
 * 注册通知状态同步监听（只注册一次）。
 * @param refresh 重新下发 updateOptions 的方法（由 utils.updateOptions 提供）
 */
export const registerNotificationListeners = (refresh: () => Promise<void> | void) => {
  if (isListening) return
  isListening = true

  const refreshOptions = () => {
    void refresh()
  }

  // 主题切换：刷新通知配色
  global.state_event.on('themeUpdated', refreshOptions)

  // 播放模式变化：刷新循环按钮图标（播放器页 / 设置页 / 通知栏按钮都会走这里）
  global.state_event.on('configUpdated', keys => {
    if (keys.includes('player.togglePlayMethod')) refreshOptions()
  })

  // 我的收藏列表变化：刷新收藏按钮图标（通知栏按钮和播放器页按钮共用这条路径）
  const handleListMusicChanged = async(listId: string) => {
    if (listId === LIST_IDS.LOVE) refreshOptions()
  }
  global.list_event.on('list_music_add', handleListMusicChanged)
  global.list_event.on('list_music_remove', handleListMusicChanged)
  global.list_event.on('list_music_overwrite', handleListMusicChanged)
  // 清空列表的参数是 ids 数组
  global.list_event.on('list_music_clear', async ids => {
    if (ids.includes(LIST_IDS.LOVE)) refreshOptions()
  })
}
