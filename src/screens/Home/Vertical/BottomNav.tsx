import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, PanResponder, View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
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
import { createStyle } from '@/utils/tools'

/**
 * 胶囊图标：选中用实心、未选中用描边 —— Material You 的标准写法，
 * 也比「实心 + 灰」更像一套。之前本地音乐单独做成一个大实心圆，
 * 和其它三个的视觉重量完全不一样，现在统一成同一个槽位。
 */
const MENU_ICONS: Record<string, { active: string, inactive: string }> = {
  nav_home: { active: 'home-variant', inactive: 'home-variant-outline' },
  nav_download: { active: 'download', inactive: 'download-outline' },
  nav_local: { active: 'folder-music', inactive: 'folder-music-outline' },
  nav_mine: { active: 'account', inactive: 'account-outline' },
}

/** 专辑封面外的分段进度环 */
const SEGMENTS = 36
const RING_SIZE = 62
const RING_RADIUS = RING_SIZE / 2 - 4
/** 封面直径：比之前（38）放大一圈 */
const DISC_SIZE = 46

const ProgressRing = ({ ratio, activeColor, inactiveColor }: {
  ratio: number
  activeColor: string
  inactiveColor: string
}) => {
  const items = useMemo(() => Array.from({ length: SEGMENTS }, (_, i) => ({
    key: i,
    angle: (360 / SEGMENTS) * i,
    active: i / SEGMENTS < ratio,
  })), [ratio])

  return (
    <View style={styles.ringWrap} pointerEvents='none'>
      {
        items.map(item => (
          <View
            key={item.key}
            style={{
              ...styles.tick,
              backgroundColor: item.active ? activeColor : inactiveColor,
              transform: [{ rotate: `${item.angle}deg` }, { translateY: -RING_RADIUS }],
            }}
          />
        ))
      }
    </View>
  )
}

/**
 * 单个导航槽位：选中态用 spring 放大 + 淡入圆底，切换时不再是硬跳变。
 * 颜色无法用 native driver 插值，所以颜色直接切换，动效只做缩放/透明度。
 */
const NavSlot = ({ active, onPress, icon, iconColor, activeBg, activeBorder }: {
  active: boolean
  onPress: () => void
  icon: string
  iconColor: string
  activeBg: string
  activeBorder: string
}) => {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current

  useEffect(() => {
    Animated.spring(anim, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      friction: 9,
      tension: 160,
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
          borderColor: activeBorder,
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }}
      />
      <Animated.View
        pointerEvents='none'
        style={{
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
        }}
      >
        <Icon name={icon} size={22} color={iconColor} />
      </Animated.View>
    </TouchableOpacity>
  )
}

/** 导航右侧的专辑圆盘：播放时缓慢旋转 */
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
      <View style={{ ...styles.album, backgroundColor: 'rgba(255,255,255,0.12)' }}>
        <Icon name='music_time' size={16} color='rgba(255,255,255,0.75)' />
      </View>
      )

  return (
    <Animated.View
      style={{
        width: DISC_SIZE,
        height: DISC_SIZE,
        borderRadius: DISC_SIZE / 2,
        overflow: 'hidden',
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

  const openPlayer = () => {
    if (activeId !== 'nav_player') setNavActiveId('nav_player')
  }

  // 左右滑动切歌：只在明显横向拖动时接管，点按不受影响
  const swipeEnabled = useSettingValue('common.navSwipeSwitch')
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => (
      Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6
    ),
    onPanResponderRelease: (_, g) => {
      if (!swipeEnabled) return
      const passed = Math.abs(g.dx) > 46 || Math.abs(g.vx) > 0.45
      if (!passed) return
      if (g.dx < 0) {
        void playNext()
      } else {
        void playPrev()
      }
    },
  }), [swipeEnabled])

  // 胶囊外完全透明，只有胶囊本体是磨砂玻璃，内容从底下穿过去
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
          backgroundColor: isDark ? 'rgba(24,18,34,0.20)' : 'rgba(255,255,255,0.12)',
          borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.72)',
          shadowColor: isDark ? '#000000' : '#6E6285',
        }}>
        {/* 真高斯模糊：把胶囊背后的列表内容抓成位图做一次模糊 */}
        {/* 胶囊本体只留很淡的一层底色，主要靠这层模糊「抓」背后内容，
            之前底色 0.40 + tint 0.55 叠起来接近实心，玻璃感全没了 */}
        <Glass
          blurRadius={24}
          tint={isDark ? 'rgba(20,15,30,0.30)' : 'rgba(255,255,255,0.20)'}
          radius={34}
        />

        {/* 进度样式之一：描边绕着胶囊跑 */}
        {
          progressStyle === 'border'
            ? (
              <CapsuleProgress
                width={barSize.w}
                height={barSize.h}
                progress={progress}
                color={theme['c-primary']}
                trackColor={isDark ? 'rgba(255,255,255,0.14)' : 'rgba(30,24,40,0.10)'}
              />
              )
            : null
        }

        {
          NAV_MENUS.map(menu => {
            const isActive = activeId === menu.id
            const iconColor = isActive
              ? theme['c-primary']
              : (isDark ? 'rgba(255,255,255,0.66)' : 'rgba(30,24,40,0.58)')

            if (menu.id === 'nav_player') {
              return (
                <TouchableOpacity key={menu.id} style={styles.item} activeOpacity={0.85} onPress={openPlayer}>
                  {
                    progressStyle === 'ring'
                      ? (
                        <View style={styles.discWrap}>
                          <ProgressRing
                            ratio={progress}
                            activeColor={theme['c-primary']}
                            inactiveColor={isDark ? 'rgba(255,255,255,0.24)' : 'rgba(30,24,40,0.16)'}
                          />
                          <AlbumDisc pic={musicInfo.pic} />
                        </View>
                        )
                      : <View style={styles.discWrap}><AlbumDisc pic={musicInfo.pic} /></View>
                  }
                </TouchableOpacity>
              )
            }

            return (
              <NavSlot
                key={menu.id}
                active={isActive}
                icon={MENU_ICONS[menu.id]?.[isActive ? 'active' : 'inactive'] ?? menu.icon}
                iconColor={iconColor}
                activeBg={theme['c-primary-alpha-800']}
                activeBorder={theme['c-primary-alpha-500']}
                onPress={() => { if (!isActive) setNavActiveId(menu.id) }}
              />
            )
          })
        }
      </View>
    </View>
  )
})

const styles = createStyle({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: 16,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '78%',
    height: 68,
    borderRadius: 34,
    borderWidth: 0.5,
    paddingLeft: 6,
    paddingRight: 6,
    // 模糊层要按胶囊形状裁切
    overflow: 'hidden',
    elevation: 14,
    shadowOpacity: 0.26,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  item: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBg: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringWrap: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tick: {
    position: 'absolute',
    width: 2,
    height: 5,
    borderRadius: 1,
  },
  discWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  album: {
    width: DISC_SIZE,
    height: DISC_SIZE,
    borderRadius: DISC_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
