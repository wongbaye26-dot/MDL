import { memo, useCallback, useMemo, useState } from 'react'
import { View, ScrollView, TouchableOpacity, Modal } from 'react-native'

import Basic from '../settings/Basic'
import Player from '../settings/Player'
import Search from '../settings/Search'
import List from '../settings/List'
import Download from '../settings/Download'
import Other from '../settings/Other'
import About from '../settings/About'
import { createStyle } from '@/utils/tools'
import { SETTING_SCREENS, type SettingScreenIds } from '../Main'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'

const MENU_META: Record<SettingScreenIds, { icon: string, descKey: string }> = {
  basic: { icon: 'setting', descKey: 'setting_desc_basic' },
  player: { icon: 'play', descKey: 'setting_desc_player' },
  search: { icon: 'search-2', descKey: 'setting_desc_search' },
  list: { icon: 'list-order', descKey: 'setting_desc_list' },
  download: { icon: 'download-2', descKey: 'setting_desc_download' },
  other: { icon: 'slider', descKey: 'setting_desc_other' },
  about: { icon: 'help', descKey: 'setting_desc_about' },
}

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

const MenuRow = memo(({ id, onPress }: { id: SettingScreenIds, onPress: (id: SettingScreenIds) => void }) => {
  const theme = useTheme()
  const t = useI18n()
  const meta = MENU_META[id]

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.65} onPress={() => { onPress(id) }}>
      <View style={{ ...styles.iconWrap, backgroundColor: theme['c-primary-alpha-800'] }}>
        <Icon name={meta.icon} size={18} color={theme['c-primary-light-200']} />
      </View>
      <View style={styles.rowText}>
        <Text size={15} style={styles.rowTitle}>{t(`setting_${id}` as 'setting_basic')}</Text>
        <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.rowDesc}>
          {t(meta.descKey as 'setting_desc_basic')}
        </Text>
      </View>
      <Icon name='chevron-right' size={13} color={theme['c-350']} />
    </TouchableOpacity>
  )
})

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
        {
          [SETTING_SCREENS.slice(0, 5), SETTING_SCREENS.slice(5)].map((group, index) => (
            <View key={index} style={{ ...styles.group, backgroundColor: theme['c-primary-alpha-900'], borderColor: theme['c-primary-alpha-700'] }}>
              {group.map((id, i) => (
                <View key={id}>
                  <MenuRow id={id} onPress={handlePress} />
                  {i < group.length - 1 ? <View style={{ ...styles.divider, backgroundColor: theme['c-primary-alpha-800'] }} /> : null}
                </View>
              ))}
            </View>
          ))
        }
      </ScrollView>

      {
        activeId
          ? (
              <Modal visible animationType='slide' statusBarTranslucent onRequestClose={() => { setActiveId(null) }}>
                <View style={{ ...styles.modal, backgroundColor: theme['c-main-background'] }}>
                  <View style={{ ...styles.modalHeader, height: 52 + statusBarHeight, paddingTop: statusBarHeight }}>
                    <TouchableOpacity style={styles.modalBack} onPress={() => { setActiveId(null) }}>
                      <Icon name='chevron-left-2' size={20} color={theme['c-font']} />
                    </TouchableOpacity>
                    <Text size={17} style={styles.modalTitle}>{t(`setting_${activeId}` as 'setting_basic')}</Text>
                  </View>
                  <ScrollView contentContainerStyle={styles.modalContent}>
                    {section}
                  </ScrollView>
                </View>
              </Modal>
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
    paddingTop: 4,
    paddingBottom: 20,
    paddingLeft: 16,
    paddingRight: 16,
  },
  group: {
    borderRadius: 18,
    borderWidth: 0.5,
    marginBottom: 14,
    overflow: 'hidden',
  },
  divider: {
    height: 0.5,
    marginLeft: 66,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 13,
    paddingBottom: 13,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowText: {
    flexGrow: 1,
    flexShrink: 1,
  },
  rowTitle: {
    fontWeight: '500',
  },
  rowDesc: {
    marginTop: 3,
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
    paddingBottom: 40,
  },
})
