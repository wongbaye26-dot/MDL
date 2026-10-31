import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { type Source, type InitState } from '@/store/hotSearch/state'
import { getList } from '@/core/hotSearch'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'

const HOT_LIMIT = 10
const RANK_COLORS = ['#F5B942', '#C9D3E0', '#D8915F']

interface ListProps {
  onSearch: (keyword: string) => void
}
export interface HotSearchType {
  show: (source: Source) => void
}

export type List = NonNullable<InitState['sourceList'][keyof InitState['sourceList']]>

export default forwardRef<HotSearchType, ListProps>((props, ref) => {
  const [list, setList] = useState<List>([])
  const t = useI18n()
  const theme = useTheme()

  const isUnmountedRef = useRef(false)
  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  useImperativeHandle(ref, () => ({
    show(source) {
      void getList(source).then((list) => {
        if (isUnmountedRef.current) return
        setList(list)
      })
    },
  }), [])

  if (!list.length) return null

  return (
    <View>
      <Text size={14} style={styles.title}>{t('search_hot_search')}</Text>
      <View style={styles.list}>
        {
          list.slice(0, HOT_LIMIT).map((keyword, index) => (
            <TouchableOpacity
              key={keyword}
              activeOpacity={0.7}
              style={styles.row}
              onPress={() => { props.onSearch(keyword) }}
            >
              <Text
                size={12}
                color={index < 3 ? RANK_COLORS[index] : theme['c-400']}
                style={styles.rank}
              >{index + 1}</Text>
              <Text size={13} numberOfLines={1} style={styles.word}>{keyword}</Text>
            </TouchableOpacity>
          ))
        }
      </View>
    </View>
  )
})

const styles = createStyle({
  title: {
    paddingTop: 16,
    fontWeight: '700',
  },
  list: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 9,
    paddingBottom: 9,
  },
  rank: {
    width: 26,
    fontWeight: '700',
  },
  word: {
    flexGrow: 1,
    flexShrink: 1,
  },
})
