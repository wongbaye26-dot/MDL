import { useEffect, useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'

import SearchTypeIcon, { type SearchTypeIconType } from '@/components/common/SearchTypeIcon'
import { useTheme } from '@/store/theme/hook'
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
  const theme = useTheme()
  const [type, setType] = useState<SearchType>('music')

  useEffect(() => {
    void getSearchSetting().then(info => {
      setType(info.type)
    })
  }, [])

  const list = useMemo(() => {
    return SEARCH_TYPE_LIST.map(type => ({
      label: t(`search_type_${type}`),
      id: type,
      // 目前 SearchType 只有 music / songlist 两种，聚合不是搜索类型（聚合是音源 'all'）
      icon: type as SearchTypeIconType,
    }))
  }, [t])

  const handleTypeChange = (newType: SearchType) => {
    if (newType === type) return
    setType(newType)
    global.app_event.searchTypeChanged(newType)
  }

  return (
    <View style={styles.row}>
      {
        list.map(item => {
          const active = item.id === type
          // 和来源 SourceChip 完全同规格：34dp 透明热区 + 18dp 单色图标、无胶囊底。
          // 选中=主题主色，未选中=c-450；按压时整体透明度下降给反馈。
          const iconColor = active ? theme['c-primary'] : theme['c-450']
          return (
            <Pressable
              key={item.id}
              accessibilityRole='button'
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              hitSlop={6}
              onPress={() => { if (!active) handleTypeChange(item.id) }}
              style={({ pressed }) => ({
                width: 34,
                height: 34,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <SearchTypeIcon type={item.icon} size={18} color={iconColor} />
            </Pressable>
          )
        })
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
