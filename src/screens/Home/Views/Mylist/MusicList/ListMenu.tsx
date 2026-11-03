import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { useI18n } from '@/lang'
import ActionSheet, { type ActionSheetAction, type ActionSheetItem } from '@/components/common/ActionSheet'
import type { Position } from '@/components/common/Menu'
import PicImage from '@/components/common/PicImage'
import { hasDislike } from '@/core/dislikeList'
import { existsFile } from '@/utils/fs'
import { hasMusicUrlByMusic } from '@/utils/data'

/**
 * 我的列表歌曲「更多菜单」：共用底部 ActionSheet（Material You 配色）。
 *
 * 只换菜单 UI / 主题色，原有 action 集合全部保留（按原顺序）：
 *   快捷卡 → 播放 / 下一首播放 / 添加到
 *   操作行 → 下载 / 移动到 / 调整位置 / 切换音源 / [编辑标签] / 复制歌名
 *            / 歌曲来源详情 / 清除缓存 / 不喜欢 / 从列表移除
 * 其中「编辑标签」只对本地歌曲显示、「切换音源」等依旧按原逻辑置灰/显隐。
 */
export interface SelectInfo {
  musicInfo: LX.Music.MusicInfo
  selectedList: LX.Music.MusicInfo[]
  index: number
  listId: string
  single: boolean
}

export interface ListMenuProps {
  onPlay: (selectInfo: SelectInfo) => void
  onPlayLater: (selectInfo: SelectInfo) => void
  onAdd: (selectInfo: SelectInfo) => void
  onDownload: (selectInfo: SelectInfo) => void
  onMove: (selectInfo: SelectInfo) => void
  onEditMetadata: (selectInfo: SelectInfo) => void
  onCopyName: (selectInfo: SelectInfo) => void
  onChangePosition: (selectInfo: SelectInfo) => void
  onToggleSource: (selectInfo: SelectInfo) => void
  onMusicSourceDetail: (selectInfo: SelectInfo) => void
  onRemoveCache: (selectInfo: SelectInfo) => void
  onDislikeMusic: (selectInfo: SelectInfo) => void
  onRemove: (selectInfo: SelectInfo) => void
}
export interface ListMenuType {
  show: (selectInfo: SelectInfo, position: Position) => void
}

export type {
  Position,
}

const hasEditMetadata = async(musicInfo: LX.Music.MusicInfo) => {
  if (musicInfo.source != 'local') return false
  return existsFile(musicInfo.meta.filePath)
}
const hasUrlCache = async(musicInfo: LX.Music.MusicInfo) => {
  return hasMusicUrlByMusic(musicInfo)
}

export default forwardRef<ListMenuType, ListMenuProps>((props, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  /** 当前操作对象：关闭后保留，退场动画期间 header 不会变空 */
  const [selectInfo, setSelectInfo] = useState<SelectInfo | null>(null)
  /** 本地歌曲是否还找得到文件（决定「编辑标签」是否可点） */
  const [canEditMetadata, setCanEditMetadata] = useState(false)
  /** 当前歌曲是否有缓存的音源地址（决定「清除缓存」是否可点） */
  const [hasCache, setHasCache] = useState(false)
  const showIdRef = useRef(0)

  useImperativeHandle(ref, () => ({
    // 旧 API 的 position 参数保留只为兼容调用方，底部 Sheet 不再需要定位
    show(info: SelectInfo, _position: Position) {
      setSelectInfo(info)
      setVisible(true)
      setCanEditMetadata(false)
      setHasCache(false)
      const id = ++showIdRef.current
      void Promise.all([
        info.musicInfo.source == 'local' ? hasEditMetadata(info.musicInfo) : Promise.resolve(false),
        hasUrlCache(info.musicInfo),
      ]).then(([editMetadata, cache]) => {
        // 期间又长按了别的歌：旧请求的结果不能覆盖新状态
        if (id != showIdRef.current) return
        setCanEditMetadata(editMetadata)
        setHasCache(cache)
      }).catch(() => {})
    },
  }))

  if (!selectInfo) return null

  const musicInfo = selectInfo.musicInfo
  const isLocal = musicInfo.source == 'local'
  const selectedCount = selectInfo.selectedList.length
  const close = () => { setVisible(false) }

  const actions: ActionSheetAction[] = [
    {
      key: 'play',
      label: t('play'),
      icon: 'play',
      onPress: () => { close(); props.onPlay(selectInfo) },
    },
    {
      key: 'playLater',
      label: t('play_later'),
      icon: 'arrow-down-left',
      onPress: () => { close(); props.onPlayLater(selectInfo) },
    },
    {
      key: 'add',
      label: t('add_to'),
      icon: 'playlist-plus',
      onPress: () => { close(); props.onAdd(selectInfo) },
    },
  ]

  const items: ActionSheetItem[] = [
    {
      key: 'download',
      label: t('download'),
      icon: 'download',
      disabled: isLocal,
      onPress: () => { close(); props.onDownload(selectInfo) },
    },
    {
      key: 'move',
      label: t('move_to'),
      icon: 'folder-move-outline',
      onPress: () => { close(); props.onMove(selectInfo) },
    },
    {
      key: 'changePosition',
      label: t('change_position'),
      icon: 'sort-variant',
      onPress: () => { close(); props.onChangePosition(selectInfo) },
    },
    {
      key: 'toggleSource',
      label: t('toggle_source'),
      icon: 'swap-horizontal',
      onPress: () => { close(); props.onToggleSource(selectInfo) },
    },
    ...(isLocal
      ? [{
          key: 'editMetadata',
          label: t('edit_metadata'),
          icon: 'pencil-outline',
          disabled: !canEditMetadata,
          onPress: () => { close(); props.onEditMetadata(selectInfo) },
        }]
      : []),
    {
      key: 'copyName',
      label: t('copy_name'),
      icon: 'content-copy',
      onPress: () => { close(); props.onCopyName(selectInfo) },
    },
    {
      key: 'musicSourceDetail',
      label: t('music_source_detail'),
      icon: 'information-outline',
      disabled: isLocal,
      onPress: () => { close(); props.onMusicSourceDetail(selectInfo) },
    },
    {
      key: 'removeCache',
      label: t('list_remove_cache'),
      icon: 'eraser',
      disabled: !hasCache,
      onPress: () => { close(); props.onRemoveCache(selectInfo) },
    },
    {
      key: 'dislike',
      label: t('dislike'),
      icon: 'thumb-down-outline',
      disabled: hasDislike(musicInfo),
      onPress: () => { close(); props.onDislikeMusic(selectInfo) },
    },
    {
      key: 'remove',
      label: t('delete'),
      icon: 'delete-outline',
      danger: true,
      onPress: () => { close(); props.onRemove(selectInfo) },
    },
  ]

  return (
    <ActionSheet
      visible={visible}
      header={{
        cover: <PicImage musicInfo={musicInfo} style={{ width: 56, height: 56, borderRadius: 12 }} />,
        title: musicInfo.name || '未知歌曲',
        subtitle: `${musicInfo.singer || '未知歌手'}${selectedCount > 1 ? ` · 已选 ${selectedCount} 首` : ''}`,
      }}
      actions={actions}
      items={items}
      onClose={close}
    />
  )
})
