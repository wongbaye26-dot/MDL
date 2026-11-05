import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { type InitState } from '@/store/hotSearch/state'
import Chip from '@/components/common/Chip'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { clearHistoryList, getSearchHistory, removeHistoryWord } from '@/core/search/search'
import { Icon } from '@/components/common/Icon'

export type List = NonNullable<InitState['sourceList'][keyof InitState['sourceList']]>

interface HistorySearchProps {
  onSearch: (keyword: string) => void
  /** 键盘弹出 / 可视区很矮时的紧凑布局（小胶囊、更小的标题间距，保证能多显示几行） */
  compact?: boolean
}
export interface HistorySearchType {
  show: () => void
}

export default forwardRef<HistorySearchType, HistorySearchProps>((props, ref) => {
  const [list, setList] = useState<List>([])
  const isUnmountedRef = useRef(false)
  const t = useI18n()
  const theme = useTheme()
  const compact = props.compact === true

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  useImperativeHandle(ref, () => ({
    show() {
      void getSearchHistory().then((list) => {
        if (isUnmountedRef.current) return
        setList(list)
      })
    },
  }), [])

  const handleClear = () => {
    clearHistoryList()
    setList([])
  }

  const handleRemove = useCallback((keyword: string) => {
    setList(list => {
      list = [...list]
      const index = list.indexOf(keyword)
      list.splice(index, 1)
      removeHistoryWord(index)
      return list
    })
  }, [])

  if (!list.length) return null

  return (
    <View>
      <View style={compact ? styles.titleContentCompact : styles.titleContent}>
        <Text size={compact ? 12 : 14} style={styles.title}>{t('search_history_search')}</Text>
        <TouchableOpacity
          onPress={handleClear}
          style={styles.titleBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="eraser" color={theme['c-350']} size={compact ? 12 : 14} />
        </TouchableOpacity>
      </View>
      <View style={compact ? styles.listCompact : styles.list}>
        {
          list.map(keyword => (
            <View key={keyword} style={styles.chipWrap}>
              <Chip
                soft
                size={compact ? 'sm' : 'md'}
                label={keyword}
                onPress={() => { props.onSearch(keyword) }}
                onLongPress={() => { handleRemove(keyword) }}
              />
            </View>
          ))
        }
      </View>
    </View>
  )
})


const styles = createStyle({
  titleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 22,
  },
  titleContentCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
  },
  title: {
    fontWeight: '700',
  },
  titleBtn: {
    marginLeft: 8,
    padding: 4,
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  listCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  chipWrap: {
    marginBottom: 8,
  },
})
