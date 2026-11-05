import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { type Source, type InitState } from '@/store/hotSearch/state'
import { getList } from '@/core/hotSearch'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { setSpText } from '@/utils/pixelRatio'

const HOT_LIMIT = 10
/**
 * 一行放 2 个热词，10 条正好 5 行。
 * 之前是 5 列 × 2 行，一行太窄，长关键词会被截断成省略号；改成两列宽胶囊后
 * 关键词能完整显示，整体高度也只比原来多三行（历史搜索仍在下方）。
 *
 * 键盘弹起后可视高度会被压得很矮（只剩一两行热词的高度），这时切 compact：
 * 胶囊/间距收一档，标题也变小，保证一屏能看到多行、并且可以继续往下滚。
 */
const COLUMNS = 2
const RANK_COLORS = ['#F5B942', '#C9D3E0', '#D8915F']

interface ListProps {
  onSearch: (keyword: string) => void
  /** 键盘弹出 / 可视区很矮时的紧凑布局 */
  compact?: boolean
}
export interface HotSearchType {
  show: (source: Source) => void
}

export type List = NonNullable<InitState['sourceList'][keyof InitState['sourceList']]>

export default forwardRef<HotSearchType, ListProps>((props, ref) => {
  const [list, setList] = useState<List>([])
  const t = useI18n()
  const theme = useTheme()
  const compact = props.compact === true

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

  /**
   * 胶囊内文字的垂直居中样式。
   *
   * Android 的 TextView 默认带上下字体额外留白，固定高度胶囊里会显得偏上/偏下；
   * 这里关掉额外留白、用 textAlignVertical 居中，并把 lineHeight 压到字号 +2
   * （和 components/common/Tag 的规则一致），中英数混排也能对齐。
   */
  const centerText = (fontSize: number) => ({
    includeFontPadding: false,
    textAlignVertical: 'center' as const,
    lineHeight: setSpText(fontSize + 2),
  })

  return (
    <View>
      <Text
        size={compact ? 12 : 14}
        style={compact ? styles.titleCompact : styles.title}
      >{t('search_hot_search')}</Text>
      <View style={compact ? styles.listCompact : styles.list}>
        {
          list.slice(0, HOT_LIMIT).map((keyword, index) => (
            <View key={keyword} style={compact ? styles.cellCompact : styles.cell}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={{
                  ...(compact ? styles.chipCompact : styles.chip),
                  backgroundColor: theme['c-primary-alpha-900'],
                  borderColor: theme['c-primary-alpha-700'],
                }}
                onPress={() => { props.onSearch(keyword) }}
              >
                <Text
                  size={compact ? 9 : 9.5}
                  color={index < 3 ? RANK_COLORS[index] : theme['c-400']}
                  style={{ ...styles.rank, ...centerText(compact ? 9 : 9.5) }}
                >{index + 1}</Text>
                {/* 两列宽胶囊：正常长度的热词完整显示，特别长的再省略号 */}
                <Text
                  size={compact ? 10.5 : 11.5}
                  numberOfLines={1}
                  style={{ ...styles.word, ...centerText(compact ? 10.5 : 11.5) }}
                >{keyword}</Text>
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
  titleCompact: {
    paddingTop: 8,
    fontWeight: '700',
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  listCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  /** 2 列等分：每格 50%，左右各留 4dp 间隙 */
  cell: {
    width: `${100 / COLUMNS}%`,
    paddingLeft: 4,
    paddingRight: 4,
    paddingBottom: 8,
  },
  cellCompact: {
    width: `${100 / COLUMNS}%`,
    paddingLeft: 3,
    paddingRight: 3,
    paddingBottom: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 30,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 15,
    borderWidth: 0.5,
  },
  chipCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
    paddingLeft: 8,
    paddingRight: 8,
    borderRadius: 13,
    borderWidth: 0.5,
  },
  rank: {
    minWidth: 12,
    marginRight: 5,
    fontWeight: '700',
  },
  word: {
    // 不 flexGrow：让「序号 + 热词」整体在胶囊里水平居中；太长时再省略
    flexShrink: 1,
    textAlign: 'center',
  },
})
