import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Modal, TouchableOpacity, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import PicImage from '@/components/common/PicImage'
import { useStatusbarHeight } from '@/store/common/hook'
import { useHorizontalMode, useWindowSize } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import { cleanSongName } from '@/utils/songName'

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
 * 去掉中间卡的白色描边/黑色暗幕/播放键（飞牛这里就是纯净的封面），
 * 旋转方向也翻过来了（飞牛是「外侧朝镜头」，卡片外缘更大而不是缩进去）。
 *
 * 交互保持不变：滑动吸附、点侧卡居中、点中间卡切播放/暂停。
 */
export default memo(({
  visible,
  queue,
  currentId,
  listId,
  onClose,
  onPlay,
  onToggle,
}: {
  visible: boolean
  queue: LX.Music.MusicInfo[]
  currentId?: string
  listId?: string | null
  /** 保留接口：中间卡现在不画播放键，播放状态由播放器自己展示 */
  playing?: boolean
  onClose: () => void
  onPlay: (index: number) => void
  /** 点中间那张（正在播的那首）时切播放/暂停 */
  onToggle: () => void
}) => {
  const statusBarHeight = useStatusbarHeight()
  const horizontal = useHorizontalMode()
  const { width, height } = useWindowSize()
  const topInset = statusBarHeight > 0 ? statusBarHeight : 16

  /** 中间封面边长：屏高 60%（飞牛实测 62%），超宽屏时按宽度收一下 */
  const coverSize = Math.round(Math.min(height * 0.6, width * 0.32))
  /** 相邻卡中心距：0.72 × 卡宽（飞牛实测 0.69~0.72，两侧卡少量被中间卡盖住） */
  const spacing = Math.round(coverSize * 0.72)
  const sidePad = Math.max(0, (width - spacing) / 2)

  const [activeIndex, setActiveIndex] = useState(0)
  const scrollX = useRef(new Animated.Value(0)).current
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listRef = useRef<any>(null)

  const activeItem = queue[activeIndex]

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
      </Animated.View>
    )
  }, [activeIndex, centerTo, coverSize, currentId, listId, onPlay, onToggle, scrollX, spacing])

  if (!visible || !horizontal) return null

  return (
    <Modal visible transparent animationType='fade' onRequestClose={onClose} statusBarTranslucent>
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
            /* activeIndex 不在 data 里，不传 extraData 的话行不会重渲染（层级就不更新） */
            extraData={activeIndex}
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
        <View style={[styles.meta, { paddingBottom: Math.round(height * 0.12) }]}>
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
    </Modal>
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
