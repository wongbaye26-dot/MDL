import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, BackHandler, Easing, StatusBar as RNStatusBar, StyleSheet, TouchableOpacity, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Glass from '@/components/common/Glass'
import PicImage from '@/components/common/PicImage'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { useHorizontalMode, useWindowSize } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import { cleanSongName } from '@/utils/songName'
import PlayGlyph from './PlayGlyph'

/**
 * 队列打开期间由本组件隐藏了系统状态栏（全屏），关闭/卸载时恢复。
 * 用模块级标记而不是 state：只有「我们隐藏过」才去恢复，避免把别的页面的全屏状态误开。
 */
let statusBarHiddenByQueue = false

/**
 * 横屏播放队列：3D 封面流（cover flow），照飞牛横屏队列 1:1 复刻。
 *
 * 参考 .tmp-verify/feiniu2/fn2_land_queue.png（2340x1080）实测：
 *   中间卡 ≈ 屏高 62%（670px/1080），无描边、无暗幕、无播放键遮罩；
 *   两侧卡按距离递减：紧邻那张约 0.8 倍（转角 ≈20°），再往外 0.72 倍甚至更小；
 *   相邻卡中心距 ≈ 0.7~0.8 × 卡宽 —— 两侧卡有一小半被中间卡盖住，整体比原来摊得开；
 *   中间卡下方居中显示歌名（白字 + 阴影）和歌手，卡片中心落在屏高约 40% 处；
 *   背景是当前封面的重模糊 + 压暗。
 *
 * 和原来的区别：角度 42° → 23°（42° 太像「侧过来的一面墙」）、卡片放大、间距拉开、
 * 尺寸/转角改成按距离递进的扇形（原来 ±1 之外全是同一个尺寸，看着像一排等大的卡）、
 * 去掉中间卡的白色描边/黑色暗幕，旋转方向也翻过来了（飞牛是「外侧朝镜头」，
 * 卡片外缘更大而不是缩进去）。
 *
 * 打开期间隐藏系统状态栏（整屏沉浸）；中间卡中央加一颗磨砂玻璃的播放/暂停钮
 * （胶囊任务栏同款 Glass 质感），只在中间卡显示。
 *
 * 注意：这里**不是 Modal**，而是 Player 页内 absoluteFill 覆盖层。
 * 之前用 Modal 时 `StatusBar.setHidden` 在真机上是无效的（Modal 是独立 Dialog 窗口，
 * 系统状态栏属于 Activity 窗口，隐藏 Activity 不会让 Dialog 也全屏）——
 * 改成页内覆盖层后隐藏状态栏就是 Activity 级的，能真正全屏。
 *
 * 交互：滑动吸附、点任意卡居中并直接播放（队列不关）、点中间卡的播放钮切播放/暂停。
 */
