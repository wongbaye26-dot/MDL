import { useCallback, useMemo, useState } from 'react'
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'

import Basic from '../settings/Basic'
import Player from '../settings/Player'
import Search from '../settings/Search'
import List from '../settings/List'
import Download from '../settings/Download'
import Other from '../settings/Other'
import About from '../settings/About'
import { createStyle } from '@/utils/tools'
import { type SettingScreenIds } from '../Main'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import SlideInView from '@/components/common/SlideInView'
import Grid from './Grid'
import { NAV_BAR_SPACE } from '@/config/constant'
import { getSolidBackground } from '@/theme/solid'

const getSection = (id: SettingScreenIds) => {
  switch (id) {
    case 'player': return <Player />
    case 'search': return <Search />
    case 'list': return <List />
    case 'download': return <Download />
    case 'other': return <Other />
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        <Grid onPress={handlePress} />
      </ScrollView>

      {
        activeId
          ? (
              <View style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 24 }]}>
                <SlideInView style={{ ...styles.modal, backgroundColor: getSolidBackground(theme) }}>
                  <View style={{ ...styles.modalHeader, height: 52 + statusBarHeight, paddingTop: statusBarHeight }}>
                    <TouchableOpacity style={styles.modalBack} onPress={() => { setActiveId(null) }}>
                      <Icon name='chevron-left-2' size={20} color={theme['c-font']} />
                    </TouchableOpacity>
                    <Text size={17} style={styles.modalTitle}>{t(`setting_${activeId}` as 'setting_basic')}</Text>
                  </View>
                  <ScrollView contentContainerStyle={styles.modalContent}>
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
