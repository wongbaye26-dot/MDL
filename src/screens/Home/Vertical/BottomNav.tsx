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
import { measureStartRect, openPlayerWithTransition, registerDiscNode } from '@/utils/playerOpen'

/**
 * 底部胶囊导航。
 *
 * 尺寸全部来自**飞牛音乐真机实测**（1080x2340 / dpr 2.75）：
 *   胶囊高 59.3dp、宽 244.4dp（它只有 4 个入口）、全圆角 29.6dp；
 *   选中圆底 52.5dp（占胶囊高 88%）、圆底距胶囊左边缘 4.0dp；图标字形约 18dp。
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
 * TabIcon 是 48 视框、字形收在约 7..41（34 单位），27dp 渲染时字形约 18~19dp，
 * 和飞牛真机实测的 17×17dp 基本一致；旧版矢量图标字形顶满视框（27dp → 22.5dp），
 * 看着就「顶满圆底」。
 */
const ICON_SIZE = 27
/** 右侧专辑圆盘（飞牛实测 49dp） */
const DISC_SIZE = 48
/** 圆盘外的进度光环 */
const RING_SIZE = 54

/** 四个入口用设计稿的矢量图标（48×48 线性），选中态靠实心变体 + 圆底区分 */
const MENU_ICONS: Record<string, TabIconName> = {
  nav_home: 'home',
  nav_download: 'download',
  nav_local: 'folder',
  nav_mine: 'me',
}

/**
 * 四个入口在胶囊里的槽位序号。
 * 选中圆底只有一颗，切换 Tab 时按序号算 translateX 滑过去（不再每个槽位各自硬切显隐）。
 */
const SLOT_INDEX: Record<string, number> = {
  nav_home: 0,
  nav_download: 1,
  nav_local: 2,
  nav_mine: 3,
}
/** 圆底相对胶囊左边缘的定位：和第一个槽位里的图标同心 */
const ACTIVE_LEFT = BAR_PADDING + (SLOT_WIDTH - ACTIVE_SIZE) / 2
/** 圆底垂直居中：胶囊高 − 圆底，上下各留一半 */
const ACTIVE_TOP = (BAR_HEIGHT - ACTIVE_SIZE) / 2

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

