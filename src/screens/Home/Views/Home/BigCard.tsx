import { useCallback, useEffect, useRef } from 'react'
import { Animated, Easing, View, TouchableOpacity } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import { useHorizontalMode } from '@/utils/hooks'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'

/**
 * 首页大卡片（排行榜 / 歌单广场 / 收藏 / 音源管理）。
 *
 * 四张卡共用一套「亚克力」底（多段渐变 + 顶部高光 + 底部内阴影 + 柔光斑点），
 * 但每张卡有自己的持续装饰动效，全是 native driver，不占 JS 线程：
 *  排行榜 → 一排上下跳动的柱状（像榜单实时刷新）；
 *  歌单   → 缓慢旋转的黑胶唱片；
 *  收藏   → 飘起来的爱心；
 *  音源   → 一圈圈扩散的波纹。
 * 相位按 index 错开，四张卡不会整齐划一地一起动。
 *
 * 横向切换交给首页：scrollX 换算成 progress（0 = 正中焦点，±1 = 左右相邻），
 * 这里只负责把 progress 映射成 scale / translateY / rotate / 透明度。
 */
export type BigCardVariant = 'bars' | 'vinyl' | 'hearts' | 'ripple'

export interface BigCardProps {
  title: string
  /** 标题下的一行小字 */
  subtitle?: string
  icon: string
  variant?: BigCardVariant
  /** 卡片序号，用来错开持续动效的相位 */
  index?: number
  /** 横向滚动进度：0 = 卡片吸附在正中（焦点），±1 = 左右相邻卡 */
  progress?: Animated.AnimatedInterpolation<number>
  onPress: () => void
}

/** 卡片尺寸和 createStyle 走同一套缩放，首页算吸附间距时直接用下面的函数，避免对不齐 */
const CARD_WIDTH = 152
const CARD_HEIGHT = 196
const CARD_GAP = 12
const CARD_WIDTH_COMPACT = 124
const CARD_HEIGHT_COMPACT = 148
const CARD_GAP_COMPACT = 10

/** 首页横向吸附轮播需要卡片宽度和间距：和卡片实际渲染尺寸严格一致（同一个缩放函数） */
export const getBigCardMetrics = (compact: boolean) => ({
  width: scaleSizeW(compact ? CARD_WIDTH_COMPACT : CARD_WIDTH),
  height: scaleSizeH(compact ? CARD_HEIGHT_COMPACT : CARD_HEIGHT),
  gap: scaleSizeW(compact ? CARD_GAP_COMPACT : CARD_GAP),
})

const CARD_THEMES: Record<BigCardVariant, { colors: string[], label: string }> = {
  bars: { colors: ['#4C1D95', '#7C3AED', '#A78BFA'], label: '#C4B5FD' },
  vinyl: { colors: ['#0B3B38', '#0F766E', '#2DD4BF'], label: '#5EEAD4' },
  hearts: { colors: ['#831843', '#DB2777', '#FB7185'], label: '#FBCFE8' },
  ripple: { colors: ['#1E3A8A', '#2563EB', '#60A5FA'], label: '#93C5FD' },
}

