import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'

import Chip from '@/components/common/Chip'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import LiquidGlass from '@/components/common/LiquidGlass'
import { createStyle } from '@/utils/tools'
import { getSongListSetting, saveSongListSetting } from '@/utils/data'
import { getTags } from '@/core/songlist'
import songlistState, { type Source, type TagInfoItem } from '@/store/songlist/state'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import List, { type ListType } from './List'
import OpenListModal, { type ModalType as OpenListModalType } from './HeaderBar/OpenList/Modal'
import { resetHeaderSources, setHeaderSources } from './headerSources'

interface SonglistInfo {
  source: Source
  sortId: string
  tagId: string
}

/**
 * 歌单广场的内容区。
 *
 * 版面和排行榜 / 本地音乐对齐：左右 16，筛选区只剩一排「排序 + 分类」胶囊
 * （md，横向滚动，两组之间用一条细竖线分隔）。
 * 来源图标不再单独占一排：已移到页头标题右侧（SongListScreen / Home PageModal 的
 * HeaderSourceBar），音源状态通过 headerSources 模块级 store 桥接到页头。
 */
export default () => {
  const t = useI18n()
  const theme = useTheme()
  const glassStyle = useSettingValue('common.navGlassStyle') ?? 'liquid'
  const listRef = useRef<ListType>(null)
  const openListModalRef = useRef<OpenListModalType>(null)
  const songlistInfo = useRef<SonglistInfo>({ source: 'kw', sortId: '', tagId: '' })
  const [source, setSource] = useState<Source>(songlistState.sources[0] ?? 'kw')
  const [sortId, setSortId] = useState('')
  const [tagId, setTagId] = useState('')
  const [tagName, setTagName] = useState('')
  const [hotTags, setHotTags] = useState<TagInfoItem[]>([])
  const sorts = songlistState.sortList[source] ?? []

  const loadHotTags = useCallback((src: Source) => {
    void getTags(src).then(info => {
      if (songlistInfo.current.source !== src) return
      setHotTags(info.hotTag ?? [])
    }).catch(() => {
      setHotTags([])
    })
  }, [])

  const loadList = useCallback((src: Source, sId: string, tId: string) => {
    listRef.current?.loadList(src, sId, tId)
  }, [])

  useEffect(() => {
    const handleOpenLink = () => {
      openListModalRef.current?.show(songlistInfo.current.source)
    }
    global.app_event.on('openSonglistLink', handleOpenLink)
    return () => {
      global.app_event.off('openSonglistLink', handleOpenLink)
    }
  }, [])

  useEffect(() => {
    void getSongListSetting().then(info => {
      const src = songlistState.sources.includes(info.source) ? info.source : (songlistState.sources[0] ?? 'kw')
      const sortList = songlistState.sortList[src] ?? []
      const sId = sortList.some(s => s.id === info.sortId) ? info.sortId : (sortList[0]?.id ?? '')
      songlistInfo.current = { source: src, sortId: sId, tagId: info.tagId }
      setSource(src)
      setSortId(sId)
      setTagId(info.tagId)
      setTagName(info.tagName)
      loadHotTags(src)
      loadList(src, sId, info.tagId)
    })
  }, [loadHotTags, loadList])

  useEffect(() => {
    const handleTagChange = (name: string, id: string) => {
      songlistInfo.current.tagId = id
      setTagId(id)
      setTagName(name)
      void saveSongListSetting({ tagName: name, tagId: id })
      loadList(songlistInfo.current.source, songlistInfo.current.sortId, id)
    }
    global.app_event.on('songlistTagInfoChange', handleTagChange)
    return () => {
      global.app_event.off('songlistTagInfoChange', handleTagChange)
    }
  }, [loadList])

  const handleSourceChange = useCallback((src: Source) => {
    const sortList = songlistState.sortList[src] ?? []
    const sId = sortList[0]?.id ?? ''
    songlistInfo.current = { source: src, sortId: sId, tagId: '' }
    setSource(src)
    setSortId(sId)
    setTagId('')
    setTagName('')
    setHotTags([])
    void saveSongListSetting({ source: src, sortId: sId, tagId: '', tagName: '' })
    loadHotTags(src)
    loadList(src, sId, '')
  }, [loadHotTags, loadList])

  // 把「来源列表 / 当前来源 / 切换回调」写给页头右侧的 HeaderSourceBar（页头不在本组件内）
  useEffect(() => {
    setHeaderSources({
      visible: true,
      sources: songlistState.sources,
      active: source,
      onChange: handleSourceChange,
    })
  }, [source, handleSourceChange])
  // 退出歌单广场时清掉，避免来源图标残留在别的页头
  useEffect(() => () => { resetHeaderSources() }, [])

  const handleSortChange = useCallback((id: string) => {
    songlistInfo.current.sortId = id
    setSortId(id)
    void saveSongListSetting({ sortId: id })
    loadList(songlistInfo.current.source, id, songlistInfo.current.tagId)
  }, [loadList])

  const handleTagChange = useCallback((name: string, id: string) => {
    songlistInfo.current.tagId = id
    setTagId(id)
    setTagName(name)
    void saveSongListSetting({ tagName: name, tagId: id })
    loadList(songlistInfo.current.source, songlistInfo.current.sortId, id)
  }, [loadList])

  const handleShowAllTags = useCallback(() => {
    global.app_event.showSonglistTagList(songlistInfo.current.source, songlistInfo.current.tagId)
  }, [])

  const handleOpenSonglist = useCallback((id: string) => {
    navigations.pushSonglistDetailScreen(commonState.componentIds.home!, {
      play_count: undefined,
      id,
      author: '',
      name: '',
      img: undefined,
      desc: undefined,
      source: songlistInfo.current.source,
    })
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <LiquidGlass solid mode={glassStyle} blurRadius={24} radius={0} tint={theme.isDark ? 'rgba(20,16,28,0.42)' : 'rgba(255,255,255,0.34)'} isDark={theme.isDark} seamless flat />
        {/* 排序 + 分类（同一排横向滚动，细竖线分隔两组；来源图标已移到页头标题右侧） */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.hScroll}
          contentContainerStyle={styles.filterRow}
        >
          {
            sorts.map(s => (
              <Chip
                key={s.id}
                label={t(`songlist_${s.tid}`)}
                active={s.id === sortId}
                onPress={() => { if (s.id !== sortId) handleSortChange(s.id) }}
              />
            ))
          }
          <View style={{ ...styles.divider, backgroundColor: theme['c-primary-alpha-700'] }} />
          <Chip
            soft
            label={t('songlist_tag_all')}
            active={!tagId}
            onPress={() => { if (tagId) handleTagChange('', '') }}
          />
          {
            hotTags.map(tag => (
              <Chip
                key={tag.id}
                soft
                label={tag.name}
                active={tag.id === tagId}
                onPress={() => { if (tag.id !== tagId) handleTagChange(tag.name, tag.id) }}
              />
            ))
          }
          <Chip
            soft
            icon='filter-variant'
            label={tagId ? tagName : t('songlist_tag_more')}
            onPress={handleShowAllTags}
          />
        </ScrollView>
      </View>

      <View style={styles.list}>
        <List ref={listRef} />
      </View>

      <OpenListModal ref={openListModalRef} onOpenId={handleOpenSonglist} />
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  filters: {
    paddingBottom: 6,
  },
  hScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
  },
  divider: {
    width: 1,
    height: 16,
    borderRadius: 1,
    marginLeft: 2,
    marginRight: 10,
  },
  list: {
    flex: 1,
    marginTop: 2,
  },
})
