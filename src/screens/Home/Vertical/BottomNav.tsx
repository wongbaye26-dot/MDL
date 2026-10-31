import { memo, useMemo } from 'react'
import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import { useTheme } from '@/store/theme/hook'
import { useNavActiveId } from '@/store/common/hook'
import { usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { NAV_MENUS } from '@/config/constant'
import { setNavActiveId } from '@/core/common'
import { createStyle } from '@/utils/tools'

const MENU_ICONS: Record<string, string> = {
  nav_home: 'home-variant',
  nav_download: 'download-2',
  nav_mine: 'account',
  nav_player: 'play',
}

/** 专辑封面外的分段进度环 */
const SEGMENTS = 44
const ProgressRing = ({ progress, children }: { progress: number, children: React.ReactNode }) => {
  const ratio = Math.max(0, Math.min(1, progress / 100))
  const items = useMemo(() => Array.from({ length: SEGMENTS }, (_, i) => {
    const angle = (360 / SEGMENTS) * i
    const active = i / SEGMENTS < ratio
    return { key: i, angle, active }
  }), [ratio])

  return (
    <View style={styles.ringWrap}>
      {
        items.map(item => (
          <View
            key={item.key}
            style={{
              ...styles.tick,
              backgroundColor: item.active ? '#B478FF' : 'rgba(255,255,255,0.22)',
              transform: [{ rotate: `${item.angle}deg` }, { translateY: -22 }],
            }}
          />
        ))
      }
      {children}
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

  return (
    <View style={styles.wrap} pointerEvents='box-none'>
      <View style={{
        ...styles.bar,
        backgroundColor: isDark ? 'rgba(28,22,38,0.66)' : 'rgba(255,255,255,0.68)',
        borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.9)',
        shadowColor: isDark ? '#000000' : '#7C6E92',
      }}>
        <View
          style={{ ...styles.specular, backgroundColor: isDark ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.95)' }}
          pointerEvents='none'
        />
        <View
          style={{ ...styles.glow, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)' }}
          pointerEvents='none'
        />
        {
          NAV_MENUS.map(menu => {
            const isActive = activeId === menu.id
            const iconColor = isActive ? '#FFFFFF' : (isDark ? 'rgba(255,255,255,0.7)' : 'rgba(30,24,40,0.6)')

            if (menu.id === 'nav_player') {
              return (
                <TouchableOpacity key={menu.id} style={styles.item} activeOpacity={0.8} onPress={openPlayer}>
                  <ProgressRing progress={isActive ? progress : progress}>
                    <View style={styles.albumInner}>
                      {
                        musicInfo.pic
                          ? <Image url={musicInfo.pic} style={styles.album} />
                          : (
                            <View style={{ ...styles.album, backgroundColor: 'rgba(255,255,255,0.14)' }}>
                              <Icon name='music_time' size={14} color='rgba(255,255,255,0.8)' />
                            </View>
                          )
                      }
                    </View>
                  </ProgressRing>
                </TouchableOpacity>
              )
            }

            const isSquare = menu.id !== 'nav_mine'
            return (
              <TouchableOpacity
                key={menu.id}
                style={styles.item}
                activeOpacity={0.8}
                onPress={() => { if (!isActive) setNavActiveId(menu.id) }}
              >
                <View style={{
                  ...(isSquare ? styles.square : styles.circle),
                  backgroundColor: isActive
                    ? theme['c-primary']
                    : (isSquare ? (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(30,24,40,0.05)') : 'rgba(0,0,0,0)'),
                  borderColor: isActive
                    ? theme['c-primary']
                    : (isSquare ? 'rgba(255,255,255,0.10)' : (isDark ? 'rgba(255,255,255,0.24)' : 'rgba(30,24,40,0.16)')),
                }}>
                  <Icon name={MENU_ICONS[menu.id] ?? menu.icon} size={isSquare ? 19 : 18} color={iconColor} />
                </View>
              </TouchableOpacity>
            )
          })
        }
      </View>
    </View>
  )
})

const styles = createStyle({
  wrap: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 12,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '88%',
    height: 64,
    borderRadius: 32,
    borderWidth: 0.5,
    paddingLeft: 6,
    paddingRight: 6,
    elevation: 18,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    overflow: 'hidden',
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
    height: 1,
    borderRadius: 1,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 26,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  item: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  square: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringWrap: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tick: {
    position: 'absolute',
    width: 2,
    height: 4,
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
