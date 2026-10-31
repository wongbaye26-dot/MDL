import { useRef, forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Chip from '@/components/common/Chip'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { useSourceListI18n } from '@/components/SourceSelector'
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
