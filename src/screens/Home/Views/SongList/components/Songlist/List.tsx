import { useRef, useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import { FlatList, View, RefreshControl, type FlatListProps } from 'react-native'

import ListItem from './ListItem'
// import { navigations } from '@/navigation'
import { type ListInfoItem } from '@/store/songlist/state'
import { useHorizontalMode, useLayout } from '@/utils/hooks'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { scaleSizeW } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { NAV_BAR_SPACE } from '@/config/constant'
import EmptyState from '../EmptyState'

type FlatListType = FlatListProps<ListInfoItem>

/**
 * 歌单广场网格：固定两列大卡片。
 *
 * 之前是 3~6 列（按宽度算，竖屏 3 列），封面小、标题挤成两行看不清。
 * 现在固定 2 列：封面 1:1、圆角 16、列间距 12、行间距 16（Item 的 marginBottom），
 * 标题最多两行 + 创建者一行 + 播放量角标，和「本地音乐卡片模式」同一套语言。
 */
const COLUMNS = 2
const PADDING = scaleSizeW(16)
const GAP = scaleSizeW(12)

export interface ListProps {
  onRefresh: () => void
  onLoadMore: () => void
  onOpenDetail: (item: ListInfoItem, index: number) => void
}
export type Status = 'loading' | 'refreshing' | 'end' | 'error' | 'idle'

export interface ListType {
  setList: (list: ListInfoItem[], showSource?: boolean) => void
  setStatus: (val: Status) => void
}

export default forwardRef<ListType, ListProps>(({ onRefresh, onLoadMore, onOpenDetail }, ref) => {
  const flatListRef = useRef<FlatList>(null)
  const [currentList, setList] = useState<ListInfoItem[]>([])
  const [showSource, setShowSource] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const { onLayout, width } = useLayout()
  const isHorizontalMode = useHorizontalMode()
  const theme = useTheme()
  // console.log('render songlist')

  useImperativeHandle(ref, () => ({
    setList(list, showSource = false) {
      // rawListRef.current = list
      setList(list)
      setShowSource(showSource)
    },
    setStatus(val) {
      setStatus(val)
    },
  }))

  const handleLoadMore = () => {
    if (status != 'idle') return
    onLoadMore()
  }

  const renderItem: FlatListType['renderItem'] = ({ item, index }) => (
    <ListItem
      item={item}
      index={index}
      width={rowInfo.width}
      showSource={showSource}
      onPress={onOpenDetail}
    />
  )
  const getkey: FlatListType['keyExtractor'] = item => item.id
  const refreshControl = useMemo(() => (
    <RefreshControl
      colors={[theme['c-primary']]}
      // progressBackgroundColor={theme.primary}
      refreshing={status == 'refreshing'}
      onRefresh={onRefresh} />
  ), [status, onRefresh, theme])
  const footerComponent = useMemo(() => {
    let label: FooterLabel
    switch (status) {
      case 'refreshing': return null
      case 'loading':
        label = 'list_loading'
        break
      case 'end':
        label = 'list_end'
        break
      case 'error':
        label = 'list_error'
        break
      case 'idle':
        label = null
        break
    }
    return (
      <View style={{ width: '100%' }}>
        <Footer label={label} onLoadMore={onLoadMore} />
      </View>
    )
  }, [onLoadMore, status])

  // 竖屏固定两列；横屏可视宽度翻倍，排四列才不会一张卡片占掉半屏
  const columns = isHorizontalMode ? COLUMNS * 2 : COLUMNS
  // 卡片宽度：可用宽度去掉左右 16 与列间距后按列数平分
  const rowInfo = useMemo(() => {
    const available = width - PADDING * 2
    return {
      num: columns,
      width: (available - GAP * (columns - 1)) / columns,
    }
  }, [width, columns])

  // 用空白项把最后一行补齐，保证 columnWrapperStyle 的 space-between 不会把最后一张拉满
  const list = useMemo(() => {
    const list = [...currentList]
    const whiteItemNum = list.length % rowInfo.num
    if (whiteItemNum > 0) {
      for (let i = 0; i < rowInfo.num - whiteItemNum; i++) {
        list.push({
          id: `white__${i}`,
          play_count: '',
          author: '',
          name: '',
          img: '',
          desc: '',
          // @ts-expect-error
          source: '',
        })
      }
    }
    return list
  }, [currentList, rowInfo])

  /**
   * 这个工程的 VirtualizedList 只会渲染 initialNumToRender 那一批（滚动不再补），
   * 之前默认 10 个格子 = 3 行多就没了，看起来像「列表只有一屏」。两列后行数翻倍，
   * 直接把初始批次设成当前列表长度，保证整页数据都渲染出来。
   */
  const renderAll = Math.max(6, list.length)
  // 只有「加载完且真的没有数据」才展示空态；加载失败交给 footer 的「点击重试」
  const emptyComponent = useMemo(() => {
    if (status !== 'end') return null
    return (
      <EmptyState
        icon='album'
        title='没有找到歌单'
        tip='换一个音源、排序或分类试试'
      />
    )
  }, [status])

  return (
    <View style={styles.container} onLayout={onLayout}>
      {
        width == 0
          ? null
          : (
              <FlatList
                key={String(rowInfo.num)}
                ref={flatListRef}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                columnWrapperStyle={styles.row}
                numColumns={rowInfo.num}
                data={list}
                maxToRenderPerBatch={renderAll}
                windowSize={21}
                removeClippedSubviews={false}
                initialNumToRender={renderAll}
                renderItem={renderItem}
                keyExtractor={getkey}
                onEndReachedThreshold={0.6}
                onEndReached={handleLoadMore}
                refreshControl={refreshControl}
                ListFooterComponent={footerComponent}
                ListEmptyComponent={emptyComponent}
              />
            )
      }
    </View>
  )
})

type FooterLabel = 'list_loading' | 'list_end' | 'list_error' | null
const Footer = ({ label, onLoadMore }: {
  label: FooterLabel
  onLoadMore: () => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const handlePress = () => {
    if (label != 'list_error') return
    onLoadMore()
  }
  return (
    label
      ? (
          <View>
            <Text onPress={handlePress} style={styles.footer} color={theme['c-font-label']}>{t(label)}</Text>
          </View>
        )
      : null
  )
}


const styles = createStyle({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 4,
    paddingBottom: NAV_BAR_SPACE,
  },
  row: {
    justifyContent: 'space-between',
  },
  footer: {
    textAlign: 'center',
    padding: 10,
  },
})
