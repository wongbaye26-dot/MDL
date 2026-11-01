import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Modal, TouchableOpacity, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import PicImage from '@/components/common/PicImage'
import { useStatusbarHeight } from '@/store/common/hook'
import { useHorizontalMode, useWindowSize } from '@/utils/hooks'
import PlayGlyph from './PlayGlyph'
import { createStyle } from '@/utils/tools'

/**
 * 横屏播放队列：3D 封面流（cover flow）。
 *
 * 中间一张大封面 + 两侧按透视旋转、缩小、变暗的封面，滑动吸附切换，
 * 下方居中显示当前封面对应的歌名/歌手 —— 和参考图的样式一致。
 * 竖屏仍然走底部弹层（列表形态在竖屏更好用）。
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
  /** 当前是否正在播放（决定中间封面显示播放还是暂停） */
  playing?: boolean
  onClose: () => void
  onPlay: (index: number) => void
  /** 点中间那张（正在播的那首）时切播放/暂停 */
  onToggle: () => void
}) => {
  const statusBarHeight = useStatusbarHeight()
  const horizontal = useHorizontalMode()
  const { width, height } = useWindowSize()
  const topInset = statusBarHeight > 0 ? statusBarHeight : 20

  /** 中间封面边长 */
  const coverSize = Math.round(Math.min(height * 0.54, width * 0.27))
  /** 相邻封面中心的间距：小于封面宽度才会叠在一起（参考图约 0.73 倍） */
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
    const inputRange = [(index - 1) * spacing, index * spacing, (index + 1) * spacing]
    const scale = scrollX.interpolate({ inputRange, outputRange: [0.84, 1, 0.84], extrapolate: 'clamp' })
    const rotateY = scrollX.interpolate({ inputRange, outputRange: ['42deg', '0deg', '-42deg'], extrapolate: 'clamp' })
    const opacity = scrollX.interpolate({ inputRange, outputRange: [0.62, 1, 0.62], extrapolate: 'clamp' })
    const translateY = scrollX.interpolate({ inputRange, outputRange: [14, 0, 14], extrapolate: 'clamp' })
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
          opacity,
          transform: [
            { perspective: 900 },
            { translateY },
            { rotateY },
            { scale },
          ],
        }}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (!isActive) {
              centerTo(index)
              return
            }
            if (isPlaying) onToggle()
            else onPlay(index)
          }}
          style={{
            ...styles.cover,
            width: coverSize,
            height: coverSize,
            borderColor: isActive ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.10)',
          }}
        >
          <PicImage musicInfo={item} listId={listId} style={{ width: coverSize, height: coverSize }} />
          {
            // 中间那张压一层暗幕 + 播放键，和参考图一致
            isActive
              ? (
                <View style={styles.centerOverlay}>
                  <PlayGlyph
                    playing={isPlaying && playing}
                    box={coverSize * 0.2}
                    color='rgba(255,255,255,0.82)'
                  />
                </View>
                )
              : null
          }
        </TouchableOpacity>
      </Animated.View>
    )
  }, [activeIndex, centerTo, coverSize, currentId, listId, onPlay, onToggle, playing, scrollX, spacing])

  if (!visible || !horizontal) return null

  return (
    <Modal visible transparent animationType='fade' onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.container}>
        {/* 背景：当前封面重模糊 + 暗幕 */}
        <View pointerEvents='none' style={styles.bgWrap}>
          <PicImage musicInfo={activeItem} listId={listId} blurRadius={70} style={styles.bgImg} />
        </View>
        <View pointerEvents='none' style={styles.bgDim} />
        <LinearGradient
          pointerEvents='none'
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.68)']}
          locations={[0, 0.45, 1]}
          style={styles.bgDim}
        />

        <View style={[styles.topBar, { paddingTop: topInset, height: 52 + topInset }]}>
          <Text size={12} color='rgba(255,255,255,0.72)'>播放队列 · {queue.length}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name='close' size={20} color='rgba(255,255,255,0.9)' />
          </TouchableOpacity>
        </View>

        <View style={styles.flow}>
          <Animated.FlatList
            ref={listRef}
            data={queue}
            horizontal
            keyExtractor={(item, index) => `${item.id}_${index}`}
            renderItem={renderItem}
            /* activeIndex 不在 data 里，不传 extraData 的话行不会重渲染（中间的播放键/层级就不更新） */
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

        <View style={styles.meta}>
          <Text size={19} color='#FFFFFF' numberOfLines={1} style={styles.title}>{activeItem?.name ?? ''}</Text>
          <Text size={12} color='rgba(255,255,255,0.58)' numberOfLines={1} style={styles.singer}>{activeItem?.singer ?? ''}</Text>
        </View>
      </View>
    </Modal>
  )
})

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
    backgroundColor: 'rgba(8,6,10,0.42)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 20,
  },
  flow: {
    flex: 1,
    justifyContent: 'center',
  },
  cover: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 0.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  centerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  meta: {
    alignItems: 'center',
    paddingBottom: 26,
    marginTop: 10,
    paddingLeft: 24,
    paddingRight: 24,
  },
  title: {
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  singer: {
    marginTop: 6,
  },
})
