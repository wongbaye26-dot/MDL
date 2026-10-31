import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'

import Chip from '@/components/common/Chip'
import { createStyle } from '@/utils/tools'
import { type SearchType } from '@/store/search/state'
import { useI18n } from '@/lang'
import { getSearchSetting } from '@/utils/data'

const SEARCH_TYPE_LIST = [
  'music',
  'songlist',
] as const

export default () => {
  const t = useI18n()
  const [type, setType] = useState<SearchType>('music')

  useEffect(() => {
    void getSearchSetting().then(info => {
      setType(info.type)
    })
  }, [])

  const list = useMemo(() => {
    return SEARCH_TYPE_LIST.map(type => ({ label: t(`search_type_${type}`), id: type }))
  }, [t])

  const handleTypeChange = (newType: SearchType) => {
    if (newType === type) return
    setType(newType)
    global.app_event.searchTypeChanged(newType)
  }

  return (
    <View style={styles.row}>
      {
        list.map(item => (
          <Chip
            key={item.id}
            label={item.label}
            active={item.id === type}
            onPress={() => { if (item.id !== type) handleTypeChange(item.id) }}
          />
        ))
      }
    </View>
  )
}

const styles = createStyle({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
})
