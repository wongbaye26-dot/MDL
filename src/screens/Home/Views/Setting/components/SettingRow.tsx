import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

export interface SettingRowProps {
  icon: string
  title: string
  desc?: string
  /** 右侧补充内容（状态文字 / Tag / 小按钮），会自动和标题行垂直居中 */
  right?: React.ReactNode
  /** 标题下方的整行内容（例如按钮行、开关行） */
  children?: React.ReactNode
  onPress?: () => void
}

/**
 * 设置页通用「左图标 + 标题/描述 + 右侧内容」行。
 *
 * Permissions / DeviceCompat / 缓存 / 日志等区块此前各写了一套 Row，
 * 间距、图标尺寸、右侧状态对齐方式各不相同；统一到这里后所有页面同一套语言：
 * 32dp 圆角图标底 + 14sp 标题 + 11sp 描述 + 右侧内容 flexShrink: 0。
 */
export default memo(({ icon, title, desc, right, children, onPress }: SettingRowProps) => {
  const theme = useTheme()

  const content = (
    <>
      <View style={{ ...styles.iconWrap, backgroundColor: theme['c-primary-alpha-900'] }}>
        <Icon name={icon} size={17} color={theme['c-primary']} />
      </View>
      <View style={styles.info}>
        <Text size={14} numberOfLines={1}>{title}</Text>
        {desc ? <Text size={11} color={theme['c-450']} numberOfLines={2} style={styles.desc}>{desc}</Text> : null}
        {children}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </>
  )

  if (onPress) {
    return (
      <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
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
    paddingLeft: 12,
    paddingRight: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  desc: {
    marginTop: 2,
    lineHeight: 15,
  },
  right: {
    flexShrink: 0,
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
})
