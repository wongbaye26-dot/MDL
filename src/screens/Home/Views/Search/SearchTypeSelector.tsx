import { useEffect, useMemo, useState } from 'react'
import { Pressable } from 'react-native'

import SearchTypeIcon, { type SearchTypeIconType } from '@/components/common/SearchTypeIcon'
import { useTheme } from '@/store/theme/hook'
import { type SearchType } from '@/store/search/state'
import { useI18n } from '@/lang'
import { getSearchSetting } from '@/utils/data'

const SEARCH_TYPE_LIST = [
  'music',
  'songlist',
] as const

export default ({ boxSize = 38, iconSize = 22 }: {
  /** 图标热区边长（dp），和来源 SourceChip 的 lg 档位一致 */
  boxSize?: number
  /** 单色图标边长（dp） */
  iconSize?: number
} = {}) => {
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

  // 返回 Fragment：两个图标按钮直接作为筛选行（space-between 那一行）的子项参与均分，
  // 这样「歌曲/歌单」和分隔线、来源图标之间的间距才会完全均匀、整行铺满竖屏宽度。
  return (
    <>
      {
        list.map(item => {
          const active = item.id === type
          // 和来源 SourceChip 的 lg 档位同规格：38dp 透明热区 + 22dp 单色图标、无胶囊底。
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
                width: boxSize,
                height: boxSize,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <SearchTypeIcon type={item.icon} size={iconSize} color={iconColor} />
            </Pressable>
          )
        })
      }
    </>
  )
}
