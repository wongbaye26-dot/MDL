import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import AlbumDiscButton from '@/components/common/AlbumDiscButton'
import Glass from '@/components/common/Glass'
import { useNavActiveId } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { NAV_MENUS, HORIZONTAL_NAV_SPACE } from '@/config/constant'
import type { InitState } from '@/store/common/state'
import { setNavActiveId } from '@/core/common'

type IdType = InitState['navActiveId']

const MENU_ICONS: Record<string, string> = {
  nav_home: 'home-variant',
  nav_download: 'download-2',
  nav_mine: 'account',
  nav_player: 'play',
}

const MenuItem = ({ id, icon, dark, onPress }: {
  id: IdType
  icon: string
  dark: boolean
  onPress: (id: IdType) => void
}) => {
  const activeId = useNavActiveId()
  const theme = useTheme()
  const active = activeId === id

  const content = (
    <View
      style={{
        ...styles.menuItem,
        backgroundColor: active ? theme['c-primary-alpha-800'] : 'transparent',
        borderColor: active ? theme['c-primary-alpha-500'] : 'transparent',
      }}
    >
      <Icon
        name={icon}
        size={20}
        color={active
          ? theme['c-primary']
          : (dark ? 'rgba(255,255,255,0.66)' : 'rgba(30,24,40,0.58)')}
      />
    </View>
  )

  if (active) return content

  return (
    <TouchableOpacity activeOpacity={0.65} onPress={() => { onPress(id) }}>
      {content}
    </TouchableOpacity>
  )
}

/**
 * 横屏左侧导航。
 *
 * 就是竖屏底部那颗悬浮胶囊「立起来」：同一层玻璃、同一圈描边、
 * 同一个选中胶囊、同一个专辑圆盘；高度按内容走（不再拉满整屏），
 * 垂直居中悬浮在左边，只有 4 个入口（不再放退出/回首页按钮）。
 * 播放器页本身是深色底，这时自动切深色玻璃。
 */
export default memo(() => {
  const theme = useTheme()
  const navActiveId = useNavActiveId()
  const dark = theme.isDark || navActiveId === 'nav_player'

  return (
    <View style={styles.wrap} pointerEvents='box-none'>
    <View
      style={{
        ...styles.container,
        backgroundColor: dark ? 'rgba(24,18,34,0.20)' : 'rgba(255,255,255,0.12)',
        borderColor: dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.72)',
        shadowColor: dark ? '#000000' : '#6E6285',
      }}
    >
      <Glass
        blurRadius={24}
        tint={dark ? 'rgba(20,15,30,0.30)' : 'rgba(255,255,255,0.20)'}
        radius={32}
      />

      {
        NAV_MENUS.map(menu => (
          menu.id === 'nav_player'
            ? (
              <View key={menu.id} style={styles.discSlot}>
                <AlbumDiscButton
                  size={52}
                  inactiveColor={dark ? 'rgba(255,255,255,0.26)' : theme['c-primary-alpha-600']}
                  onPress={() => { setNavActiveId('nav_player') }}
                />
              </View>
              )
            : (
              <MenuItem
                key={menu.id}
                id={menu.id}
                dark={dark}
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

const styles = createStyle({
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
    width: 64,
    borderRadius: 32,
    borderWidth: 0.5,
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 14,
    shadowOpacity: 0.26,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  menuItem: {
    width: 44,
    height: 44,
    marginTop: 6,
    borderRadius: 22,
    borderWidth: 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discSlot: {
    marginTop: 8,
    marginBottom: 2,
  },
})
