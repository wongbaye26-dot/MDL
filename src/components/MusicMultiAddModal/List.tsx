import { useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useMyList } from '@/store/list/hook'
import CreateUserList from '../MusicAddModal/CreateUserList'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { Space, Type } from '@/theme/designTokens'

export default ({ listId, onPress }: {
  listId: string
  onPress: (listInfo: LX.List.MyListInfo) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const allList = useMyList().filter(l => l.id != listId)
  const [creating, setCreating] = useState(false)

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {allList.map(info => (
        <TouchableOpacity
          key={info.id}
          style={styles.row}
          activeOpacity={0.72}
          onPress={() => { onPress(info) }}
          accessibilityRole='button'
          accessibilityLabel={info.name}
        >
          <View style={[styles.rowIcon, { backgroundColor: theme['c-primary-alpha-900'] }]}>
            <Icon name={info.id === 'love' ? 'heart' : info.id === 'temp' ? 'clock-outline' : 'playlist-music'} size={18} color={theme['c-primary']} />
          </View>
          <Text size={Type.rowTitle.fontSize} numberOfLines={1} style={styles.rowName}>{info.name}</Text>
          <Icon name='plus-circle-outline' size={20} color={theme['c-450']} />
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={[styles.row, styles.createRow, { borderColor: theme['c-primary-alpha-700'] }]}
        activeOpacity={0.72}
        onPress={() => { setCreating(true) }}
        accessibilityRole='button'
        accessibilityLabel={t('list_create')}
      >
        <View style={[styles.rowIcon, { backgroundColor: theme['c-primary-alpha-900'] }]}>
          <Icon name='plus' size={19} color={theme['c-primary']} />
        </View>
        <Text size={Type.rowTitle.fontSize} color={theme['c-primary']} style={styles.rowName}>{t('list_create')}</Text>
      </TouchableOpacity>
      {creating ? <CreateUserList isEdit onHide={() => { setCreating(false) }} /> : null}
    </ScrollView>
  )
}

const styles = createStyle({
  scroll: { flexGrow: 0 },
  list: { paddingLeft: Space.lg, paddingRight: Space.lg, paddingBottom: Space.xl },
  row: { flexDirection: 'row', alignItems: 'center', height: 52, borderBottomWidth: 0.5, borderBottomColor: 'rgba(128,128,128,0.16)' },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: Space.md },
  rowName: { flex: 1, minWidth: 0 },
  createRow: { marginTop: Space.md, height: 48, borderWidth: 0.5, borderStyle: 'dashed', borderRadius: 14, paddingLeft: 8, paddingRight: 8 },
})
