import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { useI18n } from '@/lang'
import ActionSheet, { type ActionSheetAction, type ActionSheetItem } from '@/components/common/ActionSheet'
import type { Position } from '@/components/common/Menu'
import { hasDislike } from '@/core/dislikeList'
import { hasMusicUrlByMusic } from '@/utils/data'

/**
 * 在线歌曲「更多菜单」。
 *
 * 统一容器：全站「更多」都走 ActionSheet（本地歌曲/下载/收藏/榜单同款），
 * 不再用贴着行尾的 FloatingMenu —— 三处列表（排行榜/歌单详情/搜索）视觉与操作顺序一致。
 *
 * 两种形态：
 *  - 单曲（行尾 ⋮）：播放 / 下一首播放 / 下载 / 添加到 / 复制歌名 / 来源详情 / 清缓存 / 不喜欢 / 多选管理；
 *  - 批量（长按进入多选后自动弹出，或多选栏「更多」）：下一首播放 / 下载 / 添加到 / 退出多选。
 *
 * 「清除缓存」要异步查当前歌曲有没有缓存的音源地址，查到之前置灰。
 */
export interface SelectInfo {
  musicInfo: LX.Music.MusicInfoOnline
  selectedList: LX.Music.MusicInfoOnline[]
  index: number
  single: boolean
  /** true = 从多选/长按进入，按「批量」展示（即使只选了 1 首） */
  bulk?: boolean
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
  /** 进入多选模式并选中当前歌曲 */
  onMultiSelect: (selectInfo: SelectInfo) => void
  /** 批量形态下退出多选 */
  onExitSelect?: () => void
}
export interface ListMenuType {
  show: (selectInfo: SelectInfo, position?: Position) => void
}

export type {
  Position,
}

export default forwardRef<ListMenuType, ListMenuProps>((props: ListMenuProps, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  /** 当前操作对象：关闭后保留，退场动画期间内容不会变空 */
  const [selectInfo, setSelectInfo] = useState<SelectInfo | null>(null)
  /** 当前歌曲是否有缓存的音源地址（决定「清除缓存」是否可点） */
  const [hasCache, setHasCache] = useState(false)
  const showIdRef = useRef(0)

  useImperativeHandle(ref, () => ({
    show(info: SelectInfo) {
      setSelectInfo(info)
      setVisible(true)
      setHasCache(false)
      if (info.selectedList.length > 1) return
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
  const selectedList = selectInfo.selectedList
  const isBulk = !!selectInfo.bulk
  const close = () => { setVisible(false) }

  const header = {
    title: isBulk ? `已选择 ${selectedList.length} 首` : musicInfo.name,
    subtitle: isBulk ? '批量操作' : musicInfo.singer,
  }

  const actions: ActionSheetAction[] = [
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
  ]

  const items: ActionSheetItem[] = []
  if (!isBulk) {
    items.push(
      { key: 'play', label: t('play'), icon: 'play', onPress: () => { close(); props.onPlay(selectInfo) } },
      { key: 'copyName', label: t('copy_name'), icon: 'content-copy', onPress: () => { close(); props.onCopyName(selectInfo) } },
      { key: 'musicSourceDetail', label: t('music_source_detail'), icon: 'information-outline', onPress: () => { close(); props.onMusicSourceDetail(selectInfo) } },
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
    )
  } else if (props.onExitSelect) {
    items.push({
      key: 'exitSelect',
      label: '退出多选',
      icon: 'close-circle-outline',
      danger: true,
      onPress: () => { close(); props.onExitSelect?.() },
    })
  }

  return (
    <ActionSheet
      visible={visible}
      header={header}
      actions={actions}
      items={items}
      onClose={close}
    />
  )
})
