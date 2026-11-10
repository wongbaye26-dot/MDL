import { memo, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'

import Glass from './Glass'

/**
 * 液态玻璃（胶囊任务栏 / 迷你播放器 / 子页播放条）。
 *
 * 在真高斯模糊（Glass/BlurView）之上叠顶部软高光 + 底部内阴影 + 0.5dp 描边。
 * 用户要求：胶囊任务栏/迷你播放器保留液态玻璃/毛玻璃，并在设置里保留开关；
 * 表头则通过 `solid` 显式降级为实色，不再抓整窗快照。
 */
export type LiquidGlassMode = 'liquid' | 'frosted' | 'none'

export default memo(({
  mode = 'liquid',
  radius = 0,
  blurRadius = 18,
  tint,
  isDark = true,
  seamless = false,
  flat = false,
  solid = false,
}: {
  mode?: LiquidGlassMode
  radius?: number
  blurRadius?: number
  tint?: string
  isDark?: boolean
  seamless?: boolean
  flat?: boolean
  /** 表头用：不做模糊快照，直接铺一层稳定实色 */
  solid?: boolean
}) => {
  /*
   * 首页 PagerView 左右滑动/子页进场期间，玻璃层降级成纯色。
   * 胶囊栏保留玻璃，但滑动时不停抓整窗快照，避免拖影和掉帧。
   */
  const [scrollPaused, setScrollPaused] = useState(!global.lx.homePagerIdle)
  const [transitionPaused, setTransitionPaused] = useState(false)
  useEffect(() => {
    const onScroll = (paused: boolean) => { setScrollPaused(paused) }
    const onTransition = (paused: boolean) => { setTransitionPaused(paused) }
    global.state_event.on('homePagerScrollChanged', onScroll)
    global.state_event.on('pageTransitionChanged', onTransition)
    return () => {
      global.state_event.off('homePagerScrollChanged', onScroll)
      global.state_event.off('pageTransitionChanged', onTransition)
    }
  }, [])

  if (mode === 'none') return null

  const paused = scrollPaused || transitionPaused

  if (solid) {
    return (
      <View
        pointerEvents='none'
        style={[StyleSheet.absoluteFillObject, {
          borderRadius: radius,
          overflow: 'hidden',
          backgroundColor: isDark ? 'rgba(22,17,30,0.98)' : 'rgba(255,255,255,0.98)',
        }]}
      />
    )
  }

  const solidTint = tint ?? (isDark ? 'rgba(20,16,28,0.42)' : 'rgba(255,255,255,0.34)')

  return (
    <View
      pointerEvents='none'
      style={[StyleSheet.absoluteFillObject, { borderRadius: radius, overflow: 'hidden' }]}
    >
      <Glass blurRadius={blurRadius} tint={tint} radius={radius} enabled={!paused} />
      {paused
        ? <View style={[StyleSheet.absoluteFillObject, { backgroundColor: solidTint, borderRadius: radius }]} />
        : null}

      {
        flat
          ? null
          : (
            <LinearGradient
              colors={isDark
                ? ['rgba(255,255,255,0.13)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']
                : ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0)']}
              locations={[0, 0.5, 1]}
              style={styles.gloss}
              pointerEvents='none'
            />
            )
      }

      {
        seamless
          ? null
          : (
            <LinearGradient
              colors={isDark
                ? ['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']
                : ['rgba(150,140,170,0)', 'rgba(150,140,170,0.16)']}
              style={styles.innerShade}
              pointerEvents='none'
            />
            )
      }
      {
        seamless
          ? null
          : (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                borderRadius: radius,
                borderWidth: 0.5,
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.5)',
              }}
            />
            )
      }
    </View>
  )
})

const styles = StyleSheet.create({
  gloss: { position: 'absolute', left: 0, right: 0, top: 0, height: '70%' },
  innerShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
})
