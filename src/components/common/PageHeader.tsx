import { memo, type ReactNode } from 'react'
import { View, TouchableOpacity, Image, type ImageSourcePropType } from 'react-native'

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
  titleRight,
  subtitle,
  logo,
  left,
  right,
}: {
  title: string
  /**
   * 标题同一行、紧跟标题之后的节点（例如收藏页的「我的收藏 / 试听列表」胶囊）。
   * 放在标题行剩余空间里，标题本身过长时会先被省略。
   */
  titleRight?: ReactNode
  /** 字符串会按统一副标题样式渲染；传节点则原样渲染（比如一排小标签） */
  subtitle?: string | ReactNode
  logo?: ImageSourcePropType
  /** 左侧按钮（子页面的返回键） */
  left?: ReactNode
  right?: ReactNode
}) => {
  const statusBarHeight = useStatusbarHeight()
  // 横屏高度只有 400 出头，页头占 72dp 太奢侈，整体收紧一档
  const compact = useHorizontalMode()
  // 横屏下 statusbarHeight 报 0，但时钟浮在左上角，页头要自己让出一条
  const topInset = statusBarHeight > 0 ? statusBarHeight : (compact ? 20 : 0)

  return (
    <View
      style={{
        ...styles.container,
        height: topInset + (compact ? PAGE_HEADER_COMPACT_H : PAGE_HEADER_H),
        paddingTop: topInset + (compact ? 8 : 12),
        paddingBottom: compact ? 10 : 14,
      }}
    >
      <View style={styles.row}>
        {left ? <View style={styles.left}>{left}</View> : null}
        {logo ? <Image source={logo} style={compact ? styles.logoCompact : styles.logo} /> : null}
        <View style={styles.textArea}>
          <View style={styles.titleRow}>
            <Text size={compact ? 19 : 21} numberOfLines={1} style={styles.title}>{title}</Text>
            {titleRight ? <View style={styles.titleRight}>{titleRight}</View> : null}
          </View>
          {
            typeof subtitle === 'string'
              ? <Text size={compact ? 10.5 : 11} numberOfLines={1} style={styles.subtitle}>{subtitle}</Text>
              : subtitle ?? null
          }
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
  left: {
    marginRight: 6,
  },
  textArea: {
    flexGrow: 1,
    flexShrink: 1,
  },
  /** 标题行：标题 + 紧跟其后的行内控件（titleRight） */
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flexShrink: 1,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  titleRight: {
    // 占满标题之后的剩余横向空间；里面的胶囊可以从左往右排
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
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