/** 排行榜：一排柱子上下跳，锚在底部所以 scaleY 之外还要补 translateY */
const BarsArt = ({ compact, phase }: { compact: boolean, phase: number }) => {
  const heights = compact ? [20, 34, 26, 40] : [28, 46, 34, 52]
  const bars = useRef(heights.map(() => new Animated.Value(0.4))).current

  useEffect(() => {
    const loops = bars.map((bar, i) => Animated.loop(Animated.sequence([
      Animated.delay((i * 150 + phase * 120) % 760),
      Animated.timing(bar, {
        toValue: 1,
        duration: 520 + ((i * 90 + phase * 60) % 260),
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(bar, {
        toValue: 0.38,
        duration: 460 + (((3 - i) * 80 + phase * 50) % 240),
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ])))
    loops.forEach(loop => { loop.start() })
    return () => { loops.forEach(loop => { loop.stop() }) }
  }, [bars, phase])

  return (
    <View
      pointerEvents='none'
      style={{
        ...styles.bars,
        height: Math.max(...heights),
        right: compact ? 10 : 14,
        top: compact ? 16 : 22,
      }}
    >
      {
        bars.map((bar, i) => (
          <Animated.View
            key={i}
            style={{
              width: compact ? 6 : 7,
              height: heights[i],
              marginLeft: i ? (compact ? 4 : 5) : 0,
              borderRadius: 4,
              backgroundColor: 'rgba(255,255,255,0.30)',
              transform: [
                { scaleY: bar },
                { translateY: bar.interpolate({ inputRange: [0.38, 1], outputRange: [heights[i] * 0.31, 0] }) },
              ],
            }}
          />
        ))
      }
    </View>
  )
}

/**
 * 歌单：黑胶唱片。
 *
 * 这里踩过一个坑：最初只有「唱片缓慢自转」一个动画，转速 15s/圈，
 * 但唱片本身是**径向对称**的（同心圆纹路 + 圆形标签 + 圆孔），转起来在视觉上
 * 几乎没有任何位移感 —— 真机两帧截图 diff 能证明像素在变，人眼却完全看不出来，
 * 用户反馈就是「歌单广场卡片没有动态效果」。
 *
 * 所以现在补了两个**非对称**的持续动效（都走 native driver）：
 *  1. 两道高光绕盘心公转（4.8s 一圈，和唱片转速不同步，一眼能看出在动）；
 *  2. 唱片后面一团光晕做 2.4s 的呼吸（亮度 + 缩放缓慢起伏）。
 * 唱片自转保留，三个速度不同步，看起来就是「一张正在放的黑胶」。
 */
const VinylArt = ({ compact, label }: { compact: boolean, label: string }) => {
  const spin = useRef(new Animated.Value(0)).current
  const orbit = useRef(new Animated.Value(0)).current
  const breathe = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loops = [
      // 唱片自转：15s 一圈，慢到不抢戏
      Animated.loop(Animated.timing(spin, {
        toValue: 1,
        duration: 15000,
        easing: Easing.linear,
        useNativeDriver: true,
      })),
      // 公转高光：4.8s 绕盘心一圈，非对称、肉眼可见
      Animated.loop(Animated.timing(orbit, {
        toValue: 1,
        duration: 4800,
        easing: Easing.linear,
        useNativeDriver: true,
      })),
      // 盘后呼吸光晕：2.4s 一次亮暗起伏
      Animated.loop(Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
    ]
    loops.forEach(loop => { loop.start() })
    return () => { loops.forEach(loop => { loop.stop() }) }
  }, [spin, orbit, breathe])

  const disc = compact ? 88 : 110
  const radius = disc / 2
  const grooveOuter = disc * 0.74
  const grooveInner = disc * 0.55
  const labelSize = disc * 0.34
  // 光晕比唱片大一圈：像唱片被一束光托着
  const haloPad = disc * 0.10
  const haloSize = disc + haloPad * 2
  // 公转高光：细长的白色光斑，放在盘面上下两端，绕盘心转
  const glintW = disc * 0.34
  const glintH = Math.max(3, disc * 0.075)

  return (
    <View
      pointerEvents='none'
      style={{
        ...styles.vinylWrap,
        width: disc,
        height: disc,
        borderRadius: radius,
        right: compact ? -14 : -18,
        top: compact ? 8 : 12,
      }}
    >
      {/* 呼吸光晕：两层半透明圆叠出「柔光」（RN 没有径向渐变，用同心圆降透明度代替） */}
      <Animated.View
        pointerEvents='none'
        style={{
          position: 'absolute',
          left: -haloPad * 2.4,
          top: -haloPad * 2.4,
          width: disc + haloPad * 4.8,
          height: disc + haloPad * 4.8,
          borderRadius: (disc + haloPad * 4.8) / 2,
          backgroundColor: 'rgba(255,255,255,0.16)',
          opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.55] }),
          transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.10] }) }],
        }}
      />
      <Animated.View
        pointerEvents='none'
        style={{
          position: 'absolute',
          left: -haloPad,
          top: -haloPad,
          width: haloSize,
          height: haloSize,
          borderRadius: haloSize / 2,
          backgroundColor: 'rgba(255,255,255,0.22)',
          opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.44] }),
          transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }],
        }}
      />

      <Animated.View
        style={{
          width: disc,
          height: disc,
          borderRadius: radius,
          transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
        }}
      >
        <LinearGradient
          colors={['#273244', '#0D1522', '#1B2636']}
          locations={[0, 0.62, 1]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={{ width: disc, height: disc, borderRadius: radius }}
        />
        <View style={{ ...styles.groove, width: grooveOuter, height: grooveOuter, borderRadius: grooveOuter / 2, left: (disc - grooveOuter) / 2, top: (disc - grooveOuter) / 2 }} />
        <View style={{ ...styles.groove, width: grooveInner, height: grooveInner, borderRadius: grooveInner / 2, left: (disc - grooveInner) / 2, top: (disc - grooveInner) / 2 }} />
        <View style={{ ...styles.vinylLabel, width: labelSize, height: labelSize, borderRadius: labelSize / 2, left: (disc - labelSize) / 2, top: (disc - labelSize) / 2, backgroundColor: label }}>
          <View style={styles.vinylHole} />
        </View>
      </Animated.View>

      {/* 绕盘心公转的两道高光（上下各一，跟着同一个旋转变换走）：这是「一眼可见」的动效来源 */}
      <Animated.View
        pointerEvents='none'
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: disc,
          height: disc,
          transform: [{ rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
        }}
      >
        <View style={{ position: 'absolute', left: (disc - glintW) / 2, top: disc * 0.06, width: glintW, height: glintH, borderRadius: glintH / 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        <View style={{ position: 'absolute', left: (disc - glintW) / 2, top: disc * 0.94 - glintH, width: glintW, height: glintH, borderRadius: glintH / 2, backgroundColor: 'rgba(255,255,255,0.16)' }} />
      </Animated.View>

      {/* 高光固定在盘面左上，不跟唱片一起转（固定光源） */}
      <View style={{ ...styles.vinylShine, width: disc * 0.44, height: disc * 0.2, borderRadius: disc * 0.1, left: disc * 0.14, top: disc * 0.14, backgroundColor: 'rgba(255,255,255,0.12)' }} />
    </View>
  )
}

/** 收藏：几颗爱心错开时间往上飘，边飘边淡出 */
const HeartsArt = ({ compact, phase }: { compact: boolean, phase: number }) => {
  const hearts = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current

  useEffect(() => {
    const loops = hearts.map((heart, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 620 + phase * 140),
      Animated.timing(heart, {
        toValue: 1,
        duration: 2600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(heart, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(700),
    ])))
    loops.forEach(loop => { loop.start() })
    return () => { loops.forEach(loop => { loop.stop() }) }
  }, [hearts, phase])

  const config = compact
    ? [
        { right: 74, top: 26, size: 12 },
        { right: 30, top: 44, size: 16 },
        { right: 52, top: 6, size: 10 },
        { right: 8, top: 22, size: 11 },
      ]
    : [
        { right: 92, top: 30, size: 15 },
        { right: 38, top: 54, size: 20 },
        { right: 64, top: 8, size: 12 },
        { right: 10, top: 26, size: 14 },
      ]

  return (
    <View pointerEvents='none' style={styles.artLayer}>
      {
        hearts.map((heart, i) => (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              right: config[i].right,
              top: config[i].top,
              opacity: heart.interpolate({ inputRange: [0, 0.14, 0.68, 1], outputRange: [0, 0.58, 0.42, 0] }),
              transform: [
                { translateY: heart.interpolate({ inputRange: [0, 1], outputRange: [compact ? 14 : 18, compact ? -38 : -52] }) },
                { scale: heart.interpolate({ inputRange: [0, 0.32, 1], outputRange: [0.7, 1.06, 0.86] }) },
              ],
            }}
          >
            <Icon name='love' size={config[i].size} color='rgba(255,255,255,0.78)' />
          </Animated.View>
        ))
      }
    </View>
  )
}

