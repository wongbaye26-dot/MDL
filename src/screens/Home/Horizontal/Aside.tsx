import { memo } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'
import { confirmDialog, createStyle, exitApp as backHome } from '@/utils/tools'
import { NAV_MENUS } from '@/config/constant'
import type { InitState } from '@/store/common/state'
// import commonState from '@/store/common/state'
import { exitApp, setNavActiveId } from '@/core/common'
import { BorderWidths } from '@/theme'
import { useSettingValue } from '@/store/setting/hook'

const NAV_WIDTH = 74

const styles = createStyle({
  container: {
    flexGrow: 0,
    // flex: 1,
    // alignItems: 'center',
    // justifyContent: 'center',
    // padding: 10,
    borderRightWidth: BorderWidths.normal,
    paddingBottom: 10,
    width: NAV_WIDTH,
  },
  header: {
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    textAlign: 'center',
    marginLeft: 16,
  },
  menus: {
    flex: 1,
  },
  list: {
    paddingTop: 4,
    paddingBottom: 15,
    alignItems: 'center',
  },
  menuItem: {
    width: 44,
    height: 44,
    marginBottom: 8,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    paddingLeft: 15,
    // fontWeight: '500',
  },
})

const Header = () => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  return (
    <View style={{ paddingTop: statusBarHeight }}>
      <View style={styles.header}>
        <View style={{ ...styles.logoWrap, backgroundColor: theme['c-primary-alpha-900'] }}>
          <Icon name="logo" color={theme['c-primary-font']} size={22} />
        </View>
      </View>
    </View>
  )
}

type IdType = InitState['navActiveId'] | 'nav_exit' | 'back_home'

const MenuItem = ({ id, icon, onPress }: {
  id: IdType
  icon: string
  onPress: (id: IdType) => void
}) => {
  // const t = useI18n()
  const activeId = useNavActiveId()
  const theme = useTheme()

  return activeId == id
    ? <View style={{ ...styles.menuItem, backgroundColor: theme['c-primary'] }}>
        <View style={styles.iconContent}>
          <Icon name={icon} size={21} color='#FFFFFF' />
        </View>
      </View>
    : <TouchableOpacity
        style={styles.menuItem}
        activeOpacity={0.65}
        onPress={() => { onPress(id) }}
      >
        <View style={styles.iconContent}>
          <Icon name={icon} size={21} color={theme['c-font-label']} />
        </View>
      </TouchableOpacity>
}

export default memo(() => {
  const theme = useTheme()
  // console.log('render drawer nav')
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

    global.app_event.changeMenuVisible(false)
    setNavActiveId(id)
  }

  return (
    <View style={{ ...styles.container, borderRightColor: theme['c-border-background'] }}>
      <Header />
      <ScrollView style={styles.menus}>
        <View style={styles.list}>
          {NAV_MENUS.map(menu => <MenuItem key={menu.id} id={menu.id} icon={menu.icon} onPress={handlePress} />)}
        </View>
      </ScrollView>
      <View style={styles.list}>
        {
          showBackBtn ? <MenuItem id="back_home" icon="home" onPress={handlePress} /> : null
        }
        {
          showExitBtn ? <MenuItem id="nav_exit" icon="exit2" onPress={handlePress} /> : null
        }
      </View>
    </View>
  )
})

