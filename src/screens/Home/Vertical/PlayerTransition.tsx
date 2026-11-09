import { memo, useEffect, useMemo, useReducer } from 'react'
import { Animated, StyleSheet, View, Image as RNImage } from 'react-native'

import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { getPlayerPalette } from '@/theme/playerPalette'
import { getTransitionState, progressAnim, subscribeTransition } from '@/utils/playerTransition'

/**
 * 转场期间的「飞行封面」+ 背景。
 *
 * 背景不是一块纯色，而是**播放器背景本身的预演**：封面糊底（blur 34，和播放器页一致）
 * 再叠一层 palette.dim，透明度全程跟 progress 线性变化。
 * 这样展开时是「封面的颜色慢慢晕开成播放器背景」，收起时反过来淡出，
 * 不会出现整屏发黑。
 */
export default memo(() => {
  const musicInfo = usePlayerMusicInfo()
  const theme = useTheme()
  const palette = useMemo(() => getPlayerPalette(theme), [theme])
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)
  const state = getTransitionState()

  useEffect(() => subscribeTransition(forceUpdate), [])

  const { from, to, circle, closingTo } = state
  const animStyle = useMemo(() => {
    if (!from || !to || !circle) return null
    /*
      收拢终点：
        - 手势关闭 = 打开时的起点（from），拖动路径必须和打开时完全一致；
        - 左上角收起 / 返回键关闭 = closingTo（跨 RNN 页面时换成首页胶囊圆盘）。
    */
    const home = closingTo ?? from
    /*
      三段插值（progress：0 = 起点，0.93 = 大圆，1 = 播放器封面矩形）：
        - 1 → 0.93：一往下拉就立刻收成正圆（只占 7% 手势，约 60px），
          也就是「封面先突出成一个大圆」；
        - 0.93 → 0：正圆一路缩小回起点，宽高同步、圆角恒等于半径。
      之前只做两段，宽高各自插值 → 中间是长条圆角矩形，缩到最后会剩一个竖色块。
    */
    const K = [0, 0.93, 1]
    return {
      left: progressAnim.interpolate({ inputRange: K, outputRange: [home.x, circle.x, to.x] }),
      top: progressAnim.interpolate({ inputRange: K, outputRange: [home.y, circle.y, to.y] }),
      width: progressAnim.interpolate({ inputRange: K, outputRange: [home.width, circle.width, to.width] }),
      height: progressAnim.interpolate({ inputRange: K, outputRange: [home.height, circle.height, to.height] }),
      // 前两段恒为半径（正圆），最后一段收成直角
      borderRadius: progressAnim.interpolate({
        inputRange: K,
        outputRange: [home.width / 2, circle.width / 2, 0],
      }),
    }
  }, [from, to, circle, closingTo])

  if (state.phase === 'idle' || !animStyle) return null

  const pic = musicInfo.pic
  /*
    背景透明度：
      - 展开时跟着 progress 从 0 淡入（点下去时首页还能看见）；
      - 收起时**保底 0.78**：页面跟着手指往下滑的时候，屏幕底部会露出播放器页自己的顶部
        （也就是深蓝色的模糊封面），背景如果已经淡没了就会看到那块「色块」。
        保底之后它被磨砂背景盖住，只剩半透明的一层，符合「除圆之外都是磨砂半透明」。
  */
  const bgOpacity = state.phase === 'closing'
    ? progressAnim.interpolate({
      inputRange: [0, 0.2],
      outputRange: [0.78, 1],
      extrapolate: 'clamp',
    })
    : progressAnim

  return (
    <View pointerEvents='none' style={StyleSheet.absoluteFill}>
      {/* 背景：封面糊底 + 压暗，和播放器页的背景是同一套做法 */}
      <Animated.View pointerEvents='none' style={{ ...StyleSheet.absoluteFillObject, opacity: bgOpacity }}>
        {
          pic
            ? <RNImage source={{ uri: pic }} blurRadius={34} resizeMode='cover' style={styles.bg} />
            : <View style={[styles.bg, { backgroundColor: palette.scrim }]} />
        }
        <View style={[styles.bg, { backgroundColor: palette.dim }]} />
      </Animated.View>

      <Animated.View
        pointerEvents='none'
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        style={[
          styles.fly,
          animStyle,
          {
            /*
              缩到快贴近圆盘时淡出：最后那一下 BottomNav 才刚挂回来，
              硬切会看到底部残留一个圆；淡出后由圆盘无缝接管。
              区间要小（6%），否则圆会在半路就消失。
            */
            opacity: progressAnim.interpolate({
              inputRange: [0, 0.06],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
          },
        ]}
      >
        {
          pic
            ? <RNImage source={{ uri: pic }} resizeMode='cover' style={styles.img} />
            : <View style={[styles.img, { backgroundColor: theme['c-primary-dark-200'] }]} />
        }
      </Animated.View>
    </View>
  )
})

const styles = StyleSheet.create({
  bg: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  fly: {
    position: 'absolute',
    overflow: 'hidden',
  },
  img: {
    width: '100%',
    height: '100%',
  },
})
