import { memo, useCallback, useRef, type ReactNode } from 'react'
import { View, Image, Pressable, Animated, Easing, type ImageSourcePropType } from 'react-native'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'

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
 * 标题 21sp 800 字重 + 可选副标题，右侧是 38dp 圆形图标按钮，
 * 让三个主 Tab 的头部结构、字号、间距完全一致。
 *
 * 右侧按钮（HeaderButton）和本地音乐 / 下载中心 / 排行榜页头的操作按钮是**同一套**
 * Material You 规格：38dp 正圆 + 20dp 图标 + 主色淡底(c-primary-alpha-900) + 0.8 按压反馈。
 * 之前这里是 44dp/21dp，比其它页头大一圈，首页搜索键看起来像另一套控件。
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

/** M3 圆形图标按钮：40dp 视觉 + 四周 4dp = 48dp 触控热区 */
const HIT_SLOP = { top: 4, bottom: 4, left: 4, right: 4 }
/** M3 state layer：按下时叠 10% 主色（规范 8%~12%） */
const STATE_LAYER_OPACITY = 0.1
/** state layer 淡入淡出时长，让按压反馈不生硬 */
const STATE_LAYER_DURATION = 90

/**
 * 头部右侧的圆形图标按钮，和本地音乐 / 下载中心 / 排行榜页头的操作按钮同一套
 * Material You 语言（v3.8.3 的 M3 优化版）：
 *
 *  - **尺寸**：40dp 正圆（只比其它页头的 38dp 按钮大 2dp，视觉不会跳），
 *    再加 4dp hitSlop → 触控热区 48dp（M3 最小触控目标）；
 *  - **色彩**：底色沿用各页头按钮的 `c-primary-alpha-900`（主色 10% 的 tonal surface），
 *    亮色/暗色主题都协调，不额外引入新色板；
 *  - **状态层**：按压态是 M3 state layer —— 在主色圆上再叠 10% 主色，
 *    90ms 淡入淡出、裁在圆内，比整块变暗更接近 M3 的 filled tonal icon button；
 *  - **图标**：默认走 App 统一的 MaterialCommunityIcons；传 `iconSet='material'` 时
 *    用 MaterialIcons 的 `search`（M3 圆头放大镜），首页搜索键用它，比 magnify 更贴合 M3。
 */
export const HeaderButton = memo(({ icon, onPress, size = 20, color, iconSet = 'community' }: {
  icon: string
  onPress?: () => void
  size?: number
  color?: string
  /** 图标字体：默认 App 统一的 MaterialCommunityIcons；'material' 用 MaterialIcons（M3 图标） */
  iconSet?: 'community' | 'material'
}) => {
  const theme = useTheme()
  const stateOpacity = useRef(new Animated.Value(0)).current
  const animateState = useCallback((toValue: number) => {
    Animated.timing(stateOpacity, {
      toValue,
      duration: STATE_LAYER_DURATION,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start()
  }, [stateOpacity])
  const iconColor = color ?? theme['c-font']

  return (
    <Pressable
      style={[styles.btn, { backgroundColor: theme['c-primary-alpha-900'] }]}
      hitSlop={HIT_SLOP}
      accessibilityRole='button'
      onPressIn={() => { animateState(STATE_LAYER_OPACITY) }}
      onPressOut={() => { animateState(0) }}
      onPress={onPress}
    >
      {/* M3 state layer：按压时在主色圆上叠 10% 主色，松手淡出 */}
      <Animated.View
        pointerEvents='none'
        style={[styles.stateLayer, { backgroundColor: theme['c-primary'], opacity: stateOpacity }]}
      />
      {
        iconSet === 'material'
          ? <MaterialIcons name={icon} size={size} color={iconColor} />
          : <Icon name={icon} size={size} color={iconColor} />
      }
    </Pressable>
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
    // M3 圆形图标按钮：40dp（其它页头是 38dp，只差 2dp，保持一致）
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    // state layer 必须按圆形裁切
    overflow: 'hidden',
  },
  stateLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 20,
  },
})
