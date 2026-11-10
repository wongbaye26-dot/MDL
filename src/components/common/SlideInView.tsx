import { useEffect, useRef } from 'react'
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native'

export type SlideDirection = 'up' | 'down' | 'left' | 'right' | 'fade'

/**
 * 当前正在进场的整屏子页数量。
 * 多个子页可能叠着打开（设置深页盖在 PageModal 上），所以用计数而不是布尔。
 */
let transitionCount = 0

/**
 * 统一的页面进场动画容器。
 *
 * 只做位移 + 轻微推近，**不做整页淡入**：
 * 容器背景是不透明的（调用方给 getSolidBackground），opacity 从 0 开始会让
 * 第一帧整页透明、露出下层页面 —— 亮色主题下就是「进子页闪一下」。
 * 位移本身已经有「从下/从侧进入」的层级感，不需要靠 alpha 再强调。
 *
 * 传 durationMs 时用固定时长 ease-out（和 RNN 全屏页、播放器转场的时长对齐），
 * 不传则用 spring（有轻微回弹，不僵硬）。
 * direction 决定从哪个方向进来 —— 不同层级的页面用不同方向，
 * 用户才能从动效上分辨「我是进了子页，还是切了 tab」：
 *   up   = 从下往上（整屏子页 / 弹层）
 *   down = 从上往下（下拉出来的面板）
 *   left / right = 左右推入（列表进详情）
 *   fade = 原地微缩放（同级切换；不做 alpha，避免露底）
 */
export default ({ children, style, direction = 'left', durationMs }: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  direction?: SlideDirection
  /** 指定进场时长（ms）；不传就用默认 spring */
  durationMs?: number
}) => {
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    /*
     * 进场这 300ms 里页头玻璃还在抓「整窗快照」：新页面还在位移，
     * 快照很容易把下层页面（首页右上角的粉色搜索按钮）一起抓进来，
     * 表现为右上角闪一块颜色。进场期间先让玻璃降级成纯色，落位后再恢复模糊。
     */
    const setTransition = (delta: number) => {
      transitionCount = Math.max(0, transitionCount + delta)
      global.state_event.pageTransitionChanged(transitionCount > 0)
    }
    setTransition(1)
    let released = false
    const release = () => {
      if (released) return
      released = true
      setTransition(-1)
    }

    const animation = durationMs
      ? Animated.timing(progress, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
      : Animated.spring(progress, {
        toValue: 1,
        useNativeDriver: true,
        // 默认 spring 收紧一点：整屏子页大约 300~360ms 落位，和 RNN 全屏页观感一致
        tension: 100,
        friction: 13.5,
        restDisplacementThreshold: 0.3,
        restSpeedThreshold: 0.3,
      })
    animation.start(({ finished }) => {
      if (finished) release()
    })
    return () => {
      animation.stop()
      release()
    }
    // durationMs 只在挂载时决定进场节奏，运行中不需要重播
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress])

  return (
    /*
     * 外层只负责「铺满 + 不透明底色」，且**不参与位移**；位移只作用在内层内容上。
     *
     * 之前整个容器一起 translateY(28→0)，滑入过程中顶部会露出 28dp 的下层页面
     * —— 首页右上角那个主色搜索按钮就从缝里透出来，看起来像「右上角闪了一下色块」。
     * 现在外层底色固定，内层内容滑入时露出的就是同色底，不会有色块。
     */
    <View style={[style, { overflow: 'hidden' }]}>
      <Animated.View
        style={{
          flex: 1,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: direction === 'left'
                  ? [-40, 0]
                  : direction === 'right' ? [40, 0] : [0, 0],
              }),
            },
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: direction === 'up'
                  ? [28, 0]
                  : direction === 'down' ? [-28, 0] : [0, 0],
              }),
            },
            {
              // 一点点推近，比纯平移更“立体”
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [direction === 'fade' ? 0.972 : 0.985, 1],
              }),
            },
          ],
        }}
      >
        {children}
      </Animated.View>
    </View>
  )
}
