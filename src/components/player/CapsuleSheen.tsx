import { memo, useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'

/**
 * 胶囊边缘的「跑马灯 + 呼吸」高光。
 *
 * 用户的原话是：胶囊描边**不要一条完整线条**，要弱化、要局部高光、要有跑马灯呼吸。
 * 所以这里不画 border，而是在胶囊上下两条边缘各放一道很薄的白色渐变光带，
 * 让光带沿着长边缓慢移动（跑马灯），整体透明度再做一次 2.4s 的呼吸起伏。
 * 光带会被父级胶囊的 `overflow: hidden` + 圆角自然裁掉，绕过端部圆弧时就像
 * 光顺着边缘滑过去，不会出现「线头」。
 *
 * 性能（BottomNav 常驻，必须省电）：
 *  - 只驱动 `transform: translateX` 和 `opacity`，可以 `useNativeDriver: true`；
 *  - 动画全部跑在 UI 线程，**不会**触发这个组件或父组件的 JS 重渲染；
 *  - 只有 2 个 loop，没有逐帧 setState / layout 动画。
 *
 * 两个方向的平移共用同一个 `sweep` 值（上边从左到右、下边从右到左），
 * 所以只跑一个循环就能得到对向滑动的效果，省一半开销。
 */

/** 一趟跑马灯要多久：5.6s 走完全长，慢到不抢内容、又明显能看出来 */
const SWEEP_DURATION = 5600
/** 呼吸节奏：和胶囊进度光 / 封面圆环同一套 1900~2400ms 的慢呼吸 */
const GLOW_DURATION = 2400
const GLOW_MIN = 0.5
const GLOW_MAX = 1

export default memo(({
  width,
  height,
  dark = false,
}: {
  /** 胶囊宽度（onLayout 量到的实际 dp） */
  width: number
  /** 胶囊高度 */
  height: number
  dark?: boolean
}) => {
  const sweep = useRef(new Animated.Value(0)).current
  const glow = useRef(new Animated.Value(GLOW_MIN)).current

  useEffect(() => {
    const sweepAnim = Animated.loop(Animated.timing(sweep, {
      toValue: 1,
      duration: SWEEP_DURATION,
      easing: Easing.linear,
      useNativeDriver: true,
    }))
    const glowAnim = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: GLOW_MAX, duration: GLOW_DURATION, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glow, { toValue: GLOW_MIN, duration: GLOW_DURATION, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]))
    sweepAnim.start()
    glowAnim.start()
    return () => {
      sweepAnim.stop()
      glowAnim.stop()
    }
  }, [sweep, glow])

  // 还没量到布局时先不画，避免 0 宽度的光带从坐标原点闪一下
  if (width <= 0 || height <= 0) return null

  /** 光带长度：约胶囊一半，短了像一条线，长了看不出移动 */
  const bandWidth = Math.max(72, width * 0.46)
  /** 上边：从左往右；下边：用同一个值反向插值，得到从右往左，无需第二个 loop */
  const topTranslate = sweep.interpolate({ inputRange: [0, 1], outputRange: [-bandWidth, width] })
  const bottomTranslate = sweep.interpolate({ inputRange: [0, 1], outputRange: [width, -bandWidth] })
  const bandColors = dark
    ? ['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']
    : ['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)', 'rgba(255,255,255,0)']

  return (
    <Animated.View
      pointerEvents='none'
      style={{ position: 'absolute', left: 0, top: 0, width, height, opacity: glow }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0.5,
          width: bandWidth,
          height: 1.6,
          transform: [{ translateX: topTranslate }],
        }}
      >
        <LinearGradient
          colors={bandColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 1 }}
        />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0.5,
          width: bandWidth,
          height: 1.1,
          opacity: 0.55,
          transform: [{ translateX: bottomTranslate }],
        }}
      >
        <LinearGradient
          colors={bandColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 1 }}
        />
      </Animated.View>
    </Animated.View>
  )
})
