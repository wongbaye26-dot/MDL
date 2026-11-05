import { useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { FlatList, type FlatListProps, View } from 'react-native'

// import { useMusicList } from '@/store/list/hook'
import ListItem from './ListItem'
import { createStyle, getRowInfo, type RowInfoType } from '@/utils/tools'
import type { Position } from './ListMenu'
import type { SelectMode } from './MultipleModeBar'
import { useTheme } from '@/store/theme/hook'
import settingState from '@/store/setting/state'
import { MULTI_SELECT_BAR_HEIGHT } from './MultipleModeBar'
import { NAV_BAR_SPACE } from '@/config/constant'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import { handlePlay } from './listAction'
import { useSettingValue } from '@/store/setting/hook'
import useAutoFetchPicUrls, { getCachedPicUrl } from './useAutoFetchPicUrls'

type FlatListType = FlatListProps<LX.Music.MusicInfoOnline>

export type {
  RowInfoType,
}

export interface ListProps {
  onShowMenu: (musicInfo: LX.Music.MusicInfoOnline, index: number, position: Position) => void
  onSelectAll: (isAll: boolean) => void
  onRefresh: () => void
  onLoadMore: () => void
  onPlayList?: (index: number) => void
  progressViewOffset?: number
  ListHeaderComponent?: FlatListType['ListEmptyComponent']
  checkHomePagerIdle: boolean
  rowType?: RowInfoType
  viewMode?: 'list' | 'card'
  showRank?: boolean
  /** 源数据没带封面时，异步按歌曲拉取在线封面（歌单详情用；默认关闭） */
  autoFetchPic?: boolean
  /** 源数据没带封面、补图又还没回来时用的兜底封面（一般传歌单封面） */
  fallbackPicUrl?: string
  ListEmptyComponent?: FlatListType['ListEmptyComponent']
}
export interface ListType {
  setList: (list: LX.Music.MusicInfoOnline[], isAppend: boolean, showSource: boolean) => void
  setIsMultiSelectMode: (isMultiSelectMode: boolean) => void
  setSelectMode: (mode: SelectMode) => void
  selectAll: (isAll: boolean) => void
  /** 多选入口：把指定下标的歌选中（配合 setIsMultiSelectMode(true) 使用） */
  selectItem: (index: number) => void
  getSelectedList: () => LX.Music.MusicInfoOnline[]
  getList: () => LX.Music.MusicInfoOnline[]
  setStatus: (val: Status) => void
}
export type Status = 'loading' | 'refreshing' | 'end' | 'error' | 'idle'


const List = forwardRef<ListType, ListProps>(({
  onShowMenu,
  onSelectAll,
  onRefresh,
  onLoadMore,
  onPlayList,
  progressViewOffset,
  ListHeaderComponent,
  checkHomePagerIdle,
  rowType,
  viewMode = 'list',
  showRank,
  autoFetchPic,
  fallbackPicUrl,
  ListEmptyComponent,
}, ref) => {
  // const t = useI18n()
  const flatListRef = useRef<FlatList>(null)
  const [currentList, setList] = useState<LX.Music.MusicInfoOnline[]>([])
  const [showSource, setShowSource] = useState(false)
  const isMultiSelectModeRef = useRef(false)
  const selectModeRef = useRef<SelectMode>('single')
  const prevSelectIndexRef = useRef(-1)
  const [selectedList, setSelectedList] = useState<LX.Music.MusicInfoOnline[]>([])
  const selectedListRef = useRef<LX.Music.MusicInfoOnline[]>([])
  const [visibleMultiSelect, setVisibleMultiSelect] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const rowInfo = useRef(getRowInfo(rowType))
  const isShowAlbumName = useSettingValue('list.isShowAlbumName')
  const isShowInterval = useSettingValue('list.isShowInterval')
  // 歌单详情：源接口不回单曲封面，这里异步补图并缓存（其它列表不开启，行为不变）
  const fetchedPicUrls = useAutoFetchPicUrls(currentList, !!autoFetchPic)
  /**
   * 行的封面地址：源数据自带 > 异步补到的 > 歌单封面兜底。
   * 全部为空时保持 undefined，Image 组件会显示原来的占位图。
   */
  const getItemPicUrl = (item: LX.Music.MusicInfoOnline) => {
    if (item.meta.picUrl) return item.meta.picUrl
    return fetchedPicUrls[item.id] ?? getCachedPicUrl(item.id) ?? fallbackPicUrl
  }
  // const currentListIdRef = useRef('')
  // console.log('render music list')

  useImperativeHandle(ref, () => ({
    setList(list, isAppend, showSource) {
      setList(list)
      setShowSource(showSource)
      if (!isAppend && selectedListRef.current.length) setSelectedList(selectedListRef.current = [])
    },
    setIsMultiSelectMode(isMultiSelectMode) {
      isMultiSelectModeRef.current = isMultiSelectMode
      if (!isMultiSelectMode) {
        prevSelectIndexRef.current = -1
        handleUpdateSelectedList([])
      }
      setVisibleMultiSelect(isMultiSelectMode)
    },
    setSelectMode(mode) {
      selectModeRef.current = mode
    },
    selectAll(isAll) {
      let list: LX.Music.MusicInfoOnline[]
      if (isAll) {
        list = [...currentList]
      } else {
        list = []
      }
      selectedListRef.current = list
      setSelectedList(list)
    },
    /** 多选入口：把指定下标的歌选中（菜单里的「多选管理」用） */
    selectItem(index) {
      const item = currentList[index]
      if (!item) return
      prevSelectIndexRef.current = index
      handleUpdateSelectedList([item])
    },
    getSelectedList() {
      return selectedListRef.current
    },
    getList() {
      return currentList
    },
    setStatus(val) {
      setStatus(val)
    },
  }))


  const handleUpdateSelectedList = (newList: LX.Music.MusicInfoOnline[]) => {
    if (selectedListRef.current.length && newList.length == currentList.length) onSelectAll(true)
    else if (selectedListRef.current.length == currentList.length) onSelectAll(false)
    selectedListRef.current = newList
    setSelectedList(newList)
  }
  const handleSelect = (item: LX.Music.MusicInfoOnline, pressIndex: number) => {
    let newList: LX.Music.MusicInfoOnline[]
    if (selectModeRef.current == 'single') {
      prevSelectIndexRef.current = pressIndex
      const index = selectedListRef.current.indexOf(item)
      if (index < 0) {
        newList = [...selectedListRef.current, item]
      } else {
        newList = [...selectedListRef.current]
        newList.splice(index, 1)
      }
    } else {
      if (selectedListRef.current.length) {
        const prevIndex = prevSelectIndexRef.current
        const currentIndex = pressIndex
        if (prevIndex == currentIndex) {
          newList = []
        } else if (currentIndex > prevIndex) {
          newList = currentList.slice(prevIndex, currentIndex + 1)
        } else {
          newList = currentList.slice(currentIndex, prevIndex + 1)
          newList.reverse()
        }
      } else {
        newList = [item]
        prevSelectIndexRef.current = pressIndex
      }
    }

    handleUpdateSelectedList(newList)
  }

  const handlePress = (item: LX.Music.MusicInfoOnline, index: number) => {
    requestAnimationFrame(() => {
      if (checkHomePagerIdle && !global.lx.homePagerIdle) return
      if (isMultiSelectModeRef.current) {
        handleSelect(item, index)
      } else {
        if (settingState.setting['list.isClickPlayList'] && onPlayList != null) {
          onPlayList(index)
        } else {
          // console.log(currentList[index])
          handlePlay(currentList[index])
        }
      }
    })
  }

  /**
   * 长按：不再直接进多选，改成和行尾 ⋮ 一样打开悬浮菜单（带着按下的屏幕坐标），
   * 多选统一从菜单里的「多选管理」进入，避免长按和更多操作两个手势互相抢。
   */
  const handleLongPress = (item: LX.Music.MusicInfoOnline, index: number, position: Position) => {
    if (isMultiSelectModeRef.current) return
    onShowMenu(item, index, position)
  }

  const handleLoadMore = () => {
    if (status != 'idle') return
    onLoadMore()
  }


  const renderItem: FlatListType['renderItem'] = ({ item, index }) => (
    <ListItem
      item={item}
      index={index}
      showSource={showSource}
      picUrl={getItemPicUrl(item)}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onShowMenu={onShowMenu}
      selectedList={selectedList}
      rowInfo={rowInfo.current}
      isShowAlbumName={isShowAlbumName}
      isShowInterval={isShowInterval}
      viewMode={viewMode}
      showRank={showRank}
    />
  )
  const getkey: FlatListType['keyExtractor'] = item => item.id
  /**
   * VirtualizedList 在本工程里只渲染 initialNumToRender 这一批：
   * 之后的批次要靠 onScroll 驱动，而这里滚动事件收不到（onEndReached 也从不触发），
   * 结果就是「列表只显示前 N 条、滚到底就黑」。
   * 这几个列表每页 30 条、总量最多几百条，直接把初始批次设成当前列表长度，
   * 保证整页数据都渲染出来；至少还能正常滚动和翻页。
   */
  const renderAll = Math.max(20, currentList.length)
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
      <View style={{ width: '100%', paddingBottom: NAV_BAR_SPACE + (visibleMultiSelect ? MULTI_SELECT_BAR_HEIGHT : 0) }} >
        <Footer label={label} onLoadMore={onLoadMore} />
      </View>
    )
  }, [onLoadMore, status, visibleMultiSelect])

  /**
   * 卡片模式一张卡片就是整行：横屏 rowNum 会变成 2，卡片会被塞进半宽的列里导致错位，
   * 所以 card 模式固定 1 列；list 模式保持原有的横屏两列行为。
   */
  const numColumns = viewMode === 'card' ? 1 : (rowInfo.current.rowNum ?? 1)

  return (
    <FlatList
      ref={flatListRef}
      style={styles.list}
      data={currentList}
      // numColumns 在 list/card 之间切换时会变，RN 不允许动态改列数，换 key 让 FlatList 重建
      key={`online-list-${numColumns}`}
      numColumns={numColumns}
      horizontal={false}
      maxToRenderPerBatch={renderAll}
      // updateCellsBatchingPeriod={80}
      windowSize={41}
      // 之前开了 removeClippedSubviews：Android 上滚过一屏之后单元格会被整体回收，
      // 又因为 getItemLayout 固定了偏移量，回收后不再重新挂载 ——
      // 表现就是「列表滚到第 12 条之后整片黑」。关掉它，虚拟化本身仍然生效。
      removeClippedSubviews={false}
      initialNumToRender={renderAll}
      renderItem={renderItem}
      keyExtractor={getkey}
      // getItemLayout 不传：行高虽固定，但横屏两列时偏移量要按列数折算，
      // 传错会让虚拟化算出错误的内容高度（表现为滚过一屏就整片黑），交给它自己量更稳
      // onRefresh={onRefresh}
      // refreshing={refreshing}
      onEndReachedThreshold={0.5}
      onEndReached={handleLoadMore}
      progressViewOffset={progressViewOffset}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={currentList.length ? null : (status === 'end' || status === 'error' ? ListEmptyComponent : null)}
      onRefresh={onRefresh}
      refreshing={status == 'refreshing'}
      ListFooterComponent={footerComponent}
    />
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
  },
  list: {
    flexGrow: 1,
    flexShrink: 1,
  },
  footer: {
    textAlign: 'center',
    padding: 10,
  },
})

export default List
