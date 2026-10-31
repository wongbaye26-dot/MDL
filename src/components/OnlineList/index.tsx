import { useRef, forwardRef, useImperativeHandle, useState } from 'react'
import { View, TouchableOpacity } from 'react-native'
// import LoadingMask, { LoadingMaskType } from '@/components/common/LoadingMask'
import List, { type ListProps, type ListType, type Status, type RowInfoType } from './List'
import ListMenu, { type ListMenuType, type Position, type SelectInfo } from './ListMenu'
import ListMusicMultiAdd, { type MusicMultiAddModalType as ListAddMultiType } from '@/components/MusicMultiAddModal'
import ListMusicAdd, { type MusicAddModalType as ListMusicAddType } from '@/components/MusicAddModal'
import MultipleModeBar, { type MultipleModeBarType, type SelectMode } from './MultipleModeBar'
import DownloadQualityModal, { type DownloadQualityModalType } from '@/components/DownloadQualityModal'
import { clearMusicUrl, handleDislikeMusic, handlePlay, handlePlayLater, handleShare, handleShowMusicSourceDetail } from './listAction'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'

export interface OnlineListProps {
  onRefresh: ListProps['onRefresh']
  onLoadMore: ListProps['onLoadMore']
  onPlayList?: ListProps['onPlayList']
  progressViewOffset?: ListProps['progressViewOffset']
  ListHeaderComponent?: ListProps['ListHeaderComponent']
  checkHomePagerIdle?: boolean
  rowType?: RowInfoType
  /** 显示歌曲名次（排行榜场景） */
  showRank?: boolean
  /** 隐藏「列表/卡片」切换栏 */
  hideModeBar?: boolean
}
export interface OnlineListType {
  setList: (list: LX.Music.MusicInfoOnline[], isAppend?: boolean, showSource?: boolean) => void
  setStatus: (val: Status) => void
}

export default forwardRef<OnlineListType, OnlineListProps>(({
  onRefresh,
  onLoadMore,
  onPlayList,
  progressViewOffset,
  ListHeaderComponent,
  checkHomePagerIdle = false,
  rowType,
  showRank,
  hideModeBar,
}, ref) => {
  const listRef = useRef<ListType>(null)
  const multipleModeBarRef = useRef<MultipleModeBarType>(null)
  const listMusicAddRef = useRef<ListMusicAddType>(null)
  const listMusicMultiAddRef = useRef<ListAddMultiType>(null)
  const listMenuRef = useRef<ListMenuType>(null)
  const downloadModalRef = useRef<DownloadQualityModalType>(null)
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list')
  const theme = useTheme()
  // const loadingMaskRef = useRef<LoadingMaskType>(null)

  useImperativeHandle(ref, () => ({
    setList(list, isAppend = false, showSource = false) {
      listRef.current?.setList(list, isAppend, showSource)
      multipleModeBarRef.current?.setIsSelectAll(false)
    },
    setStatus(val) {
      listRef.current?.setStatus(val)
    },
  }))

  const hancelMultiSelect = () => {
    multipleModeBarRef.current?.show()
    listRef.current?.setIsMultiSelectMode(true)
  }
  const hancelSwitchSelectMode = (mode: SelectMode) => {
    multipleModeBarRef.current?.setSwitchMode(mode)
    listRef.current?.setSelectMode(mode)
  }
  const hancelExitSelect = () => {
    multipleModeBarRef.current?.exitSelectMode()
    listRef.current?.setIsMultiSelectMode(false)
  }

  const showMenu = (musicInfo: LX.Music.MusicInfoOnline, index: number, position: Position) => {
    listMenuRef.current?.show({
      musicInfo,
      index,
      single: false,
      selectedList: listRef.current!.getSelectedList(),
    }, position)
  }
  const handleDownload = (info: SelectInfo) => {
    const musicInfos = info.selectedList.length ? info.selectedList : [info.musicInfo]
    downloadModalRef.current?.show({ musicInfos })
  }
  const handleAddMusic = (info: SelectInfo) => {
    if (info.selectedList.length) {
      listMusicMultiAddRef.current?.show({ selectedList: info.selectedList, listId: '', isMove: false })
    } else {
      listMusicAddRef.current?.show({ musicInfo: info.musicInfo, listId: '', isMove: false })
    }
  }

  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        {
          hideModeBar
            ? null
            : (
              <View style={styles.modeBar}>
                <TouchableOpacity onPress={() => { setViewMode('list') }} style={{ ...styles.modeBtn, backgroundColor: viewMode === 'list' ? theme['c-primary-alpha-700'] : 'rgba(0,0,0,0)' }}>
                  <Text size={11} color={viewMode === 'list' ? theme['c-primary-light-200'] : theme['c-450']}>列表</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setViewMode('card') }} style={{ ...styles.modeBtn, backgroundColor: viewMode === 'card' ? theme['c-primary-alpha-700'] : 'rgba(0,0,0,0)' }}>
                  <Text size={11} color={viewMode === 'card' ? theme['c-primary-light-200'] : theme['c-450']}>卡片</Text>
                </TouchableOpacity>
              </View>
              )
        }
        <List
          ref={listRef}
          onShowMenu={showMenu}
          onMuiltSelectMode={hancelMultiSelect}
          onSelectAll={isAll => multipleModeBarRef.current?.setIsSelectAll(isAll)}
          onRefresh={onRefresh}
          onLoadMore={onLoadMore}
          onPlayList={onPlayList}
          progressViewOffset={progressViewOffset}
          ListHeaderComponent={ListHeaderComponent}
          checkHomePagerIdle={checkHomePagerIdle}
          rowType={rowType}
          viewMode={viewMode}
          showRank={showRank}
        />
        <MultipleModeBar
          ref={multipleModeBarRef}
          onSwitchMode={hancelSwitchSelectMode}
          onSelectAll={isAll => listRef.current?.selectAll(isAll)}
          onExitSelectMode={hancelExitSelect}
        />
      </View>
      <ListMusicAdd ref={listMusicAddRef} onAdded={() => { hancelExitSelect() }} />
      <ListMusicMultiAdd ref={listMusicMultiAddRef} onAdded={() => { hancelExitSelect() }} />
      <ListMenu
        ref={listMenuRef}
        onPlay={info => { handlePlay(info.musicInfo) }}
        onPlayLater={info => { hancelExitSelect(); handlePlayLater(info.musicInfo, info.selectedList, hancelExitSelect) }}
        onCopyName={info => { handleShare(info.musicInfo) }}
        onAdd={handleAddMusic}
        onDownload={handleDownload}
        onMusicSourceDetail={info => { void handleShowMusicSourceDetail(info.musicInfo) }}
        onRemoveCache={info => { void clearMusicUrl(info.musicInfo) }}
        onDislikeMusic={info => { void handleDislikeMusic(info.musicInfo) }}
      />
      <DownloadQualityModal ref={downloadModalRef} />
      {/* <LoadingMask ref={loadingMaskRef} /> */}
    </View>
  )
})


const styles = createStyle({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  list: {
    flex: 1,
  },
  modeBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingRight: 12,
    paddingBottom: 2,
  },
  modeBtn: {
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 4,
    paddingBottom: 4,
    borderRadius: 9,
    marginLeft: 6,
  },
  exitMultipleModeBtn: {
    height: 40,
  },
})

