import { memo } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import AlbumDiscButton from '@/components/common/AlbumDiscButton'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { confirmDialog, createStyle, exitApp as backHome } from '@/utils/tools'
import { NAV_MENUS } from '@/config/constant'
import type { InitState } from '@/store/common/state'
import { exitApp, setNavActiveId } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'

const NAV_WIDTH = 64
/**
 * 横屏下系统状态栏是「浮」在应用上的：statusbarHeight 会报 0，
 * 但时钟/信号图标照样画在左上角，所以内容要自己让出这一条。
 */
const LANDSCAPE_TOP_INSET = 20

type IdType = InitState['navActiveId'] | 'nav_exit' | 'back_home'

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
 * 就是竖屏底部那颗悬浮胶囊「立起来」：同一层玻璃（Glass）、同一圈描边、
 * 同一个选中胶囊（primary-alpha-800 + 0.8 描边 + 主色图标）、同一个专辑圆盘。
 * 播放器页本身是深色底，这时胶囊自动切深色版本，不然一块白板压在深色播放页上。
 */
export default memo(() => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const navActiveId = useNavActiveId()
  const showBackBtn = useSettingValue('common.showBackBtn')
  const showExitBtn = useSettingValue('common.showExitBtn')
  const dark = theme.isDark || navActiveId === 'nav_player'

  const handlePress = (id: IdType) => {
    switch (id) {
      case 'nav_exit':
        void confirmDialog({
          message: global.i18n.t('exit_app_tip'),
          confirmButtonText: global.i18n.t('list_remove_tip_button'),
        }).then(isExit => {
          if (!isExit) return
          exitApp('Exit Btn')
        })
        return
      case 'back_home':
        backHome()
        return
    }
    setNavActiveId(id)
  }

  return (
    <View
      style={{
        ...styles.container,
        marginTop: (statusBarHeight > 0 ? statusBarHeight : LANDSCAPE_TOP_INSET) + 8,
        backgroundColor: dark ? 'rgba(26,20,32,0.55)' : theme['c-primary-alpha-900'],
        borderColor: dark ? 'rgba(255,255,255,0.14)' : theme['c-primary-alpha-700'],
        shadowColor: dark ? '#000000' : '#6E6285',
      }}
    >

      <ScrollView style={styles.menus} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
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
                  onPress={handlePress}
                />
                )
          ))
        }
      </ScrollView>

      {
        showBackBtn || showExitBtn
          ? (
            <View style={styles.footer}>
              {showBackBtn ? <MenuItem id='back_home' icon='home' dark={dark} onPress={handlePress} /> : null}
              {showExitBtn ? <MenuItem id='nav_exit' icon='exit2' dark={dark} onPress={handlePress} /> : null}
            </View>
            )
          : null
      }
    </View>
  )
})

const styles = createStyle({
  container: {
    width: NAV_WIDTH,
    marginLeft: 8,
    marginBottom: 8,
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
  menus: {
    flexGrow: 1,
    flexShrink: 1,
  },
  list: {
    alignItems: 'center',
    paddingBottom: 2,
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
  footer: {
    alignItems: 'center',
    paddingTop: 2,
  },
})
