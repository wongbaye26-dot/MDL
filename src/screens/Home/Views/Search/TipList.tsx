import { useRef, useImperativeHandle, forwardRef, useState, useEffect, useMemo } from 'react'
import SearchTipList, { type SearchTipListProps as _SearchTipListProps, type SearchTipListType as _SearchTipListType } from '@/components/SearchTipList'
import { TouchableOpacity } from 'react-native'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeH } from '@/utils/pixelRatio'
import musicSdk from '@/utils/musicSdk'
import searchState, { type InitState as SearchState } from '@/store/search/state'
import { setSearchText, setTipList, setTipListInfo } from '@/core/search/search'
import { debounce } from '@/utils'

export const ITEM_HEIGHT = scaleSizeH(44)

export const debounceTipSearch = debounce((keyword: string, source: SearchState['temp_source'], callback: (list: string[]) => void) => {
  // console.log(reslutList)
  void musicSdk[source].tipSearch.search(keyword).then(callback)
}, 200)


export type SearchTipListProps = _SearchTipListProps<string>
export type SearchTipListType = _SearchTipListType<string>

interface TipListProps {
  onSearch: (keyword: string) => void
}
export interface TipListType {
  search: (keyword: string, height: number) => void
  show: (height: number) => void
  hide: () => void
}

export default forwardRef<TipListType, TipListProps>(({ onSearch }, ref) => {
  const searchTipListRef = useRef<SearchTipListType>(null)
  const [visible, setVisible] = useState(false)
  const visibleListRef = useRef(false)
  const isUnmountedRef = useRef(false)

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  const handleSearch = (keyword: string, height: number) => {
    searchTipListRef.current?.setHeight(height)
    setSearchText(keyword)
    if (keyword) {
      setTipListInfo(keyword, searchState.temp_source)
      debounceTipSearch(keyword, searchState.temp_source, (list) => {
        if (keyword != searchState.tipListInfo.text) return
        setTipList(list)
        if (!visibleListRef.current || isUnmountedRef.current) return
        searchTipListRef.current?.setList(list)
      })
    } else {
      setTipListInfo(keyword, searchState.temp_source)
      setTipList([])
      searchTipListRef.current?.setList([])
    }
  }

  const handleShowList = (height: number) => {
    searchTipListRef.current?.setHeight(height)
    if (searchState.tipListInfo.list.length) {
      visibleListRef.current = true
      searchTipListRef.current?.setList([...searchState.tipListInfo.list])
    }
  }

  useImperativeHandle(ref, () => ({
    search(keyword, height) {
      if (visible) handleSearch(keyword, height)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          handleSearch(keyword, height)
        })
      }
    },
    show(height) {
      visibleListRef.current = true
      if (visible) handleShowList(height)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          handleShowList(height)
        })
      }
    },
    hide() {
      requestAnimationFrame(() => {
        visibleListRef.current = false
        searchTipListRef.current?.setList([])
      })
    },
  }), [visible])

  const renderItem: SearchTipListProps['renderItem'] = ({ item, index }) => {
    return (
      <TipRow keyword={searchState.tipListInfo.text} text={item} onPress={() => { onSearch(item) }} key={index} />
    )
  }
  const getkey: SearchTipListProps['keyExtractor'] = (item, index) => String(index)
  const getItemLayout: SearchTipListProps['getItemLayout'] = (data, index) => {
    return { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
  }

  return (
    visible
      ? <SearchTipList
          ref={searchTipListRef}
          renderItem={renderItem}
          onPressBg={() => searchTipListRef.current?.setList([])}
          keyExtractor={getkey}
          getItemLayout={getItemLayout}
        />
      : null
  )
})


const TipRow = ({ text, keyword, onPress }: { text: string, keyword: string, onPress: () => void }) => {
  const theme = useTheme()

  const parts = useMemo(() => {
    const key = keyword.trim()
    if (!key) return [{ text, match: false }]
    const lowerText = text.toLowerCase()
    const lowerKey = key.toLowerCase()
    const result: Array<{ text: string, match: boolean }> = []
    let start = 0
    let index = lowerText.indexOf(lowerKey, start)
    while (index > -1) {
      if (index > start) result.push({ text: text.slice(start, index), match: false })
      result.push({ text: text.slice(index, index + key.length), match: true })
      start = index + key.length
      index = lowerText.indexOf(lowerKey, start)
    }
    if (start < text.length) result.push({ text: text.slice(start), match: false })
    return result.length ? result : [{ text, match: false }]
  }, [text, keyword])

  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.65} onPress={onPress}>
      <Icon name='magnify' size={14} color={theme['c-400']} style={styles.itemIcon} />
      <Text size={14} numberOfLines={1} style={styles.itemText}>
        {
          parts.map((part, index) => (
            part.match
              ? <Text key={index} size={14} color={theme['c-primary-light-200']}>{part.text}</Text>
              : <Text key={index} size={14}>{part.text}</Text>
          ))
        }
      </Text>
      <Icon name='arrow-top-left' size={13} color={theme['c-350']} />
    </TouchableOpacity>
  )
}

const styles = createStyle({
  item: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 18,
  },
  itemIcon: {
    marginRight: 10,
  },
  itemText: {
    flexGrow: 1,
    flexShrink: 1,
  },
})

