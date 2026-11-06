import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { getIconColor, getTileBackground } from './surfaces'

export interface SettingRowProps {
  icon: string
  title: string
  desc?: string
  /** 图标识别色（设置首页传 SCREEN_META[id].color） */
  color?: string
  /** 右侧补充内容（状态文字 / Tag / 小按钮），会自动和标题行垂直居中 */
  right?: React.ReactNode
  /** 标题下方的整行内容（例如按钮行、开关行） */
  children?: React.ReactNode
  /** 是否显示右箭头；不传时：有 onPress 且没有 right 才显示 */
  chevron?: boolean
  onPress?: () => void
}

/**
 * 设置页通用「左图标 + 标题/描述 + 右侧内容」行。
 *
 * 大圆角图标底 + 15sp 标题 + 11.5sp 描述，右侧 chevron 与卡片语言统一；
 * 子页面里大量 SettingRow 会直接沿用这一套样式。
 */
export default memo(({ icon, title, desc, color, right, children, chevron, onPress }: SettingRowProps) => {
  const theme = useTheme()
  const showChevron = chevron ?? (!!onPress && !right)

  const content = (
    <>
      <View style={{ ...styles.iconWrap, backgroundColor: getTileBackground(theme, color) }}>
        <Icon name={icon} size={19} color={getIconColor(theme, color)} />
      </View>
      <View style={styles.info}>
        <Text size={15} numberOfLines={1}>{title}</Text>
        {desc ? <Text size={11.5} color={theme['c-450']} numberOfLines={2} style={styles.desc}>{desc}</Text> : null}
        {children}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
      {showChevron ? <Icon name='chevron-right' size={18} color={theme['c-350']} style={styles.chevron} /> : null}
    </>
  )

  if (onPress) {
    return (
      <TouchableOpacity style={styles.row} activeOpacity={0.72} onPress={onPress}>
        {content}
      </TouchableOpacity>
    )
  }
  return <View style={styles.row}>{content}</View>
})

const styles = createStyle({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
    flexShrink: 0,
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  desc: {
    marginTop: 3,
    lineHeight: 16,
  },
  right: {
    flexShrink: 0,
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevron: {
    marginLeft: 8,
  },
})
