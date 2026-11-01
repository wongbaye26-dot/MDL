import { memo } from 'react'
import { View, TouchableOpacity, Image, type ImageSourcePropType, type ReactNode } from 'react-native'

import Text from './Text'
import { Icon } from './Icon'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { useHorizontalMode } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'

/** 头部除状态栏以外的高度（有副标题时的固定值），全屏覆盖的子页要用它算偏移 */
export const PAGE_HEADER_H = 72
/** 横屏紧凑版的高度 */
export const PAGE_HEADER_COMPACT_H = 56

/**
 * 统一的页面头部（首页 / 下载中心 / 我的 共用）。
 * 标题 21sp 800 字重 + 可选副标题，右侧是 44dp 圆形图标按钮，
 * 让三个主 Tab 的头部结构、字号、间距完全一致。
 */
export default memo(({
  title,
  subtitle,
  logo,
  right,
}: {
  title: string
  subtitle?: string
  logo?: ImageSourcePropType
  right?: ReactNode
}) => {
  const statusBarHeight = useStatusbarHeight()
  // 横屏高度只有 400 出头，页头占 72dp 太奢侈，整体收紧一档
  const compact = useHorizontalMode()

  return (
    <View
      style={{
        ...styles.container,
        height: statusBarHeight + (compact ? PAGE_HEADER_COMPACT_H : PAGE_HEADER_H),
        paddingTop: statusBarHeight + (compact ? 8 : 12),
        paddingBottom: compact ? 10 : 14,
      }}
    >
      <View style={styles.row}>
        {logo ? <Image source={logo} style={compact ? styles.logoCompact : styles.logo} /> : null}
        <View style={styles.textArea}>
          <Text size={compact ? 19 : 21} numberOfLines={1} style={styles.title}>{title}</Text>
          {subtitle ? <Text size={compact ? 10.5 : 11} numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  )
})

/** 头部右侧的圆形图标按钮 */
export const HeaderButton = memo(({ icon, onPress, size = 21, color }: {
  icon: string
  onPress?: () => void
  size?: number
  color?: string
}) => {
  const theme = useTheme()
  return (
    <TouchableOpacity
      style={{ ...styles.btn, backgroundColor: theme['c-primary-alpha-900'] }}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <Icon name={icon} size={size} color={color ?? theme['c-font']} />
    </TouchableOpacity>
  )
})

const styles = createStyle({
  container: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 14,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 13,
    marginRight: 12,
  },
  logoCompact: {
    width: 34,
    height: 34,
    borderRadius: 11,
    marginRight: 10,
  },
  textArea: {
    flexGrow: 1,
    flexShrink: 1,
  },
  title: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 3,
    letterSpacing: 0.4,
  },
  right: {
    marginLeft: 10,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
