import { memo, useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, TouchableOpacity, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'

import { Icon } from '@/components/common/Icon'
import AlbumDiscButton from '@/components/common/AlbumDiscButton'
import Glass from '@/components/common/Glass'
import CapsuleProgress from '@/components/common/CapsuleProgress'
import { useNavActiveId } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { useProgress } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { NAV_MENUS, HORIZONTAL_NAV_SPACE } from '@/config/constant'
import type { InitState } from '@/store/common/state'
import { setNavActiveId } from '@/core/common'

type IdType = InitState['navActiveId']

/**
 * 横屏左侧导航 —— 就是竖屏底部那颗胶囊「立起来」。
 *
 * 尺寸全部对齐竖屏 BottomNav（飞牛实测值）：
 *   宽 59（= 竖屏的高）、全圆角 29.5、圆底 52、槽位 58、图标 27、**没有边框**、
 *   同一层磨砂玻璃 + 高光 + 边缘进度光晕。
 *
 * 同样不用 createStyle：它把 width 走 scaleSizeW、height 走 scaleSizeH、
 * borderRadius 走 setSpText，三者系数不同，圆底会被拉成椭圆。
 */

const BAR_WIDTH = 59
const BAR_RADIUS = BAR_WIDTH / 2
/** 圆底：竖屏是 52（= 高 − 7），横屏对应「宽 − 7」 */
const ACTIVE_SIZE = 52
/** 槽位：竖屏 58，横屏竖向同样是 58 */
const SLOT_SIZE = 58
const BAR_PADDING = 1
const ICON_SIZE = 27
const DISC_SIZE = 48

/** 四个入口统一用线性图标（和竖屏一致），选中态靠颜色 + 圆底区分 */
const MENU_ICONS: Record<string, string> = {
  nav_home: 'home-variant-outline',
  nav_download: 'tray-arrow-down',
  nav_local: 'folder-music-outline',
  nav_mine: 'account-outline',
}

const MenuItem = ({ id, icon, dark, active, onPress }: {
  id: IdType
  icon: string
  dark: boolean
  active: boolean
  onPress: (id: IdType) => void
}) => {
  const theme = useTheme()
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
    <TouchableOpacity
      style={styles.item}
      activeOpacity={0.85}
      onPress={() => { if (!active) onPress(id) }}
    >
      <Animated.View
        pointerEvents='none'
        style={{
          ...styles.activeBg,
          backgroundColor: theme['c-primary-alpha-800'],
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }],
        }}
      />
      <Animated.View
        pointerEvents='none'
        style={{ transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }}
      >
        <Icon
          name={icon}
          rawSize={ICON_SIZE}
          color={active ? theme['c-primary'] : (dark ? 'rgba(255,255,255,0.66)' : 'rgba(30,24,40,0.62)')}
        />
      </Animated.View>
    </TouchableOpacity>
  )
}

export default memo(() => {
  const theme = useTheme()
  const navActiveId = useNavActiveId()
  const { progress } = useProgress()
  const progressStyle = useSettingValue('common.navProgressStyle') ?? 'border'
  const isDark = theme.isDark
  /** 播放器页是深色底，导航也切深色玻璃 */
  const dark = isDark || navActiveId === 'nav_player'
  const [barSize, setBarSize] = useState({ w: 0, h: 0 })

  /** 呼吸灯：和竖屏同一份节奏 */
  const breathe = useRef(new Animated.Value(0.62)).current
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0.62, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]))
    anim.start()
    return () => { anim.stop() }
  }, [breathe])

  return (
    <View style={styles.wrap} pointerEvents='box-none'>
      <View
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout
          setBarSize(prev => (Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5) ? prev : { w: width, h: height })
        }}
        style={{
          ...styles.container,
          backgroundColor: dark ? 'rgba(22,17,30,0.34)' : 'rgba(255,255,255,0.42)',
          shadowColor: dark ? '#000000' : '#6E6285',
        }}
      >
        <Glass
          blurRadius={24}
          tint={dark ? 'rgba(22,17,30,0.42)' : 'rgba(255,255,255,0.34)'}
          radius={BAR_RADIUS}
        />

        {/* 玻璃反光：竖屏是「上亮下暗」，竖排胶囊对应「左亮右暗」 */}
        <LinearGradient
          colors={dark
            ? ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0)']
            : ['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gloss}
          pointerEvents='none'
        />

        {/* 边缘进度光晕：没有边框，只有贴着边缘的一圈柔光 */}
        <CapsuleProgress
          width={barSize.w}
          height={barSize.h}
          progress={progressStyle === 'border' ? progress : 0}
          color={theme['c-primary']}
          breathe={breathe}
        />

        {
          NAV_MENUS.map(menu => (
            menu.id === 'nav_player'
              ? (
                <TouchableOpacity
                  key={menu.id}
                  style={styles.item}
                  activeOpacity={0.85}
                  onPress={() => { setNavActiveId('nav_player') }}
                >
                  <AlbumDiscButton
                    size={DISC_SIZE}
                    inactiveColor={dark ? 'rgba(255,255,255,0.26)' : theme['c-primary-alpha-600']}
                    onPress={() => { setNavActiveId('nav_player') }}
                  />
                </TouchableOpacity>
                )
              : (
                <MenuItem
                  key={menu.id}
                  id={menu.id}
                  dark={dark}
                  active={navActiveId === menu.id}
                  icon={MENU_ICONS[menu.id] ?? menu.icon}
                  onPress={setNavActiveId}
                />
                )
          ))
        }
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  /* 覆盖在内容之上：播放器页要能整屏铺满，导航浮在上面 */
  wrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: HORIZONTAL_NAV_SPACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: BAR_WIDTH,
    borderRadius: BAR_RADIUS,
    paddingTop: BAR_PADDING,
    paddingBottom: BAR_PADDING,
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 16,
    shadowOpacity: 0.32,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 },
  },
  gloss: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: BAR_WIDTH * 0.66,
  },
  item: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBg: {
    position: 'absolute',
    width: ACTIVE_SIZE,
    height: ACTIVE_SIZE,
    borderRadius: ACTIVE_SIZE / 2,
  },
})