/** 音源：一圈圈向外扩散的波纹，中心一个小亮点 */
const RippleArt = ({ compact, phase }: { compact: boolean, phase: number }) => {
  const rings = useRef([0, 1, 2].map(() => new Animated.Value(0))).current

  useEffect(() => {
    const loops = rings.map((ring, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 780 + phase * 120),
      Animated.timing(ring, {
        toValue: 1,
        duration: 2400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(300),
    ])))
    loops.forEach(loop => { loop.start() })
    return () => { loops.forEach(loop => { loop.stop() }) }
  }, [rings, phase])

  const base = compact ? 42 : 52
  const dot = compact ? 8 : 10
  // 绝对定位的子元素在 RN 里不会自动按 alignItems 居中，这里显式算好中心点
  const ringOffset = base * 0.6
  const wrapSize = base * 2.2
  const dotOffset = (wrapSize - dot) / 2

  return (
    <View
      pointerEvents='none'
      style={{
        ...styles.rippleWrap,
        width: wrapSize,
        height: wrapSize,
        right: compact ? 2 : 6,
        top: compact ? 2 : 6,
      }}
    >
      <View style={{ ...styles.rippleCenter, width: dot, height: dot, borderRadius: dot / 2, left: dotOffset, top: dotOffset }} />
      {
        rings.map((ring, i) => (
          <Animated.View
            key={i}
            style={{
              ...styles.rippleRing,
              width: base,
              height: base,
              borderRadius: base / 2,
              left: ringOffset,
              top: ringOffset,
              opacity: ring.interpolate({ inputRange: [0, 0.14, 1], outputRange: [0.55, 0.5, 0] }),
              transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.32, 2.1] }) }],
            }}
          />
        ))
      }
    </View>
  )
}

