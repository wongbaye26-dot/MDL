import { useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useMyList, useMusicExistsList } from '@/store/list/hook'
import CreateUserList from './CreateUserList'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'
import { Space, Type } from '@/theme/designTokens'

const Row = ({ listInfo, musicInfo, onPress }: {
  listInfo: LX.List.MyListInfo
  musicInfo: LX.Music.MusicInfo
  onPress: (listInfo: LX.List.MyListInfo) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const isExists = useMusicExistsList(listInfo, musicInfo)
  const handlePress = () => {
    if (isExists) {
      toast(t('list_add_tip_exists'))
      return
    }
    onPress(listInfo)
  }
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.72}
      onPress={handlePress}
      accessibilityRole='button'
      accessibilityLabel={listInfo.name}
    >
      <View style={[styles.rowIcon, { backgroundColor: theme['c-primary-alpha-900'] }]}>
        <Icon name={listInfo.id === 'love' ? 'heart' : listInfo.id === 'temp' ? 'clock-outline' : 'playlist-music'} size={18} color={theme['c-primary']} />
      </View>
      <Text size={Type.rowTitle.fontSize} numberOfLines={1} style={styles.rowName}>{listInfo.name}</Text>
      <Icon name={isExists ? 'check-circle' : 'plus-circle-outline'} size={20} color={isExists ? theme['c-primary'] : theme['c-450']} />
    </TouchableOpacity>
  )
}

export default ({ musicInfo, onPress }: {
  musicInfo: LX.Music.MusicInfo
  onPress: (listInfo: LX.List.MyListInfo) => void
}) => {
  const allList = useMyList()
  const [creating, setCreating] = useState(false)
  const theme = useTheme()

  const list = useMemo(() => allList, [allList])

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {list.map(info => <Row key={info.id} listInfo={info} musicInfo={musicInfo} onPress={onPress} />)}
      <TouchableOpacity
        style={[styles.row, styles.createRow, { borderColor: theme['c-primary-alpha-700'] }]}
        activeOpacity={0.72}
        onPress={() => { setCreating(true) }}
        accessibilityRole='button'
        accessibilityLabel='新建歌单'
      >
        <View style={[styles.rowIcon, { backgroundColor: theme['c-primary-alpha-900'] }]}>
          <Icon name='plus' size={19} color={theme['c-primary']} />
        </View>
        <Text size={Type.rowTitle.fontSize} color={theme['c-primary']} style={styles.rowName}>新建歌单</Text>
      </TouchableOpacity>
      {creating ? <CreateUserList isEdit onHide={() => { setCreating(false) }} /> : null}
    </ScrollView>
  )
}

const styles = createStyle({
  scroll: { flexGrow: 0 },
  list: { paddingLeft: Space.lg, paddingRight: Space.lg, paddingBottom: Space.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(128,128,128,0.16)',
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Space.md,
  },
  rowName: { flex: 1, minWidth: 0 },
  createRow: {
    marginTop: Space.md,
    height: 48,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingLeft: 8,
    paddingRight: 8,
  },
})
