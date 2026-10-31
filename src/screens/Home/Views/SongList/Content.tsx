import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Chip from '@/components/common/Chip'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { getSongListSetting, saveSongListSetting } from '@/utils/data'
import { getTags } from '@/core/songlist'
import songlistState, { type Source, type TagInfoItem } from '@/store/songlist/state'
import { useSourceListI18n } from '@/components/SourceSelector'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import List, { type ListType } from './List'
import OpenListModal, { type ModalType as OpenListModalType } from './HeaderBar/OpenList/Modal'

interface SonglistInfo {
  source: Source
  sortId: string
  tagId: string
}

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const listRef = useRef<ListType>(null)
  const openListModalRef = useRef<OpenListModalType>(null)
  const songlistInfo = useRef<SonglistInfo>({ source: 'kw', sortId: '', tagId: '' })
  const [source, setSource] = useState<Source>(songlistState.sources[0] ?? 'kw')
  const [sortId, setSortId] = useState('')
  const [tagId, setTagId] = useState('')
  const [tagName, setTagName] = useState('')
  const [hotTags, setHotTags] = useState<TagInfoItem[]>([])
  const sourceList = useSourceListI18n(songlistState.sources)
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
      <View style={styles.sourceRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rowContent}
        >
          {
            sourceList.map(({ label, action }) => (
              <Chip
                key={action}
                size='sm'
                label={label}
                active={action === source}
                onPress={() => { if (action !== source) handleSourceChange(action as Source) }}
              />
            ))
          }
        </ScrollView>
        <TouchableOpacity
          style={styles.openBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => { openListModalRef.current?.show(songlistInfo.current.source) }}
        >
          <Icon name='link-variant' size={15} color={theme['c-450']} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
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
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
      >
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
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowContent: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
  },
  openBtn: {
    width: 34,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 8,
  },
  list: {
    flex: 1,
    marginTop: 8,
  },
})