export default ({ title, subtitle, icon, variant = 'bars', index = 0, progress, onPress }: BigCardProps) => {
  const compact = useHorizontalMode()
  const pressScale = useRef(new Animated.Value(1)).current
  const palette = CARD_THEMES[variant]

  // 按下时卡片轻微下沉，松手回弹 —— 比单纯降低透明度更有实体感
  const animatePress = useCallback((toValue: number) => {
    Animated.spring(pressScale, {
      toValue,
      useNativeDriver: true,
      speed: 32,
      bounciness: 7,
    }).start()
  }, [pressScale])

  /*
    横向滚动驱动：焦点卡（progress=0）满尺寸，左右相邻卡缩到 0.9、略微下沉/倾斜/变淡。
    全部是 transform/opacity，走 native driver；首页那边只喂一个 scrollX 插值过来的 progress。
  */
  const scrollStyle = progress
    ? {
        opacity: progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [0.82, 1, 0.82],
          extrapolate: 'clamp' as const,
        }),
        transform: [
          { perspective: 900 },
          {
            rotateY: progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: ['-7deg', '0deg', '7deg'],
              extrapolate: 'clamp' as const,
            }),
          },
          {
            rotate: progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: ['-1.6deg', '0deg', '1.6deg'],
              extrapolate: 'clamp' as const,
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [0.9, 1, 0.9],
              extrapolate: 'clamp' as const,
            }),
          },
          {
            translateY: progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [7, 0, 7],
              extrapolate: 'clamp' as const,
            }),
          },
        ],
      }
    : null

  return (
    <Animated.View style={[compact ? styles.wrapperCompact : styles.wrapper, scrollStyle]}>
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.card, compact ? styles.cardCompact : null, { backgroundColor: palette.colors[1] }]}
          onPress={onPress}
          onPressIn={() => { animatePress(0.955) }}
          onPressOut={() => { animatePress(1) }}
        >
          {/* 底：三段渐变斜着铺满，比纯色更有体积感 */}
          <LinearGradient
            colors={palette.colors}
            locations={[0, 0.52, 1]}
            start={{ x: 0.05, y: 0 }}
            end={{ x: 0.95, y: 1 }}
            style={styles.fill}
            pointerEvents='none'
          />

          {/* 每张卡自己的持续动效 */}
          {variant === 'bars' ? <BarsArt compact={compact} phase={index} /> : null}
          {variant === 'vinyl' ? <VinylArt compact={compact} label={palette.label} /> : null}
          {variant === 'hearts' ? <HeartsArt compact={compact} phase={index} /> : null}
          {variant === 'ripple' ? <RippleArt compact={compact} phase={index} /> : null}

          {/* 柔光斑点：两个大圆把渐变「打亮」，避免整块平涂 */}
          <View pointerEvents='none' style={styles.glowBig} />
          <View pointerEvents='none' style={styles.glowSmall} />

          {/* 顶部高光 + 底部内阴影：亚克力的厚度 */}
          <LinearGradient
            colors={['rgba(255,255,255,0.24)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
            locations={[0, 0.45, 1]}
            style={styles.topGloss}
            pointerEvents='none'
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.30)']}
            style={styles.bottomShade}
            pointerEvents='none'
          />

          <View style={styles.labelRow}>
            <Icon name={icon} size={15} color='#FFFFFF' />
            <Text size={15} color='#FFFFFF' style={styles.label}>{title}</Text>
          </View>
          {
            subtitle
              ? <Text size={10} color='rgba(255,255,255,0.82)' numberOfLines={1} style={styles.subtitle}>{subtitle}</Text>
              : null
          }
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  )
}

const styles = createStyle({
  // 间距放在外层 wrapper 上：滚动缩放/倾斜的中心才是卡片本身，不会被 margin 带偏
  wrapper: {
    marginRight: CARD_GAP,
  },
  wrapperCompact: {
    marginRight: CARD_GAP_COMPACT,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.20)',
    justifyContent: 'flex-end',
    paddingLeft: 14,
    paddingRight: 14,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  cardCompact: {
    width: CARD_WIDTH_COMPACT,
    height: CARD_HEIGHT_COMPACT,
    borderRadius: 17,
    paddingLeft: 12,
    paddingRight: 12,
    paddingBottom: 12,
  },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  artLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  glowBig: {
    position: 'absolute',
    right: -52,
    top: -64,
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  glowSmall: {
    position: 'absolute',
    right: 20,
    top: 56,
    width: 62,
    height: 62,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  topGloss: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '58%',
  },
  bottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '48%',
  },
  bars: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  vinylWrap: {
    position: 'absolute',
    // 唱片有一半探出卡片右上角，靠卡片自己的 overflow hidden 裁掉
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  groove: {
    position: 'absolute',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  vinylLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylHole: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(8,8,14,0.78)',
  },
  vinylShine: {
    position: 'absolute',
    transform: [{ rotate: '-32deg' }],
  },
  rippleWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleRing: {
    position: 'absolute',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  rippleCenter: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    marginLeft: 6,
    fontWeight: '600',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  subtitle: {
    marginTop: 3,
    marginLeft: 21,
  },
})