const NavSlot = ({ active, onPress, icon, iconColor }: {
  active: boolean
  onPress: () => void
  icon: TabIconName
  iconColor: string
}) => {
  const grow = useRef(new Animated.Value(active ? 1 : 0)).current
  const pop = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.spring(grow, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      friction: 9,
      tension: 170,
      restDisplacementThreshold: 0.001,
      restSpeedThreshold: 0.001,
    }).start()
    // 选中瞬间图标轻弹一下：先顶到 1.16 再弹回 1，比单纯放大有「按下去」的手感
    if (!active) return
    pop.setValue(1)
    Animated.sequence([
      Animated.timing(pop, {
        toValue: 1.16,
        duration: 110,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 4.5, tension: 210 }),
    ]).start()
  }, [active, grow, pop])

  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.85} onPress={onPress}>
      <Animated.View
        pointerEvents='none'
        style={{ transform: [{ scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1] }) }] }}
      >
        <Animated.View pointerEvents='none' style={{ transform: [{ scale: pop }] }}>
          {/* 未选中线性 / 选中实心渐变：同一套字形，选中圆底的滑动由父级统一控制 */}
          <TabIcon name={icon} size={ICON_SIZE} color={iconColor} active={active} />
        </Animated.View>
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

  /*
    把圆盘节点登记给转场模块：歌单详情 / 歌单这类 RNN 页里的 PlayerBar 打开播放器时，
    关闭要把封面收回首页圆盘，而播放器页里胶囊是不挂载的 —— 只能趁现在（首页还在）登记。
  */
  useEffect(() => {
    registerDiscNode(discRef.current, DISC_SIZE)
    return () => { registerDiscNode(null) }
  }, [])

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
      圆盘 → 播放器封面的共享元素转场。
      起点是圆盘（外面那圈 54dp 的光环不算，真正飞出去的是 48dp 的盘面），
      目标和中间大圆的算法在 utils/playerOpen 里，和迷你播放器共用同一份。
    */
    openPlayerWithTransition(done => {
      measureStartRect(discRef.current, done, DISC_SIZE)
    })
  }, [activeId])

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

  /** 当前选中入口的槽位序号；播放器页（或未知 id）没有圆底 → -1 */
  const activeSlot = SLOT_INDEX[activeId] ?? -1
  /** 圆底滑动的横向位置：切换 Tab 时 spring 过去，不再「这边灭、那边亮」硬切 */
  const activeX = useRef(new Animated.Value(Math.max(0, activeSlot))).current
  /** 圆底显隐：选中播放器时缩掉，回到任意 Tab 时弹出来 */
  const activeShown = useRef(new Animated.Value(activeSlot >= 0 ? 1 : 0)).current
  useEffect(() => {
    Animated.spring(activeX, {
      toValue: Math.max(0, activeSlot),
      useNativeDriver: true,
      stiffness: 220,
      damping: 17,
      mass: 0.9,
    }).start()
    Animated.spring(activeShown, {
      toValue: activeSlot >= 0 ? 1 : 0,
      useNativeDriver: true,
      stiffness: 260,
      damping: 22,
      mass: 0.8,
    }).start()
  }, [activeSlot, activeX, activeShown])

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
          // 模糊不可用时的兜底色：暗色更实、亮色更透，和下面 Glass 的 tint 保持同一方向
          backgroundColor: isDark ? 'rgba(22,17,30,0.52)' : 'rgba(255,255,255,0.28)',
          shadowColor: isDark ? '#000000' : '#6E6285',
        }}
      >
        {/*
          磨砂玻璃：抓胶囊背后的内容做真高斯模糊。
          Android 侧 @react-native-community/blur 的 blurRadius 硬上限是 25（超过直接抛错，
          Glass 内部已夹紧到 25），所以这里传 38 只是表达「要更厚的磨砂」的设计意图；
          实际的厚度感靠下面更实的 tint + 更亮的顶部高光 + 更深的内阴影叠出来。
        */}
        <Glass
          blurRadius={38}
          tint={isDark ? 'rgba(22,17,30,0.52)' : 'rgba(255,255,255,0.28)'}
          radius={BAR_RADIUS}
        />

        {/* 玻璃反光：上半部一层自上而下的白色渐变，顶部更亮（玻璃的厚度感全靠这层） */}
        <LinearGradient
          colors={isDark
            ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0)']
            : ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']}
          locations={[0, 0.5, 1]}
          style={styles.gloss}
          pointerEvents='none'
        />

        {/*
          底部内阴影：背景是纯白时，白色胶囊和白底几乎分不出边界。
          靠「上亮下暗」的玻璃厚度把轮廓做出来，而不是加一条边框线。
        */}
        <LinearGradient
          colors={isDark
            ? ['rgba(0,0,0,0)', 'rgba(0,0,0,0.30)']
            : ['rgba(150,140,170,0)', 'rgba(150,140,170,0.18)']}
          style={styles.innerShade}
          pointerEvents='none'
        />

        {/* 0.5dp 极淡高光描边：不是边框线，只是让胶囊边缘在背景上「亮」一圈 */}
        <View
          pointerEvents='none'
          style={{
            ...styles.highlightEdge,
            borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.78)',
          }}
        />

        {/* 播放进度：沿胶囊边缘的一圈柔光，没有边框线 */}
        <CapsuleProgress
          width={barSize.w}
          height={barSize.h}
          progress={progressStyle === 'border' ? progress : 0}
          color={theme['c-primary']}
          breathe={breathe}
        />

        {/*
          选中圆底只画一颗：切换 Tab 时沿槽位 translateX 用 spring 滑过去，
          顺便用 scale 0.84→1 做「弹出来」的入场，不再每个槽位各自淡入淡出。
        */}
        <Animated.View
          pointerEvents='none'
          style={{
            ...styles.activeBg,
            backgroundColor: theme['c-primary-alpha-800'],
            opacity: activeShown,
            transform: [
              {
                translateX: activeX.interpolate({
                  inputRange: [0, 1, 2, 3],
                  outputRange: [0, SLOT_WIDTH, SLOT_WIDTH * 2, SLOT_WIDTH * 3],
                  extrapolate: 'clamp',
                }),
              },
              { scale: activeShown.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1] }) },
            ],
          }}
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
    // 悬浮感靠更重的投影托起来：elevation 给 Android，shadow* 给 iOS
    elevation: 24,
    shadowOpacity: 0.5,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 14 },
  },
  gloss: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: BAR_HEIGHT * 0.7,
  },
  innerShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BAR_HEIGHT * 0.55,
  },
  highlightEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: BAR_RADIUS,
    borderWidth: 0.5,
  },
  item: {
    width: SLOT_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBg: {
    position: 'absolute',
    left: ACTIVE_LEFT,
    top: ACTIVE_TOP,
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
