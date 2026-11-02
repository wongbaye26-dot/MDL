import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, PanResponder, StyleSheet, View, TouchableOpacity } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import LinearGradient from 'react-native-linear-gradient'

import { Icon } from '@/components/common/Icon'
import TabIcon, { type TabIconName } from '@/components/common/TabIcon'
import Image from '@/components/common/Image'
import Glass from '@/components/common/Glass'
import CapsuleProgress from '@/components/common/CapsuleProgress'
import { useTheme } from '@/store/theme/hook'
import { useNavActiveId } from '@/store/common/hook'
import { usePlayerMusicInfo, useProgress, useIsPlay } from '@/store/player/hook'
import { NAV_MENUS } from '@/config/constant'
import { setNavActiveId } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { playNext, playPrev } from '@/core/player/player'
import { useWindowSize } from '@/utils/hooks'
import { beginOpen } from '@/utils/playerTransition'
import { COVER_H_RATIO, COVER_TOP_RATIO } from '../Views/Player/Stage'

/**
 * 底部胶囊导航。
 *
 * 尺寸全部来自**飞牛音乐真机实测**（1080x2340 / dpr 2.75）：
 *   胶囊高 59.3dp、宽 244.4dp（它只有 4 个入口）、全圆角 29.6dp；
 *   选中圆底 52.5dp（占胶囊高 88%）、圆底距胶囊左边缘 4.0dp；图标约 22dp。
 *
 * 两个关键结论：
 *  1. 圆底 = 胶囊高 − 7，四周各留 3.5dp，所以圆底和胶囊端部的圆弧是**同心**的
 *     （这正是「左右弧度要和外框一致」）；
 *  2. 圆底离边缘只有 4dp，不是 10dp —— 之前太松是槽位用 flex:1 平分造成的。
 *
 * 这里**不用 createStyle**：它把 width 走 scaleSizeW、height 走 scaleSizeH、
 * borderRadius 走 setSpText，三者系数不同，圆框会被拉成椭圆。图形元素必须用确定的 dp。
 */

const BAR_HEIGHT = 59
const BAR_RADIUS = BAR_HEIGHT / 2
/** 圆底直径：飞牛实测 52.5，取 52（= 高 − 7，上下各留 3.5） */
const ACTIVE_SIZE = 52
/** 槽位：飞牛图标中心间距 58dp */
const SLOT_WIDTH = 58
/** 左右内边距：让第一个圆底距边缘 4dp（1 + (58-52)/2 = 4，和飞牛实测一致） */
const BAR_PADDING = 1
/**
 * 图标 size = 27。
 *
 * 飞牛真机实测：图标字形 17×17dp（圆底 52.5dp，占 32%）。
 * MaterialCommunityIcons 的字形只占 size 的约 63%，所以 size 27 → 字形约 17dp。
 * （之前传 34，字形 21.5dp，比飞牛大了 26%，看着就「图标顶满圆底」。）
 */
const ICON_SIZE = 27
/** 右侧专辑圆盘（飞牛实测 49dp） */
const DISC_SIZE = 48
/** 圆盘外的进度光环 */
const RING_SIZE = 54

/** 四个入口用设计稿的矢量图标（48×48 线性），选中态靠颜色 + 圆底区分 */
const MENU_ICONS: Record<string, TabIconName> = {
  nav_home: 'home',
  nav_download: 'download',
  nav_local: 'folder',
  nav_mine: 'me',
}

/**
 * 圆盘外的进度：一圈柔光，不是实线。
 * 三层同心圆环（宽 → 窄、淡 → 亮）叠出「发光」的观感，再整体做呼吸动画。
 */
const ProgressRing = ({ ratio, color, breathe }: {
  ratio: number
  color: string
  breathe: Animated.Value
}) => {
  const center = RING_SIZE / 2
  const r = center - 1
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, ratio))

  if (clamped <= 0.002) {
    // 没进度时只留一圈极淡的静态环，提示这里可以显示进度
    return (
      <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ring} pointerEvents='none'>
        <Circle cx={center} cy={center} r={r - 1} fill='none' stroke={color} strokeWidth={1} strokeOpacity={0.10} />
      </Svg>
    )
  }

  const arc = (width: number, opacity: number) => (
    <Circle
      cx={center}
      cy={center}
      r={r}
      fill='none'
      stroke={color}
      strokeWidth={width}
      strokeOpacity={opacity}
      strokeLinecap='round'
      strokeDasharray={[c * clamped, c]}
      transform={`rotate(-90 ${center} ${center})`}
    />
  )

  return (
    <Animated.View style={{ ...styles.ring, opacity: breathe }} pointerEvents='none'>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        {/* 外晕 → 中光 → 细芯，整体很淡，和胶囊那圈光同一套语言 */}
        {arc(6.5, 0.05)}
        {arc(4, 0.10)}
        {arc(2.2, 0.22)}
        {arc(1.1, 0.42)}
      </Svg>
    </Animated.View>
  )
}

