import { memo, useEffect, useRef } from 'react'
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native'

import { useReducedMotion } from '@/utils/hooks'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

/**
 * 骨架屏基元。
 *
 * 之前全站只有排行榜 chips 里的 4 个静态灰块，没有真正的 loading 骨架。
 * 这里提供三档：
 *  - `SkeletonBlock`：单个块，呼吸透明度（native driver）；
 *  - `SkeletonRows`：列表行骨架（封面 + 两行文字）；
 *  - `SkeletonGrid`：双列卡片骨架（歌单广场用）。
 *
 * 减少动态效果时不做呼吸，只保留静态占位。
 */
export const SkeletonBlock = memo(({
  width,
  height,
  aspectRatio,
  radius = 8,
  style,
}: {
  width?: number | `${number}%`
  height?: number
  /** 正方形容器（歌单封面）可直接传 1，配合 width='100%' 使用 */
  aspectRatio?: number
  radius?: number
  style?: StyleProp<ViewStyle>
}) => {
  const theme = useTheme()
  const reduced = useReducedMotion()
  const opacity = useRef(new Animated.Value(0.55)).current

  useEffect(() => {
    if (reduced) {
      opacity.setValue(0.55)
      return
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.95, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.55, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]))
    loop.start()
    return () => { loop.stop() }
  }, [opacity, reduced])

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          aspectRatio,
          borderRadius: radius,
          backgroundColor: theme['c-primary-alpha-900'],
          opacity,
        },
        style,
      ]}
    />
  )
})

/** 列表行骨架：左侧封面 + 右侧两行文字 */
export const SkeletonRows = memo(({ rows = 6, avatarSize = 40 }: { rows?: number, avatarSize?: number }) => {
  return (
    <View style={styles.rows}>
      {
        Array.from({ length: rows }, (_, i) => (
          <View key={i} style={styles.row}>
            <SkeletonBlock width={avatarSize} height={avatarSize} radius={Math.min(10, avatarSize / 4)} />
            <View style={styles.rowText}>
              <SkeletonBlock width={`${62 + (i % 3) * 8}%`} height={13} radius={6} />
              <SkeletonBlock width={`${38 + (i % 4) * 7}%`} height={10} radius={5} style={styles.rowSub} />
            </View>
          </View>
        ))
      }
    </View>
  )
})

/** 双列卡片骨架（歌单广场） */
export const SkeletonGrid = memo(({ columns = 2, rows = 3, gap = 12 }: { columns?: number, rows?: number, gap?: number }) => {
  return (
    <View>
      {
        Array.from({ length: rows }, (_, r) => (
          <View key={r} style={[styles.gridRow, { marginBottom: gap }]}>
            {
              Array.from({ length: columns }, (_, c) => (
                <View key={c} style={{ flex: 1, marginLeft: c === 0 ? 0 : gap / 2, marginRight: c === columns - 1 ? 0 : gap / 2 }}>
                  <SkeletonBlock width='100%' aspectRatio={1} radius={16} />
                  <SkeletonBlock width='72%' height={12} radius={6} style={styles.gridTitle} />
                  <SkeletonBlock width='44%' height={9} radius={5} style={styles.gridSub} />
                </View>
              ))
            }
          </View>
        ))
      }
    </View>
  )
})

const styles = createStyle({
  rows: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  rowText: {
    flex: 1,
    marginLeft: 12,
  },
  rowSub: {
    marginTop: 8,
  },
  gridRow: {
    flexDirection: 'row',
  },
  gridTitle: {
    marginTop: 8,
  },
  gridSub: {
    marginTop: 6,
  },
})
