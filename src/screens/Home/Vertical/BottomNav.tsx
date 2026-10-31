import { memo, useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, PanResponder, View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import Glass from '@/components/common/Glass'
import { useTheme } from '@/store/theme/hook'
import { useNavActiveId } from '@/store/common/hook'
import { usePlayerMusicInfo, useProgress, useIsPlay } from '@/store/player/hook'
import { NAV_MENUS } from '@/config/constant'
import { setNavActiveId } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { playNext, playPrev } from '@/core/player/player'
import { createStyle } from '@/utils/tools'

const MENU_ICONS: Record<string, string> = {
  nav_home: 'home-variant',
  nav_download: 'download-2',
  nav_mine: 'account',
  nav_player: 'play',
}

/** 专辑封面外的分段进度环 */
const SEGMENTS = 36
const RING_RADIUS = 24

const ProgressRing = ({ ratio, activeColor, children }: {
  ratio: number
  activeColor: string
  children: React.ReactNode
}) => {
  const items = useMemo(() => Array.from({ length: SEGMENTS }, (_, i) => ({
    key: i,
    angle: (360 / SEGMENTS) * i,
    active: i / SEGMENTS < ratio,
  })), [ratio])

  return (
    <View style={styles.ringWrap}>
      {
        items.map(item => (
          <View
            key={item.key}
            style={{
              ...styles.tick,
              backgroundColor: item.active ? activeColor : 'rgba(255,255,255,0.26)',
              transform: [{ rotate: `${item.angle}deg` }, { translateY: -RING_RADIUS }],
            }}
          />
        ))
      }
      {children}
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
        <Icon name='music_time' size={14} color='rgba(255,255,255,0.75)' />
      </View>
      )

  return (
    <View style={styles.albumInner}>
      <Animated.View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          overflow: 'hidden',
          transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
        }}
      >
        {inner}
      </Animated.View>
    </View>
  )
}

export default memo(() => {
  const theme = useTheme()
  const activeId = useNavActiveId()
  const musicInfo = usePlayerMusicInfo()
  const { progress } = useProgress()
  const isDark = theme.isDark

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
        style={{
          ...styles.bar,
          backgroundColor: isDark ? 'rgba(26,20,36,0.42)' : 'rgba(255,255,255,0.40)',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.80)',
          shadowColor: isDark ? '#000000' : '#6E6285',
        }}>
        {/* 真高斯模糊：把胶囊背后的列表内容抓成位图做一次模糊 */}
        <Glass
          blurRadius={20}
          tint={isDark ? 'rgba(22,17,32,0.52)' : 'rgba(255,255,255,0.55)'}
          radius={32}
        />
        {
          NAV_MENUS.map(menu => {
            const isActive = activeId === menu.id
            const iconColor = isActive
              ? theme['c-primary']
              : (isDark ? 'rgba(255,255,255,0.66)' : 'rgba(30,24,40,0.58)')

            if (menu.id === 'nav_player') {
              return (
                <TouchableOpacity key={menu.id} style={styles.item} activeOpacity={0.85} onPress={openPlayer}>
                  <ProgressRing ratio={progress} activeColor={theme['c-primary']}>
                    <AlbumDisc pic={musicInfo.pic} />
                  </ProgressRing>
                </TouchableOpacity>
              )
            }

            return (
              <NavSlot
                key={menu.id}
                active={isActive}
                icon={MENU_ICONS[menu.id] ?? menu.icon}
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
    width: '66%',
    height: 64,
    borderRadius: 32,
    borderWidth: 0.5,
    paddingLeft: 8,
    paddingRight: 8,
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
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tick: {
    position: 'absolute',
    width: 2,
    height: 5,
    borderRadius: 1,
  },
  albumInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  album: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
