import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { useI18n } from '@/lang'
import FloatingMenu, { type FloatingMenuItem } from '@/components/common/FloatingMenu'
import type { Position } from '@/components/common/Menu'
import { hasDislike } from '@/core/dislikeList'
import { hasMusicUrlByMusic } from '@/utils/data'

/**
 * 在线歌曲「更多菜单」：Material You 悬浮菜单（贴着行尾 ⋮ / 长按位置弹出的小卡片）。
 *
 * 这个组件被歌曲搜索、歌单详情、排行榜歌曲等所有 OnlineList 场景复用：
 * 只换菜单 UI / 主题色，原有 action 集合全部保留：
 *   播放 / 下一首播放 / 下载 / 添加到 / 复制歌名 / 歌曲来源详情 / 清除缓存 / 不喜欢
 * 另外新增「多选管理」入口（长按不再直接进多选，改由菜单进入）：
 * 回调给 OnlineList 的 List，进入多选模式并选中当前这首歌。
 *
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
  /** 进入多选模式并选中当前歌曲（由 OnlineList 接线） */
  onMultiSelect: (selectInfo: SelectInfo) => void
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
  /** 当前操作对象：关闭后保留，退场动画期间内容不会变空 */
  const [selectInfo, setSelectInfo] = useState<SelectInfo | null>(null)
  /** 触发位置（行尾 ⋮ 的矩形，或长按的手指点），真正用于悬浮菜单定位 */
  const [position, setPosition] = useState<Position>({ x: 0, y: 0, w: 0, h: 0 })
  /** 当前歌曲是否有缓存的音源地址（决定「清除缓存」是否可点） */
  const [hasCache, setHasCache] = useState(false)
  const showIdRef = useRef(0)

  useImperativeHandle(ref, () => ({
    show(info: SelectInfo, at: Position) {
      setSelectInfo(info)
      setPosition(at)
      setVisible(true)
      setHasCache(false)
      const id = ++showIdRef.current
      void hasMusicUrlByMusic(info.musicInfo).then(has => {
        // 期间又按了别的歌：旧请求的结果不能覆盖新状态
        if (id != showIdRef.current) return
        setHasCache(has)
      }).catch(() => {})
    },
  }))

  if (!selectInfo) return null

  const musicInfo = selectInfo.musicInfo
  const close = () => { setVisible(false) }

  const items: FloatingMenuItem[] = [
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
    {
      key: 'multiSelect',
      label: '多选管理',
      icon: 'checkbox-multiple-marked-outline',
      onPress: () => { close(); props.onMultiSelect(selectInfo) },
    },
  ]

  return (
    <FloatingMenu
      visible={visible}
      position={position}
      items={items}
      onClose={close}
    />
  )
})