export default memo(({
  visible,
  queue,
  currentId,
  listId,
  playing = false,
  onClose,
  onPlay,
  onToggle,
}: {
  visible: boolean
  queue: LX.Music.MusicInfo[]
  currentId?: string
  listId?: string | null
  /** 当前是否正在播放：决定中间卡播放钮显示播放还是暂停 */
  playing?: boolean
  onClose: () => void
  onPlay: (index: number) => void
  /** 点中间那张（正在播的那首）时切播放/暂停 */
  onToggle: () => void
}) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const horizontal = useHorizontalMode()
  const { width, height } = useWindowSize()
  const topInset = statusBarHeight > 0 ? statusBarHeight : 16

  const [activeIndex, setActiveIndex] = useState(0)
  /** 覆盖层的进场/退场透明度（原来 Modal 自带 fade，现在自己做一个短的） */
  const appear = useRef(new Animated.Value(0)).current
  /** 关闭后的「淡出期」：还在渲染覆盖层，等状态栏恢复引起的重排结束再卸载 */
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 这一轮有没有真正打开过：横屏播放器首次挂载时不能播「关闭」动画（否则会闪一下队列） */
  const wasVisibleRef = useRef(false)
  const scrollX = useRef(new Animated.Value(0)).current
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listRef = useRef<any>(null)

  /*
    冻结「打开那一刻」的窗口尺寸。
    隐藏状态栏会让窗口可用高度变大（+状态栏高度），如果直接用实时的 useWindowSize，
    队列自己的卡片会在打开后一两帧突然变大、间距也跟着错位；
    冻结成打开时的尺寸后，整层铺满屏幕、卡片尺寸稳定，关闭后下一轮再取新值。
  */
  const openSizeRef = useRef<{ width: number, height: number } | null>(null)
  if (visible) {
    if (!openSizeRef.current) openSizeRef.current = { width, height }
  } else if (!closing) {
    // 关闭且淡出也结束了才释放；关闭的一瞬间窗口尺寸可能还没回到正常值
    openSizeRef.current = null
  }
  const layoutWidth = openSizeRef.current?.width ?? width
  const layoutHeight = openSizeRef.current?.height ?? height

  /** 中间封面边长：屏高 60%（飞牛实测 62%），超宽屏时按宽度收一下 */
  const coverSize = Math.round(Math.min(layoutHeight * 0.6, layoutWidth * 0.32))
  /** 相邻卡中心距：0.72 × 卡宽（飞牛实测 0.69~0.72，两侧卡少量被中间卡盖住） */
  const spacing = Math.round(coverSize * 0.72)
  const sidePad = Math.max(0, (layoutWidth - spacing) / 2)

  /** 中间卡播放钮直径：64~72dp（按卡宽取 26%，大屏不失控） */
  const playBtnSize = Math.round(Math.min(72, Math.max(64, coverSize * 0.26)))
  /*
    队列页永远是「封面糊底 + 暗幕」的深色画面，所以玻璃钮在深浅主题下都用偏暗的 tint，
    主色图标才能保证可读（浅色主题只是透一点，不至于变成一块白玻璃）。
  */
  const btnTint = theme.isDark ? 'rgba(20,16,28,0.40)' : 'rgba(20,16,28,0.28)'
  const btnBase = theme.isDark ? 'rgba(18,14,26,0.30)' : 'rgba(18,14,26,0.18)'


  const activeItem = queue[activeIndex]
  /** activeIndex / playing 变化都要让行重渲染（中间卡的播放钮图标和层级） */
  const extraData = useMemo(() => ({ activeIndex, playing }), [activeIndex, playing])

  /*
    打开期间隐藏系统状态栏（全屏沉浸）；关闭/卸载恢复。
    覆盖层在 Player 页里，隐藏的是 Activity 窗口的状态栏 —— 这是 Modal(Dialog) 方案做不到的。
  */
  useEffect(() => {
    if (!visible || !horizontal) return
    if (!statusBarHiddenByQueue) {
      statusBarHiddenByQueue = true
      RNStatusBar.setHidden(true, 'fade')
    }
    return () => {
      if (!statusBarHiddenByQueue) return
      statusBarHiddenByQueue = false
      RNStatusBar.setHidden(false, 'fade')
    }
  }, [visible, horizontal])

  /** 覆盖层打开时自己接管返回键（不再是 Modal 的 onRequestClose）：关队列并吃掉这次返回 */
  useEffect(() => {
    if (!visible || !horizontal) return
    const handler = () => {
      onClose()
      return true
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', handler)
    return () => { subscription.remove() }
  }, [visible, horizontal, onClose])

  /*
    进场淡入；关闭时**不立刻卸载**：
    恢复状态栏会让窗口尺寸/播放器页重排，先让覆盖层盖着等它重排完（80ms），
    再用 160ms 淡出，用户看到的是「队列淡出 → 播放器就位」，不会看到播放器跳一下。
  */
  useEffect(() => {
    if (visible) {
      wasVisibleRef.current = true
      if (closeTimer.current) {
        clearTimeout(closeTimer.current)
        closeTimer.current = null
      }
      setClosing(false)
      appear.setValue(0)
      Animated.timing(appear, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start()
      return
    }
    // 首次挂载就是关闭状态（横屏播放器刚进来）：不用播关闭动画，保持隐藏
    if (!wasVisibleRef.current) {
      appear.setValue(0)
      setClosing(false)
      return
    }
    wasVisibleRef.current = false
    // visible=false：进入淡出期（closing=true 时继续渲染覆盖层）
    setClosing(true)
    Animated.timing(appear, {
      toValue: 0,
      duration: 160,
      delay: 80,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start()
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null
      setClosing(false)
    }, 260)
    return () => {
      if (!closeTimer.current) return
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [visible, horizontal, appear])

  // 每次打开都重新定位到正在播放的那首（队列是打开时才加载的，不能只在挂载时算一次）
  useEffect(() => {
    if (!visible || !queue.length) return
    const idx = Math.max(0, queue.findIndex(item => item.id === currentId))
    setActiveIndex(idx)
    scrollX.setValue(idx * spacing)
    const timer = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: idx * spacing, animated: false })
    }, 0)
    return () => { clearTimeout(timer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, queue.length, currentId, spacing])

  const handleScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: true },
  ), [scrollX])

  const handleSnap = useCallback((e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / spacing)
    const clamped = Math.max(0, Math.min(queue.length - 1, idx))
    setActiveIndex(prev => (prev === clamped ? prev : clamped))
  }, [queue.length, spacing])

  const centerTo = useCallback((index: number) => {
    listRef.current?.scrollToOffset({ offset: index * spacing, animated: true })
    setActiveIndex(index)
  }, [spacing])

  const renderItem = useCallback(({ item, index }: { item: LX.Music.MusicInfo, index: number }) => {
    /*
      3 段插值（±3 张）：飞牛的队列是「越远越小」的扇形 ——
      紧邻的那张约 0.86 倍，再往外 0.72 / 0.60，旋转角也跟着从 23° 涨到 36°。
      只插一段（±1）的话所有侧卡尺寸都一样，看起来像「一排等大的卡片」而不是扇形。
    */
    const inputRange = [
      (index - 3) * spacing,
      (index - 2) * spacing,
      (index - 1) * spacing,
      index * spacing,
      (index + 1) * spacing,
      (index + 2) * spacing,
      (index + 3) * spacing,
    ]
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [
        SIDE_SCALES[0], SIDE_SCALES[1], SIDE_SCALES[2],
        1,
        SIDE_SCALES[2], SIDE_SCALES[1], SIDE_SCALES[0],
      ],
      extrapolate: 'clamp',
    })
    /*
      旋转方向：飞牛是「卡片外缘朝镜头外翻」（外缘投影更大、上缘向外抬高）。
      RN 的 rotateY 正值会让右侧往后缩，所以左边卡要 +θ、右边卡要 -θ ——
      对应下面 outputRange 的 [右侧, 中间, 左侧] = [-θ, 0, +θ]。
    */
    const rotateY = scrollX.interpolate({
      inputRange,
      outputRange: [
        `-${SIDE_ROTATES[0]}deg`, `-${SIDE_ROTATES[1]}deg`, `-${SIDE_ROTATES[2]}deg`,
        '0deg',
        `${SIDE_ROTATES[2]}deg`, `${SIDE_ROTATES[1]}deg`, `${SIDE_ROTATES[0]}deg`,
      ],
      extrapolate: 'clamp',
    })
    const isActive = index === activeIndex
    const isPlaying = item.id === currentId

    return (
      <Animated.View
        style={{
          width: spacing,
          height: coverSize,
          alignItems: 'center',
          justifyContent: 'center',
          // 中间那张压在上面：zIndex 不能用原生动画，只在吸附时更新
          zIndex: 100 - Math.abs(index - activeIndex),
          transform: [
            { perspective: PERSPECTIVE },
            { rotateY },
            { scale },
          ],
        }}
      >
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => {
            /*
              点任意一张封面都直接播这首，并且**不退出队列页**（横屏队列就是个封面流，
              期望是「点哪张播哪张、队列继续留着」）。
                1. 当前正在播的中间卡 → 切播放/暂停；
                2. 其它卡（含侧卡）→ 先居中，再立刻切歌；队列保持打开，歌名/高亮跟着更新。
            */
            if (isActive && isPlaying) {
              onToggle()
              return
            }
            centerTo(index)
            onPlay(index)
          }}
          style={{ ...styles.cover, width: coverSize, height: coverSize }}
        >
          <PicImage musicInfo={item} listId={listId} style={{ width: coverSize, height: coverSize }} />
        </TouchableOpacity>

        {
          /*
            中间卡的播放/暂停钮：磨砂玻璃圆钮（和胶囊任务栏/播放条同一套 Glass 质感）。
            注意它是卡片的**兄弟节点**、绝对定位在封面正中央：
            这样点按钮不会落到外层卡片的 onPress 上（也就不用处理嵌套 Touchable 的冒泡），
            而按钮以外的区域仍然可以点整张卡。
          */
          isActive
            ? (
              <View pointerEvents='box-none' style={styles.playWrap}>
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={onToggle}
                  style={{
                    ...styles.playBtn,
                    width: playBtnSize,
                    height: playBtnSize,
                    borderRadius: playBtnSize / 2,
                    backgroundColor: btnBase,
                  }}
                >
                  <Glass blurRadius={25} tint={btnTint} radius={playBtnSize / 2} />
                  {/* 顶部高光：和胶囊/播放条一样「上亮下暗」的玻璃厚度感 */}
                  <LinearGradient
                    pointerEvents='none'
                    colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
                    locations={[0, 0.5, 1]}
                    style={styles.playGloss}
                  />
                  <PlayGlyph
                    playing={playing}
                    box={Math.round(playBtnSize * 0.4)}
                    color={theme['c-primary']}
                  />
                </TouchableOpacity>
              </View>
              )
            : null
        }
      </Animated.View>
    )
  }, [activeIndex, centerTo, coverSize, currentId, listId, onPlay, onToggle, playing, playBtnSize, btnBase, btnTint, scrollX, spacing, theme])

  if (!horizontal) return null
  // 关闭后还要留一小段做淡出（见上面 appear 的 effect）
  if (!visible && !closing) return null

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: appear }]}>
      <View style={styles.container}>
        {/* 背景：当前封面重模糊 + 暗幕（飞牛整片就是当前封面糊出来的颜色） */}
        <View pointerEvents='none' style={styles.bgWrap}>
          <PicImage musicInfo={activeItem} listId={listId} blurRadius={70} style={styles.bgImg} />
        </View>
        <View pointerEvents='none' style={styles.bgDim} />
        <LinearGradient
          pointerEvents='none'
          colors={['rgba(0,0,0,0.62)', 'rgba(0,0,0,0.06)', 'rgba(0,0,0,0.45)']}
          locations={[0, 0.45, 1]}
          style={styles.bgDim}
        />

        {/* 封面流：卡片中心落在屏高约 40%，下方留给歌名 */}
        <View style={styles.flow}>
          <Animated.FlatList
            ref={listRef}
            data={queue}
            horizontal
            keyExtractor={(item, index) => `${item.id}_${index}`}
            renderItem={renderItem}
            /* activeIndex / playing 不在 data 里，不传 extraData 的话行不会重渲染（层级/播放钮就不更新） */
            extraData={extraData}
            showsHorizontalScrollIndicator={false}
            snapToInterval={spacing}
            decelerationRate='fast'
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={handleSnap}
            getItemLayout={(_, index) => ({ length: spacing, offset: index * spacing, index })}
            contentContainerStyle={{ paddingHorizontal: sidePad }}
            style={{ flexGrow: 0 }}
          />
        </View>

        {/* 中间卡下方：歌名 + 歌手（居中，白字带阴影） */}
        <View style={[styles.meta, { paddingBottom: Math.round(layoutHeight * 0.12) }]}>
          <Text size={19} color='#FFFFFF' numberOfLines={1} style={styles.title}>
            {cleanSongName(activeItem?.name, activeItem?.singer) || '未在播放'}
          </Text>
          <Text size={12.5} color='rgba(255,255,255,0.66)' numberOfLines={1} style={styles.singer}>
            {activeItem?.singer ?? ''}
          </Text>
        </View>

        {/* 关闭：飞牛队列页没有标题栏，这里只留一颗很轻的关闭键（不影响画面） */}
        <TouchableOpacity
          style={[styles.closeBtn, { top: topInset + 8 }]}
          activeOpacity={0.7}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name='close' size={20} color='rgba(255,255,255,0.92)' />
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
})

