import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import { useTheme } from '@/store/theme/hook'
import { useNavActiveId } from '@/store/common/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { NAV_MENUS } from '@/config/constant'
import { setNavActiveId } from '@/core/common'
import { createStyle } from '@/utils/tools'

const MENU_ICONS: Record<string, string> = {
  nav_home: 'home',
  nav_download: 'download-2',
  nav_mine: 'account',
  nav_player: 'play',
}

export default memo(() => {
  const theme = useTheme()
  const activeId = useNavActiveId()
  const musicInfo = usePlayerMusicInfo()
  const isDark = theme.isDark

  const openPlayer = () => {
    if (activeId !== 'nav_player') setNavActiveId('nav_player')
  }

  return (
    <View style={styles.wrap} pointerEvents='box-none'>
      <View style={{
        ...styles.bar,
        backgroundColor: isDark ? 'rgba(26,20,36,0.62)' : 'rgba(255,255,255,0.66)',
        borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.85)',
        shadowColor: isDark ? '#000000' : '#7C6E92',
      }}>
        <View
          style={{
            ...styles.specular,
            backgroundColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.9)',
          }}
          pointerEvents='none'
        />
        <View
          style={{
            ...styles.glow,
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.45)',
          }}
          pointerEvents='none'
        />
        {
          NAV_MENUS.map(menu => {
            const isActive = activeId === menu.id
            const color = isActive ? '#FFFFFF' : (isDark ? 'rgba(255,255,255,0.72)' : 'rgba(30,24,40,0.62)')

            if (menu.id === 'nav_player') {
              return (
                <TouchableOpacity key={menu.id} style={styles.item} activeOpacity={0.8} onPress={openPlayer}>
                  <View style={{
                    ...styles.albumRing,
                    borderColor: isActive ? theme['c-primary'] : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.95)'),
                  }}>
                    {
                      musicInfo.pic
                        ? <Image url={musicInfo.pic} style={styles.album} />
                        : (
                          <View style={{ ...styles.album, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(30,24,40,0.10)' }}>
                            <Icon name='music_time' size={15} color={color} />
                          </View>
                          )
                    }
                  </View>
                </TouchableOpacity>
              )
            }

            const isSquare = menu.id === 'nav_download'
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
                    : (isSquare
                        ? (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(30,24,40,0.06)')
                        : 'rgba(0,0,0,0)'),
                  borderColor: isActive ? theme['c-primary'] : (isSquare ? 'rgba(0,0,0,0)' : (isDark ? 'rgba(255,255,255,0.22)' : 'rgba(30,24,40,0.16)')),
                }}>
                  <Icon name={MENU_ICONS[menu.id] ?? menu.icon} size={isSquare ? 18 : 17} color={color} />
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
    width: '64%',
    height: 64,
    borderRadius: 32,
    borderWidth: 0.5,
    paddingLeft: 4,
    paddingRight: 4,
    elevation: 18,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    overflow: 'hidden',
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
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
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  square: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  album: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
