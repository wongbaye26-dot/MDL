import { memo, useEffect, useRef, useState } from 'react'
import { Animated, Easing, TouchableOpacity, View } from 'react-native'
import { Navigation } from 'react-native-navigation'
import LinearGradient from 'react-native-linear-gradient'

import Text from '@/components/common/Text'
import MarqueeText from '@/components/common/MarqueeText'
import { Icon } from '@/components/common/Icon'
import Glass from '@/components/common/Glass'
import CapsuleProgress from '@/components/common/CapsuleProgress'
import AlbumDiscSpin from '@/components/common/AlbumDiscSpin'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo, useIsPlay, useProgress } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useKeyboard } from '@/utils/hooks'
import { playNext, togglePlay } from '@/core/player/player'
import commonState from '@/store/common/state'
import { measureStartRect, openPlayerFromBar } from '@/utils/playerOpen'
import { createStyle } from '@/utils/tools'
import { cleanSongName } from '@/utils/songName'

/**
 * 点迷你播放条 → 打开播放器页。
 *
 * 和底部胶囊导航的圆盘用同一个共享元素转场（utils/playerOpen）：
 * 起点是播放条左侧那块会转的圆盘（页面还在的时候先量好），
 * 歌单详情/歌单页是 RNN 独立屏，要先 pop 回首页才有转场层，所以这里把
 * 「量起点 → pop → 等动画完再切页」整个交给 helper；排行榜这类本来就在首页
 * 内部的页面传 isHome=true，省掉 pop 等待直接起动画。
 */
const openPlayerTab = (discRef: React.RefObject<View | null>, isHome: boolean) => {
  const homeId = commonState.componentIds.home
  openPlayerFromBar(
    done => { measureStartRect(discRef.current, done) },
    homeId && !isHome
      ? () => {
          try {
            // 弹掉栈上的详情页，回到首页后再切页签
            void Navigation.popTo(homeId).catch(() => {})
          } catch {}
        }
      : undefined,
    !isHome,
    // 跨 RNN 页面时这条播放条随页面被 pop 掉了，关闭播放器要收回到首页胶囊的圆盘
    !isHome,
  )
}

const BAR_HEIGHT = 59
const BAR_RADIUS = BAR_HEIGHT / 2

/**
 * 列表页底部的迷你播放器。
 *
 * 整体就是底部胶囊「横过来」：同样的高度 59、全圆角、磨砂玻璃 + 顶部高光、
 * **没有边框**、进度走边缘光晕（和胶囊同一套 `CapsuleProgress`）。
 * 左侧是会旋转的圆形封面（外圈进度环也跟胶囊共用 `navProgressStyle` 设置），
 * 中间歌名歌手、右侧播放/下一曲。
 */
export default memo(({ isHome = false }: { isHome?: boolean }) => {
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const { progress } = useProgress()
  const autoHidePlayBar = useSettingValue('common.autoHidePlayBar')
  const progressStyle = useSettingValue('common.navProgressStyle') ?? 'border'
  const { keyboardShown } = useKeyboard()
  const isDark = theme.isDark
  const [barSize, setBarSize] = useState({ w: 0, h: 0 })
  /** 左侧圆盘节点：打开播放器时量它的屏幕位置作为共享元素动画起点 */
  const discRef = useRef<View>(null)

  /** 呼吸灯：和胶囊同一份节奏 */
  const breathe = useRef(new Animated.Value(0.62)).current
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0.62, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]))
    anim.start()
    return () => { anim.stop() }
  }, [breathe])

  if (autoHidePlayBar && keyboardShown) return null
  if (!musicInfo.name) return null
  const songName = cleanSongName(musicInfo.name, musicInfo.singer)

  const ratio = Math.max(0, Math.min(1, progress))

  return (
    <View style={styles.wrap}>
      <View
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout
          setBarSize(prev => (Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5) ? prev : { w: width, h: height })
        }}
        style={{
          ...styles.card,
          backgroundColor: isDark ? 'rgba(22,17,30,0.34)' : 'rgba(255,255,255,0.42)',
          shadowColor: isDark ? '#000000' : '#6E6285',
        }}
      >
        {/* 磨砂玻璃：抓背后的页面内容做一次真高斯模糊 */}
        <Glass
          blurRadius={24}
          tint={isDark ? 'rgba(22,17,30,0.42)' : 'rgba(255,255,255,0.34)'}
          radius={BAR_RADIUS}
        />

        {/* 玻璃反光：上半部一层自上而下的白色渐变（胶囊同款） */}
        <LinearGradient
          colors={isDark
            ? ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0)']
            : ['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
          locations={[0, 0.55, 1]}
          style={styles.gloss}
          pointerEvents='none'
        />

        {/* 进度：贴着胶囊边缘的一圈柔光（和底部胶囊同一个组件、同一份设置） */}
        <CapsuleProgress
          width={barSize.w}
          height={barSize.h}
          progress={progressStyle === 'border' ? ratio : 0}
          color={theme['c-primary']}
          breathe={breathe}
        />

        <TouchableOpacity style={styles.infoArea} activeOpacity={0.75} onPress={() => { openPlayerTab(discRef, isHome) }}>
          {/* 会转的圆盘 + 外圈进度环；包一层原生 View 才能量共享元素起点 */}
          <View ref={discRef} collapsable={false}>
            <AlbumDiscSpin
              progress={ratio}
              showRing={progressStyle === 'ring'}
              dark={isDark}
            />
          </View>
          <View style={styles.textArea}>
            <MarqueeText
              text={songName}
              size={14}
              color={theme['c-font']}
              style={styles.name}
            />
            <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.singer}>{musicInfo.singer}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} activeOpacity={0.6} onPress={togglePlay}>
          <Icon name={isPlay ? 'pause' : 'play'} color={theme['c-primary']} size={24} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} activeOpacity={0.6} onPress={() => { void playNext() }}>
          <Icon name='nextMusic' color={theme['c-primary']} size={22} />
        </TouchableOpacity>
      </View>
    </View>
  )
})

const styles = createStyle({
  wrap: {
    // 悬浮在内容之上：只有卡片本身有实体，四周全透明，列表从底下穿过去
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 6,
    paddingBottom: 8,
    // 和底部胶囊同宽（292），不再拉满整屏
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 292,
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    paddingLeft: 3,
    paddingRight: 4,
    elevation: 16,
    shadowOpacity: 0.32,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 },
    overflow: 'hidden',
  },
  gloss: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: BAR_HEIGHT * 0.66,
  },
  infoArea: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textArea: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 10,
    marginRight: 6,
  },
  name: {
    fontWeight: '600',
  },
  singer: {
    marginTop: 2,
  },
  btn: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