/**
 * 两侧卡的缩放 / 旋转角，由远到近。
 * 飞牛实测：紧邻中间那张约 0.8 倍、再往外 0.72 倍，转角很小（≈20°）；
 * 这里取 0.86 / 0.72 / 0.60 和 23° / 30° / 36°，比飞牛略微饱满一点，层次一致。
 */
const SIDE_SCALES = [0.62, 0.72, 0.8] as const
const SIDE_ROTATES = [32, 26, 20] as const
/**
 * 每张卡自己的透视焦距。比原来的 900 略紧：卡片上缘向外抬起的幅度更接近飞牛
 * （飞牛是整屏一个透视，用单卡透视只能靠焦距近似，太小会明显梯形变形，太大就没有立体感）。
 */
const PERSPECTIVE = 620

const styles = createStyle({
  /**
   * 覆盖层：Player 页内的绝对定位全屏层。
   * zIndex/elevation 要压住播放器自己的内容（封面、控制键、返回键等）；
   * 背景色兜底，避免封面糊底加载前透出播放器页。
   */
  overlay: {
    zIndex: 999,
    elevation: 30,
    backgroundColor: '#0A0709',
  },
  container: {
    flex: 1,
    backgroundColor: '#0A0709',
  },
  bgWrap: {
    position: 'absolute',
    left: -40,
    right: -40,
    top: -40,
    bottom: -40,
  },
  bgImg: {
    width: '100%',
    height: '100%',
  },
  bgDim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(8,6,10,0.28)',
  },
  flow: {
    flex: 1,
    justifyContent: 'center',
    // 状态栏/安全区的呼吸感；卡片中心大致落在屏高 40%
    paddingTop: 22,
  },
  cover: {
    // 飞牛的封面是直角 + 极小的圆角，没有描边
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  playWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    // 磨砂玻璃要按圆裁切：Glass 是 absolute fill，靠父级的 overflow + 同半径圆角
    overflow: 'hidden',
    // 0.5dp 半透明描边 + 外阴影，玻璃钮才不会糊在封面里
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.34)',
    elevation: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.36,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  playGloss: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '58%',
  },
  meta: {
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 24,
  },
  title: {
    fontWeight: '600',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  singer: {
    marginTop: 7,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
})
