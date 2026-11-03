import { useEffect, useState } from 'react'

import ActionSheet, { type ActionSheetAction, type ActionSheetItem } from '@/components/common/ActionSheet'
import { CoverImage } from './cover'

/**
 * 单曲「更多」菜单：飞牛音乐风格的底部 Sheet。
 *
 * 布局已经抽到共用组件 `@/components/common/ActionSheet`（Material You 配色），
 * 这里只负责把本地歌曲的数据/操作映射成 Sheet 的 header / actions / items：
 *   header  → 封面 + 歌名/歌手
 *   actions → 播放 / 下一首播放 / 加入播放列表
 *   items   → 专辑 / 歌手 / 收藏 / 添加到歌单 / 歌曲信息 / 从列表移除 / 删除文件
 * 本轮按需求去掉了「查看所在目录」行（路径复制入口移除）。
 */
export type SongAction =
  | 'play'
  | 'playNext'
  | 'addToPlaylist'
  | 'album'
  | 'artist'
  | 'toggleLove'
  | 'addToSonglist'
  | 'songInfo'
  /** 保留在类型里：LocalMusic/index.tsx 的 handleSheetAction 仍有该分支，本轮不再渲染这一行 */
  | 'showPath'
  | 'removeFromList'
  | 'deleteFile'

interface Props {
  visible: boolean
  item: LX.Music.MusicInfoLocal | null
  /** 这首歌是否已在「我的收藏」里 */
  loved: boolean
  onClose: () => void
  onAction: (action: SongAction) => void
}

export default ({ visible, item, loved, onClose, onAction }: Props) => {
  /**
   * 关闭时父组件会把 item 置 null（避免残留），但 Sheet 还要播 240ms 退场动画，
   * 这里用最后一项兜住内容，退场过程中不会突然变成空标题。
   */
  const [lastItem, setLastItem] = useState<LX.Music.MusicInfoLocal | null>(item)
  useEffect(() => {
    if (item) setLastItem(item)
  }, [item])

  const shown = item ?? lastItem
  if (!shown) return null

  const name = shown.name || '未知歌曲'
  const singer = shown.singer || '未知歌手'
  const albumName = shown.meta.albumName || '未知专辑'

  const actions: ActionSheetAction[] = [
    { key: 'play', label: '播放', icon: 'play', onPress: () => { onAction('play') } },
    { key: 'playNext', label: '下一首播放', icon: 'arrow-down-left', onPress: () => { onAction('playNext') } },
    { key: 'addToPlaylist', label: '加入播放列表', icon: 'playlist-plus', onPress: () => { onAction('addToPlaylist') } },
  ]

  const items: ActionSheetItem[] = [
    { key: 'album', label: `专辑：${albumName}`, icon: 'album', onPress: () => { onAction('album') } },
    { key: 'artist', label: `歌手：${singer}`, icon: 'microphone', onPress: () => { onAction('artist') } },
    {
      key: 'toggleLove',
      label: loved ? '取消收藏' : '收藏',
      icon: loved ? 'heart' : 'heart-outline',
      active: loved,
      onPress: () => { onAction('toggleLove') },
    },
    { key: 'addToSonglist', label: '添加到歌单', icon: 'playlist-music', onPress: () => { onAction('addToSonglist') } },
    { key: 'songInfo', label: '歌曲信息', icon: 'information-outline', onPress: () => { onAction('songInfo') } },
    { key: 'removeFromList', label: '从列表移除', icon: 'delete-outline', onPress: () => { onAction('removeFromList') } },
    { key: 'deleteFile', label: '删除文件', icon: 'trash-can-outline', danger: true, onPress: () => { onAction('deleteFile') } },
  ]

  return (
    <ActionSheet
      visible={visible}
      header={{
        cover: <CoverImage item={shown} size={56} radius={12} inset={0} />,
        title: name,
        subtitle: singer,
      }}
      actions={actions}
      items={items}
      onClose={onClose}
    />
  )
}
