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
const SEGMENTS = 40
const ProgressRing = ({ ratio, children }: { ratio: number, children: React.ReactNode }) => {
  const items = useMemo(() => Array.from({ length: SEGMENTS }, (_, i) => {
    const angle = (360 / SEGMENTS) * i
    return { key: i, angle, active: i / SEGMENTS < ratio }
  }), [ratio])

  return (
    <View style={styles.ringWrap}>
      {
        items.map(item => (
          <View
            key={item.key}
            style={{
              ...styles.tick,
              backgroundColor: item.active ? '#C08BFF' : 'rgba(255,255,255,0.16)',
              transform: [{ rotate: `${item.angle}deg` }, { translateY: -23 }],
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
        backgroundColor: isDark ? 'rgba(26,20,36,0.52)' : 'rgba(255,255,255,0.62)',
        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.85)',
        shadowColor: isDark ? '#000000' : '#7C6E92',
      }}>
        {
          NAV_MENUS.map(menu => {
            const isActive = activeId === menu.id
            const iconColor = isActive ? '#FFFFFF' : (isDark ? 'rgba(255,255,255,0.62)' : 'rgba(30,24,40,0.55)')

            if (menu.id === 'nav_player') {
              return (
                <TouchableOpacity key={menu.id} style={styles.item} activeOpacity={0.8} onPress={openPlayer}>
                  <ProgressRing ratio={progress}>
                    <View style={styles.albumInner}>
                      {
                        musicInfo.pic
                          ? <Image url={musicInfo.pic} style={styles.album} />
                          : (
                            <View style={{ ...styles.album, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                              <Icon name='music_time' size={14} color='rgba(255,255,255,0.75)' />
                            </View>
                          )
                      }
                    </View>
                  </ProgressRing>
                </TouchableOpacity>
              )
            }

            return (
              <TouchableOpacity
                key={menu.id}
                style={styles.item}
                activeOpacity={0.8}
                onPress={() => { if (!isActive) setNavActiveId(menu.id) }}
              >
                <View style={{
                  ...styles.iconWrap,
                  backgroundColor: isActive ? theme['c-primary'] : 'rgba(0,0,0,0)',
                }}>
                  <Icon name={MENU_ICONS[menu.id] ?? menu.icon} size={22} color={iconColor} />
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
    paddingTop: 8,
    paddingBottom: 14,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '64%',
    height: 62,
    borderRadius: 31,
    borderWidth: 0.5,
    paddingLeft: 8,
    paddingRight: 8,
    elevation: 16,
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  item: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
