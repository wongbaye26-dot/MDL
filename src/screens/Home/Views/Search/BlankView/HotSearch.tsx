import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { type Source, type InitState } from '@/store/hotSearch/state'
import { getList } from '@/core/hotSearch'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'

const HOT_LIMIT = 10
/** 一行放 5 个热词，10 条正好两行（原来的竖排 10 行太高，把下面的历史搜索挤出去了） */
const COLUMNS = 5
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
            <View key={keyword} style={styles.cell}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={{
                  ...styles.chip,
                  backgroundColor: theme['c-primary-alpha-900'],
                  borderColor: theme['c-primary-alpha-700'],
                }}
                onPress={() => { props.onSearch(keyword) }}
              >
                <Text
                  size={9.5}
                  color={index < 3 ? RANK_COLORS[index] : theme['c-400']}
                  style={styles.rank}
                >{index + 1}</Text>
                {/* 一行只有一个关键词，超长直接省略号，别把 5 列撑歪 */}
                <Text size={11} numberOfLines={1} style={styles.word}>{keyword}</Text>
              </TouchableOpacity>
            </View>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  /** 5 列等分：每格 20%，左右各留 3dp 间隙 */
  cell: {
    width: `${100 / COLUMNS}%`,
    paddingLeft: 3,
    paddingRight: 3,
    paddingBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    paddingLeft: 7,
    paddingRight: 7,
    borderRadius: 15,
    borderWidth: 0.5,
  },
  rank: {
    minWidth: 11,
    marginRight: 3,
    fontWeight: '700',
  },
  word: {
    flexGrow: 0,
    flexShrink: 1,
  },
})