const NavSlot = ({ active, onPress, icon, iconColor, activeBg }: {
  active: boolean
  onPress: () => void
  icon: TabIconName
  iconColor: string
  activeBg: string
}) => {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current

  useEffect(() => {
    Animated.spring(anim, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      friction: 9,
      tension: 170,
      restDisplacementThreshold: 0.001,
      restSpeedThreshold: 0.001,
    }).start()
  }, [active, anim])

  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.85} onPress={onPress}>
      <Animated.View
        pointerEvents='none'
        style={{
          ...styles.activeBg,
          backgroundColor: activeBg,
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }],
        }}
      />
      <Animated.View
        pointerEvents='none'
        style={{
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
        }}
      >
        <TabIcon name={icon} size={ICON_SIZE} color={iconColor} />
      </Animated.View>
    </TouchableOpacity>
  )
}

const AlbumDisc = ({ pic }: { pic?: string | null }) => {
  const isPlay = useIsPlay()
  const spin = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!isPlay) return
    const anim = Animated.loop(Animated.timing(spin, {
      toValue: 1,
      duration: 14000,
      easing: Easing.linear,
      useNativeDriver: true,
    }))
    anim.start()
    return () => { anim.stop() }
  }, [isPlay, spin])

  const inner = pic
    ? <Image url={pic} style={styles.album} />
    : (
      <View style={{ ...styles.album, backgroundColor: 'rgba(255,255,255,0.14)' }}>
        <Icon name='music_time' rawSize={18} color='rgba(255,255,255,0.8)' />
      </View>
      )

  return (
    <Animated.View
      style={{
        ...styles.albumWrap,
        transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    >
      {inner}
    </Animated.View>
  )
}

export default memo(() => {
  const theme = useTheme()
  const activeId = useNavActiveId()
  const musicInfo = usePlayerMusicInfo()
  const { progress } = useProgress()
  const isDark = theme.isDark
  const progressStyle = useSettingValue('common.navProgressStyle') ?? 'border'
  const [barSize, setBarSize] = useState({ w: 0, h: 0 })
  /** 圆盘节点：打开播放器时量它的屏幕位置作为共享元素动画起点 */
  const discRef = useRef<View>(null)
  const { width: winW, height: winH } = useWindowSize()

  /** 呼吸灯：进度层的整体透明度缓慢起伏（native driver，不占 JS 线程） */
  const breathe = useRef(new Animated.Value(0.62)).current
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0.62, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]))
    anim.start()
    return () => { anim.stop() }
  }, [breathe])

  const openPlayer = useCallback(() => {
    if (activeId === 'nav_player') return
    /*
      播放器封面在竖屏是「全宽矩形」，位置由 Stage 的两个比例常量决定。
      转场中间还要经过一个「大圆」：下拉时封面先收成这个大圆，再一路缩回圆盘。
      直径取封面宽度，圆心对齐封面区域的中心。
    */
    const coverW = winW
    const coverH = winH * COVER_H_RATIO
    const coverTop = winH * COVER_TOP_RATIO
    const circleD = coverW
    const target = { x: 0, y: coverTop, width: coverW, height: coverH }
    const circle = {
      x: (coverW - circleD) / 2,
      y: coverTop + coverH / 2 - circleD / 2,
      width: circleD,
      height: circleD,
    }
    const node = discRef.current
    if (!node) {
      setNavActiveId('nav_player')
      return
    }
    // 先量圆盘在屏幕上的位置作为动画起点，量不到就直接切页（不阻塞功能）
    node.measureInWindow((x, y, w, h) => {
      const cx = x + w / 2
      const cy = y + h / 2
      beginOpen({
        x: cx - DISC_SIZE / 2,
        y: cy - DISC_SIZE / 2,
        width: DISC_SIZE,
        height: DISC_SIZE,
      }, target, circle)
      setNavActiveId('nav_player')
    })
  }, [activeId, winW, winH])

  const swipeEnabled = useSettingValue('common.navSwipeSwitch')
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => (
      Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6
    ),
    onPanResponderRelease: (_, g) => {
      if (!swipeEnabled) return
      const passed = Math.abs(g.dx) > 46 || Math.abs(g.vx) > 0.45
      if (!passed) return
      if (g.dx < 0) void playNext()
      else void playPrev()
    },
  }), [swipeEnabled])

  const iconIdle = isDark ? 'rgba(255,255,255,0.66)' : 'rgba(30,24,40,0.62)'

  return (
    <View style={styles.wrap} pointerEvents='box-none'>
      <View
        {...(swipeEnabled ? panResponder.panHandlers : null)}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout
          setBarSize(prev => (Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5) ? prev : { w: width, h: height })
        }}
        style={{
          ...styles.bar,
          backgroundColor: isDark ? 'rgba(22,17,30,0.34)' : 'rgba(255,255,255,0.42)',
          shadowColor: isDark ? '#000000' : '#6E6285',
        }}
      >
        {/* 磨砂玻璃：抓胶囊背后的内容做真高斯模糊 */}
        <Glass
          blurRadius={24}
          tint={isDark ? 'rgba(22,17,30,0.42)' : 'rgba(255,255,255,0.34)'}
          radius={BAR_RADIUS}
        />

        {/* 玻璃反光：上半部一层自上而下的白色渐变（飞牛没有描边，厚度感全靠这层） */}
        <LinearGradient
          colors={isDark
            ? ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0)']
            : ['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
          locations={[0, 0.55, 1]}
          style={styles.gloss}
          pointerEvents='none'
        />

        {/*
          底部内阴影：背景是纯白时，白色胶囊和白底几乎分不出边界。
          靠「上亮下暗」的玻璃厚度把轮廓做出来，而不是加一条边框线。
        */}
        <LinearGradient
          colors={isDark
            ? ['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']
            : ['rgba(150,140,170,0)', 'rgba(150,140,170,0.10)']}
          style={styles.innerShade}
          pointerEvents='none'
        />

        {/* 播放进度：沿胶囊边缘的一圈柔光，没有边框线 */}
        <CapsuleProgress
          width={barSize.w}
          height={barSize.h}
          progress={progressStyle === 'border' ? progress : 0}
          color={theme['c-primary']}
          breathe={breathe}
        />

        {
          NAV_MENUS.map(menu => {
            const isActive = activeId === menu.id
            const iconColor = isActive ? theme['c-primary'] : iconIdle

            if (menu.id === 'nav_player') {
              return (
                <TouchableOpacity key={menu.id} style={styles.item} activeOpacity={0.85} onPress={openPlayer}>
                  <View ref={discRef} collapsable={false} style={styles.discWrap}>
                    {
                      progressStyle === 'ring'
                        ? <ProgressRing ratio={progress} color={theme['c-primary']} breathe={breathe} />
                        : null
                    }
                    <AlbumDisc pic={musicInfo.pic} />
                  </View>
                </TouchableOpacity>
              )
            }

            return (
              <NavSlot
                key={menu.id}
                active={isActive}
                icon={MENU_ICONS[menu.id] ?? 'home'}
                iconColor={iconColor}
                activeBg={theme['c-primary-alpha-800']}
                onPress={() => { if (!isActive) setNavActiveId(menu.id) }}
              />
            )
          })
        }
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: 14,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    paddingLeft: BAR_PADDING,
    paddingRight: BAR_PADDING,
    // 模糊层、渐变层、进度光晕都要按胶囊形状裁切
    overflow: 'hidden',
    elevation: 16,
    shadowOpacity: 0.32,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 },
  },
  gloss: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: BAR_HEIGHT * 0.66,
  },
  innerShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BAR_HEIGHT * 0.5,
  },
  item: {
    width: SLOT_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBg: {
    position: 'absolute',
    width: ACTIVE_SIZE,
    height: ACTIVE_SIZE,
    borderRadius: ACTIVE_SIZE / 2,
  },
  ring: {
    position: 'absolute',
  },
  discWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumWrap: {
    width: DISC_SIZE,
    height: DISC_SIZE,
    borderRadius: DISC_SIZE / 2,
    overflow: 'hidden',
  },
  album: {
    width: DISC_SIZE,
    height: DISC_SIZE,
    borderRadius: DISC_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
