import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { type Source, type InitState } from '@/store/hotSearch/state'
import { getList } from '@/core/hotSearch'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'

const HOT_LIMIT = 10
/**
 * 一行放 2 个热词，10 条正好 5 行。
 * 之前是 5 列 × 2 行，一行太窄，长关键词会被截断成省略号；改成两列宽胶囊后
 * 关键词能完整显示，整体高度也只比原来多三行（历史搜索仍在下方）。
 */
const COLUMNS = 2
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
                {/* 两列宽胶囊：正常长度的热词完整显示，特别长的再省略号 */}
                <Text size={11.5} numberOfLines={1} style={styles.word}>{keyword}</Text>
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
  /** 2 列等分：每格 50%，左右各留 4dp 间隙 */
  cell: {
    width: `${100 / COLUMNS}%`,
    paddingLeft: 4,
    paddingRight: 4,
    paddingBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 15,
    borderWidth: 0.5,
  },
  rank: {
    minWidth: 12,
    marginRight: 5,
    fontWeight: '700',
  },
  word: {
    flexGrow: 1,
    flexShrink: 1,
  },
})
