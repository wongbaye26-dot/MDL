import { useImperativeHandle, forwardRef, useState } from 'react'
import { View } from 'react-native'

import { useI18n } from '@/lang'
import ActionSheet, { type ActionSheetItem, useSheetPalette } from '@/components/common/ActionSheet'
import { Icon } from '@/components/common/Icon'
import type { Position } from '@/components/common/Menu'

/**
 * 排行榜榜单的「更多菜单」：共用底部 ActionSheet。
 *
 * 榜单没有封面，header 左侧用一个主色衬底的榜单图标占位。
 * 原有操作只有两个，全部保留为顶部快捷卡：播放 / 收藏。
 * 关闭时通知列表清掉长按高亮（原来的 onHideMenu 语义）。
 */
export interface SelectInfo {
  listId: string
  name: string
  index: number
}

export interface ListMenuProps {
  onPlay: (selectInfo: SelectInfo) => void
  onCollect: (selectInfo: SelectInfo) => void
  onHideMenu: () => void
}
export interface ListMenuType {
  show: (selectInfo: SelectInfo, position: Position) => void
}

export type {
  Position,
}

/** 榜单占位封面：主色衬底圆角方块 + 榜单图标 */
const BoardCover = () => {
  const palette = useSheetPalette()
  return (
    <View style={{
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: palette.card,
      borderWidth: 0.5,
      borderColor: palette.border,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Icon name='chart-bar' size={26} color={palette.primary} />
    </View>
  )
}

export default forwardRef<ListMenuType, ListMenuProps>((props, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  /** 当前操作对象：关闭后保留，退场动画期间 header 不会变空 */
  const [selectInfo, setSelectInfo] = useState<SelectInfo | null>(null)

  useImperativeHandle(ref, () => ({
    // 旧 API 的 position 参数保留只为兼容调用方，底部 Sheet 不再需要定位
    show(info: SelectInfo, _position: Position) {
      setSelectInfo(info)
      setVisible(true)
    },
  }))

  if (!selectInfo) return null

  const close = () => {
    setVisible(false)
    props.onHideMenu()
  }

  const items: ActionSheetItem[] = []

  return (
    <ActionSheet
      visible={visible}
      header={{
        cover: <BoardCover />,
        title: selectInfo.name || '排行榜',
        subtitle: '排行榜',
      }}
      actions={[
        {
          key: 'play',
          label: t('play'),
          icon: 'play',
          onPress: () => { close(); props.onPlay(selectInfo) },
        },
        {
          key: 'collect',
          label: t('collect'),
          icon: 'heart-outline',
          onPress: () => { close(); props.onCollect(selectInfo) },
        },
      ]}
      items={items}
      onClose={close}
    />
  )
})
