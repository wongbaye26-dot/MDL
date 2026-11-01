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

const NAV_WIDTH = 76

type IdType = InitState['navActiveId'] | 'nav_exit' | 'back_home'

const MENU_ICONS: Record<string, string> = {
  nav_home: 'home-variant',
  nav_download: 'download-2',
  nav_mine: 'account',
  nav_player: 'play',
}

const MenuItem = ({ id, icon, onPress }: {
  id: IdType
  icon: string
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
        size={21}
        color={active ? theme['c-primary'] : theme['c-font-label']}
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
 * 横屏左侧导航栏。
 * 和竖屏悬浮胶囊同一套语言：圆角面板 + 主色淡底 + 选中项主色胶囊，
 * 底部放和胶囊里一样的专辑圆盘（带进度环）。
 */
export default memo(() => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const showBackBtn = useSettingValue('common.showBackBtn')
  const showExitBtn = useSettingValue('common.showExitBtn')

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
        marginTop: statusBarHeight > 0 ? 8 : 8,
        backgroundColor: theme['c-primary-alpha-900'],
        borderColor: theme['c-primary-alpha-700'],
      }}
    >
      <View style={{ ...styles.logoWrap, backgroundColor: theme['c-primary-alpha-900'] }}>
        <Icon name='logo' size={22} color={theme['c-primary']} />
      </View>

      <ScrollView style={styles.menus} showsVerticalScrollIndicator={false}>
        <View style={styles.list}>
          {
            NAV_MENUS.map(menu => (
              menu.id === 'nav_player'
                ? (
                  <View key={menu.id} style={styles.discSlot}>
                    <AlbumDiscButton size={54} onPress={() => { setNavActiveId('nav_player') }} />
                  </View>
                  )
                : (
                  <MenuItem
                    key={menu.id}
                    id={menu.id}
                    icon={MENU_ICONS[menu.id] ?? menu.icon}
                    onPress={handlePress}
                  />
                  )
            ))
          }
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {showBackBtn ? <MenuItem id='back_home' icon='home' onPress={handlePress} /> : null}
        {showExitBtn ? <MenuItem id='nav_exit' icon='exit2' onPress={handlePress} /> : null}
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    width: NAV_WIDTH,
    marginLeft: 8,
    marginBottom: 8,
    borderRadius: 26,
    borderWidth: 0.5,
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'center',
  },
  logoWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  menus: {
    flex: 1,
  },
  list: {
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 8,
  },
  menuItem: {
    width: 48,
    height: 48,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discSlot: {
    marginTop: 4,
    marginBottom: 4,
  },
  footer: {
    alignItems: 'center',
  },
})
