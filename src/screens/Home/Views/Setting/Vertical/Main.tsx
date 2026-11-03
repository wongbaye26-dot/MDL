import { useCallback, useMemo, useState } from 'react'
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'

import Basic from '../settings/Basic'
import Player from '../settings/Player'
import Search from '../settings/Search'
import List from '../settings/List'
import Download from '../settings/Download'
import Other from '../settings/Other'
import About from '../settings/About'
import Tools from '../settings/Tools'
import { createStyle } from '@/utils/tools'
import { type SettingScreenIds } from '../Main'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { useHorizontalMode } from '@/utils/hooks'
import SlideInView from '@/components/common/SlideInView'
import Grid from './Grid'
import { NAV_BAR_SPACE, HORIZONTAL_NAV_SPACE } from '@/config/constant'
import { getSolidBackground } from '@/theme/solid'
import { PAGE_HEADER_H } from '@/components/common/PageHeader'

const getSection = (id: SettingScreenIds) => {
  switch (id) {
    case 'player': return <Player />
    case 'search': return <Search />
    case 'list': return <List />
    case 'download': return <Download />
    case 'other': return <Other />
    case 'tools': return <Tools />
    case 'about': return <About />
    case 'basic':
    default: return <Basic />
  }
}

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const [activeId, setActiveId] = useState<SettingScreenIds | null>(null)

  const section = useMemo(() => (activeId ? getSection(activeId) : null), [activeId])

  const handlePress = useCallback((id: SettingScreenIds) => {
    setActiveId(id)
  }, [])

  // 子页是整屏详情页：往上盖住「我的」页头（高度 = 状态栏 + 页头本体）
  const overlayTop = -(statusBarHeight + PAGE_HEADER_H)
  // 横屏导航浮在内容之上，设置子页要往回盖住它
  const overlayLeft = useHorizontalMode() ? -HORIZONTAL_NAV_SPACE : 0

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        <Grid onPress={handlePress} />
      </ScrollView>

      {
        activeId
          ? (
              <View style={[StyleSheet.absoluteFill, { top: overlayTop, left: overlayLeft, zIndex: 200, elevation: 24 }]}>
                <SlideInView style={{ ...styles.modal, backgroundColor: getSolidBackground(theme) }}>
                  <View style={{ ...styles.modalHeader, height: 52 + statusBarHeight, paddingTop: statusBarHeight }}>
                    <TouchableOpacity style={styles.modalBack} onPress={() => { setActiveId(null) }}>
                      <Icon name='chevron-left-2' size={20} color={theme['c-font']} />
                    </TouchableOpacity>
                    <Text size={19} style={styles.modalTitle}>{t(`setting_${activeId}` as 'setting_basic')}</Text>
                  </View>
                  <ScrollView
                    contentContainerStyle={styles.modalContent}
                    refreshControl={(
                      <RefreshControl
                        refreshing={false}
                        onRefresh={() => { setActiveId(null) }}
                        colors={['transparent']}
                        progressBackgroundColor='transparent'
                        tintColor='transparent'
                      />
                    )}
                  >
                    {section}
                  </ScrollView>
                </SlideInView>
              </View>
            )
          : null
      }
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  list: {
    paddingTop: 6,
    paddingBottom: NAV_BAR_SPACE,
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 16,
  },
  modalBack: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontWeight: '700',
    marginLeft: 4,
  },
  modalContent: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 10,
    paddingBottom: NAV_BAR_SPACE,
  },
})
