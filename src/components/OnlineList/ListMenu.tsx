import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { useI18n } from '@/lang'
import ActionSheet, { type ActionSheetAction, type ActionSheetItem } from '@/components/common/ActionSheet'
import type { Position } from '@/components/common/Menu'
import PicImage from '@/components/common/PicImage'
import { hasDislike } from '@/core/dislikeList'
import { hasMusicUrlByMusic } from '@/utils/data'

/**
 * 在线歌曲「更多菜单」：共用底部 ActionSheet（Material You 配色）。
 *
 * 这个组件被歌曲搜索、歌单详情、排行榜歌曲等所有 OnlineList 场景复用，
 * 所以只换菜单 UI，不动原有 action 集合：
 *   快捷卡 → 播放 / 下一首播放 / 下载
 *   操作行 → 添加到 / 复制歌名 / 歌曲来源详情 / 清除缓存 / 不喜欢
 * 「清除缓存」要异步查当前歌曲有没有缓存的音源地址，查到之前置灰。
 */
export interface SelectInfo {
  musicInfo: LX.Music.MusicInfoOnline
  selectedList: LX.Music.MusicInfoOnline[]
  index: number
  single: boolean
}

export interface ListMenuProps {
  onPlay: (selectInfo: SelectInfo) => void
  onPlayLater: (selectInfo: SelectInfo) => void
  onAdd: (selectInfo: SelectInfo) => void
  onDownload: (selectInfo: SelectInfo) => void
  onCopyName: (selectInfo: SelectInfo) => void
  onMusicSourceDetail: (selectInfo: SelectInfo) => void
  onRemoveCache: (selectInfo: SelectInfo) => void
  onDislikeMusic: (selectInfo: SelectInfo) => void
}
export interface ListMenuType {
  show: (selectInfo: SelectInfo, position: Position) => void
}

export type {
  Position,
}

export default forwardRef<ListMenuType, ListMenuProps>((props: ListMenuProps, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  /** 当前操作对象：关闭后保留，退场动画期间 header 不会变空 */
  const [selectInfo, setSelectInfo] = useState<SelectInfo | null>(null)
  /** 当前歌曲是否有缓存的音源地址（决定「清除缓存」是否可点） */
  const [hasCache, setHasCache] = useState(false)
  const showIdRef = useRef(0)

  useImperativeHandle(ref, () => ({
    // 旧 API 的 position 参数保留只为兼容调用方，底部 Sheet 不再需要定位
    show(info: SelectInfo, _position: Position) {
      setSelectInfo(info)
      setVisible(true)
      setHasCache(false)
      const id = ++showIdRef.current
      void hasMusicUrlByMusic(info.musicInfo).then(has => {
        // 期间又长按了别的歌：旧请求的结果不能覆盖新状态
        if (id != showIdRef.current) return
        setHasCache(has)
      }).catch(() => {})
    },
  }))

  if (!selectInfo) return null

  const musicInfo = selectInfo.musicInfo
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
      key: 'download',
      label: t('download'),
      icon: 'download',
      onPress: () => { close(); props.onDownload(selectInfo) },
    },
  ]

  const items: ActionSheetItem[] = [
    {
      key: 'add',
      label: t('add_to'),
      icon: 'playlist-plus',
      onPress: () => { close(); props.onAdd(selectInfo) },
    },
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
