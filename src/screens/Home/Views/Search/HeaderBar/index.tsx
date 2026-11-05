import { useRef, forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Chip from '@/components/common/Chip'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { useSourceListI18n } from '@/components/SourceSelector'
import { useKeyboard } from '@/utils/hooks'
import SearchInput, { type SearchInputType, type SearchInputProps } from './SearchInput'
import SearchTypeSelector from '../SearchTypeSelector'
import { createStyle } from '@/utils/tools'

type Source = LX.OnlineSource | 'all'

export interface HeaderBarProps {
  onClose: () => void
  onSourceChange: (source: Source) => void
  onTipSearch: SearchInputProps['onChangeText']
  onSearch: SearchInputProps['onSubmit']
  onHideTipList: SearchInputProps['onBlur']
  onShowTipList: SearchInputProps['onTouchStart']
}

export interface HeaderBarType {
  setSourceList: (list: Readonly<Source[]>, source: Source) => void
  setText: SearchInputType['setText']
  blur: SearchInputType['blur']
}


export default forwardRef<HeaderBarType, HeaderBarProps>(({
  onClose,
  onSourceChange,
  onTipSearch,
  onSearch,
  onHideTipList,
  onShowTipList,
}, ref) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const searchInputRef = useRef<SearchInputType>(null)
  const [sources, setSources] = useState<Readonly<Source[]>>([])
  const [source, setSource] = useState<Source>('all')
  /**
   * 键盘弹起后页面可视高度会被压得很矮（实测只剩一两行热词的高度）。
   * 这时把「歌曲/歌单 + 音源」这一排筛选暂时收起来，把空间全部让给
   * 热门搜索/历史搜索（它们会切到紧凑布局），否则用户只看得到一行。
   * 键盘收起（提交搜索/失焦）后筛选行自动回来。
   */
  const { keyboardShown } = useKeyboard()

  useImperativeHandle(ref, () => ({
    setSourceList(list, source) {
      setSources(list)
      setSource(source)
    },
    setText(text) {
      searchInputRef.current?.setText(text)
    },
    blur() {
      searchInputRef.current?.blur()
    },
  }), [])

  const sourceList = useMemo(() => {
    const list = [...sources]
    const allIndex = list.indexOf('all')
    if (allIndex > 0) {
      list.splice(allIndex, 1)
      list.unshift('all')
    }
    return list
  }, [sources])
  const sourceLabels = useSourceListI18n(sourceList)

  return (
    <View style={{ ...styles.header, paddingTop: statusBarHeight }}>
      <View style={styles.searchRow}>
        <TouchableOpacity
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={onClose}
        >
          <Icon name='chevron-left-2' size={21} color={theme['c-font']} />
        </TouchableOpacity>
        <View style={{
          ...styles.searchBox,
          backgroundColor: theme['c-primary-alpha-900'],
          borderColor: theme['c-primary-alpha-700'],
        }}>
          <Icon name='search-2' size={15} color={theme['c-450']} style={styles.searchIcon} />
          <SearchInput
            ref={searchInputRef}
            onChangeText={onTipSearch}
            onSubmit={onSearch}
            onBlur={onHideTipList}
            onTouchStart={onShowTipList}
          />
        </View>
      </View>

      {
        // 键盘弹起时收起筛选行，把高度让给下方热门/历史搜索（见 keyboardShown 注释）
        keyboardShown
          ? null
          : (
            <View style={styles.filterRow}>
              <SearchTypeSelector />
              <View style={{ ...styles.divider, backgroundColor: theme['c-primary-alpha-700'] }} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sourceRow}
              >
                {
                  sourceLabels.map(({ label, action }) => (
                    <Chip
                      key={action}
                      size='sm'
                      label={label}
                      active={action === source}
                      onPress={() => {
                        if (action === source) return
                        setSource(action)
                        onSourceChange(action)
                      }}
                    />
                  ))
                }
              </ScrollView>
            </View>
            )
      }
    </View>
  )
})

const styles = createStyle({
  header: {
    paddingBottom: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 14,
    paddingTop: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBox: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 20,
    borderWidth: 0.5,
    paddingLeft: 12,
    paddingRight: 6,
  },
  searchIcon: {
    marginRight: 6,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 12,
    paddingTop: 8,
  },
  divider: {
    width: 1,
    height: 14,
    marginLeft: 4,
    marginRight: 10,
  },
  sourceRow: {
    alignItems: 'center',
  },
})
