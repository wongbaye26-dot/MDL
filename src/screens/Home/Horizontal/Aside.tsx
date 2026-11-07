import { memo, useEffect, useRef } from 'react'
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'

import TabIcon, { type TabIconName } from '@/components/common/TabIcon'
import AlbumDiscSpin, { DISC_RING_SIZE } from '@/components/common/AlbumDiscSpin'
import Glass from '@/components/common/Glass'
import { useNavActiveId } from '@/store/common/hook'
import { useProgress } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { NAV_MENUS, HORIZONTAL_NAV_SPACE } from '@/config/constant'
import type { InitState } from '@/store/common/state'
import { setNavActiveId } from '@/core/common'

type IdType = InitState['navActiveId']

/**
 * 横屏左侧导航 —— 就是竖屏底部那颗胶囊「立起来」。
 *
 * 尺寸全部对齐竖屏 BottomNav（飞牛实测值）：
 *   宽 59（= 竖屏的高）、全圆角 29.5、圆底 52、槽位 58、图标 27、**没有边框**、
 *   同一层磨砂玻璃 + 高光。播放进度只走竖屏胶囊/迷你播放器的封面圆环，
 *   「胶囊描边」边缘进度光已在 v3.8.2 下线，这里不再画边缘光晕。
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

/** 四个入口用设计稿的矢量图标（和竖屏同一套） */
const MENU_ICONS: Record<string, TabIconName> = {
  nav_home: 'home',
  nav_download: 'download',
  nav_local: 'folder',
  nav_mine: 'me',
}

const MenuItem = ({ id, icon, dark, active, onPress }: {
  id: IdType
  icon: TabIconName
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
        <TabIcon
          name={icon}
          size={ICON_SIZE}
          color={active ? theme['c-primary'] : (dark ? 'rgba(255,255,255,0.66)' : 'rgba(30,24,40,0.72)')}
        />
      </Animated.View>
    </TouchableOpacity>
  )
}

export default memo(() => {
  const theme = useTheme()
  const navActiveId = useNavActiveId()
  const isDark = theme.isDark
  /** 播放器页是深色底，导航也切深色玻璃 */
  const dark = isDark || navActiveId === 'nav_player'
  const { progress } = useProgress()
  const progressStyle = useSettingValue('common.navProgressStyle') ?? 'ring'

  return (
    <View style={styles.wrap} pointerEvents='box-none'>
      <View
        style={[
          styles.container,
          dark ? null : styles.containerLight,
          dark
            ? {
                backgroundColor: 'rgba(22,17,30,0.34)',
                shadowColor: '#000000',
              }
            : {
                // 亮色：白色叠层降到最薄，靠 BlurView 透出内容颜色，不做「整块白」
                backgroundColor: 'rgba(255,255,255,0.15)',
                shadowColor: '#6E6285',
              },
        ]}
      >
        <Glass
          blurRadius={24}
          tint={dark ? 'rgba(22,17,30,0.42)' : 'rgba(255,255,255,0.12)'}
          radius={BAR_RADIUS}
        />

        {/* 玻璃反光：竖屏是「上亮下暗」，竖排胶囊对应「左亮右暗」 */}
        <LinearGradient
          colors={dark
            ? ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0)']
            : ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gloss}
          pointerEvents='none'
        />

        {/* 亮色：右侧内阴影（对应竖屏的底部内阴影）+ 0.5dp 细描边撑出边界（深色分支保持原样） */}
        {dark
          ? null
          : (
            <>
              <LinearGradient
                colors={['rgba(150,140,170,0)', 'rgba(150,140,170,0.22)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.innerShade}
                pointerEvents='none'
              />
              <View pointerEvents='none' style={styles.highlightEdge} />
            </>
            )}

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
                  <View style={styles.discWrap}>
                    <AlbumDiscSpin
                      progress={progressStyle === 'ring' ? progress : 0}
                      showRing={progressStyle !== 'none'}
                      dark={dark}
                    />
                  </View>
                </TouchableOpacity>
                )
              : (
                <MenuItem
                  key={menu.id}
                  id={menu.id}
                  dark={dark}
                  active={navActiveId === menu.id}
                  icon={MENU_ICONS[menu.id] ?? 'home'}
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
  containerLight: {
    // 亮色玻璃更透，外部阴影稍微加重一点把边界托出来（深色分支沿用 container 的阴影）
    elevation: 18,
    shadowOpacity: 0.42,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  gloss: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: BAR_WIDTH * 0.66,
  },
  innerShade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: BAR_WIDTH * 0.55,
  },
  highlightEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: BAR_RADIUS,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  discWrap: {
    width: DISC_RING_SIZE,
    height: DISC_RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
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
