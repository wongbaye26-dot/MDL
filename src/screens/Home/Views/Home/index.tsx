import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import DorpDownMenu from '@/components/common/DorpDownMenu'
import { useTheme } from '@/store/theme/hook'
import { useDownloadList } from '@/store/download'
import { useStatusbarHeight } from '@/store/common/hook'
import { useI18n } from '@/lang'
import playerState from '@/store/player/state'
import { setNavActiveId } from '@/core/common'
import { getList } from '@/core/songlist'
import type { ListInfoItem } from '@/store/songlist/state'
import { createStyle } from '@/utils/tools'
import { formatSize } from '@/core/download/utils'
import { handlePlay, handlePlayLater } from '@/components/OnlineList/listAction'
import DownloadQualityModal, { type DownloadQualityModalType } from '@/components/DownloadQualityModal'
import SearchModal from '../../Vertical/SearchModal'
import PageModal from '../../Vertical/PageModal'
import SongList from '../SongList'
import Leaderboard from '../Leaderboard'
import Mylist from '../Mylist'
import LocalMusic from '../LocalMusic'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import UserApiEditModal, { type UserApiEditModalType } from '../Setting/settings/Basic/UserApiEditModal'
import BigCard from './BigCard'

type ModalType = 'songlist' | 'leaderboard' | 'mylist' | null

const CARDS = [
  { key: 'leaderboard', title: '排行榜', icon: 'leaderboard', color: '#8B5CF6' },
  { key: 'songlist', title: '歌单广场', icon: 'album', color: '#14B8A6' },
  { key: 'mylist', title: '收藏', icon: 'love', color: '#EC4899' },
  { key: 'download', title: '已下载', icon: 'download-2', color: '#F59E0B' },
  { key: 'source', title: '音源管理', icon: 'share', color: '#3B82F6' },
] as const

type CardKey = typeof CARDS[number]['key']

/** 播放历史里可能混入下载任务，统一取出歌曲信息 */
const toMusicInfo = (music: LX.Player.PlayMusic): LX.Music.MusicInfo => {
  return 'metadata' in music ? music.metadata.musicInfo : music
}

const SectionHead = ({ title, onPress }: { title: string, onPress?: () => void }) => {
  const theme = useTheme()
  return (
    <TouchableOpacity style={styles.sectionHead} activeOpacity={0.7} onPress={onPress}>
      <Text size={16} style={styles.sectionTitle}>{title}</Text>
      <Icon name='chevron-right' size={16} color={theme['c-400']} style={styles.sectionArrow} />
    </TouchableOpacity>
  )
}

const RecentRow = ({ musicInfo, onPlay, onMenu }: {
  musicInfo: LX.Music.MusicInfo
  onPlay: () => void
  onMenu: (action: string) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const menus = useMemo(() => [
    { action: 'play', label: t('play') },
    { action: 'playLater', label: t('play_later') },
    { action: 'download', label: t('download') },
  ], [t])

  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.rowMain} activeOpacity={0.7} onPress={onPlay}>
        <Image url={musicInfo.meta?.picUrl} style={styles.rowCover} />
        <View style={styles.rowInfo}>
          <Text size={14} numberOfLines={1}>{musicInfo.name}</Text>
          <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.rowSub}>{musicInfo.singer}</Text>
        </View>
      </TouchableOpacity>
      <DorpDownMenu menus={menus} onPress={menu => { onMenu(menu.action) }} btnStyle={styles.moreBtn}>
        <Icon name='dots-vertical' size={14} color={theme['c-350']} />
      </DorpDownMenu>
    </View>
  )
}

export default () => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const downloadList = useDownloadList()
  const [searchVisible, setSearchVisible] = useState(false)
  const [modal, setModal] = useState<ModalType>(null)
  const [localVisible, setLocalVisible] = useState(false)
  const [recommend, setRecommend] = useState<ListInfoItem[]>([])
  const [playedList, setPlayedList] = useState<LX.Player.PlayMusicInfo[]>([])
  const downloadModalRef = useRef<DownloadQualityModalType>(null)
  const userApiModalRef = useRef<UserApiEditModalType>(null)

  const recent = useMemo(() => [...downloadList]
    .sort((a, b) => {
      if (a.isComplate !== b.isComplate) return a.isComplate ? 1 : -1
      return (b.createdAt ?? 0) - (a.createdAt ?? 0)
    })
    .slice(0, 3), [downloadList])

  useEffect(() => {
    void getList('kw', '全部', 'hot', 1)
      .then(res => { setRecommend((res.list ?? []).slice(0, 8)) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handleUpdate = () => {
      setPlayedList([...playerState.playedList].slice(-6).reverse())
    }
    handleUpdate()
    global.state_event.on('playMusicInfoChanged', handleUpdate)
    return () => {
      global.state_event.off('playMusicInfoChanged', handleUpdate)
    }
  }, [])

  const handleCard = useCallback((key: CardKey) => {
    switch (key) {
      case 'download':
        setLocalVisible(true)
        break
      case 'source':
        userApiModalRef.current?.show()
        break
      default:
        setModal(key)
    }
  }, [])

  useBackHandler(useCallback(() => {
    if (localVisible) {
      setLocalVisible(false)
      return true
    }
    if (searchVisible) {
      setSearchVisible(false)
      return true
    }
    if (modal) {
      setModal(null)
      return true
    }
    return false
  }, [localVisible, searchVisible, modal]))

  const handleMenu = useCallback((musicInfo: LX.Music.MusicInfo, action: string) => {
    const info = musicInfo as LX.Music.MusicInfoOnline
    switch (action) {
      case 'play':
        handlePlay(info)
        break
      case 'playLater':
        handlePlayLater(info, [], () => {})
        break
      case 'download':
        downloadModalRef.current?.show({ musicInfos: [info] })
        break
    }
  }, [])

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingTop: statusBarHeight + 12, paddingBottom: 24 }}>
        <View style={styles.header}>
          <Text size={21} style={styles.brand}>EMO音乐</Text>
          <TouchableOpacity
            style={{ ...styles.searchBtn, backgroundColor: theme['c-primary-alpha-900'] }}
            activeOpacity={0.8}
            onPress={() => { setSearchVisible(true) }}
          >
            <Icon name='search-2' size={17} color={theme['c-font']} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.hScroll}
          contentContainerStyle={styles.cards}
        >
          {
            CARDS.map(card => (
              <BigCard
                key={card.key}
                title={card.title}
                icon={card.icon}
                color={card.color}
                onPress={() => { handleCard(card.key) }}
              />
            ))
          }
        </ScrollView>

        {
          playedList.length
            ? (
                <>
                  <SectionHead title='最近播放' onPress={() => { setNavActiveId('nav_player') }} />
                  {
                    playedList.map(item => {
                      const musicInfo = toMusicInfo(item.musicInfo)
                      return (
                        <RecentRow
                          key={`${item.listId}_${musicInfo.id}`}
                          musicInfo={musicInfo}
                          onPlay={() => { handlePlay(musicInfo as LX.Music.MusicInfoOnline) }}
                          onMenu={action => { handleMenu(musicInfo, action) }}
                        />
                      )
                    })
                  }
                </>
              )
            : null
        }

        {
          recommend.length
            ? (
                <>
                  <SectionHead title='推荐歌单' onPress={() => { setModal('songlist') }} />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.hScroll}
                    contentContainerStyle={styles.recommendRow}
                  >
                    {
                      recommend.map(item => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.recCard}
                          activeOpacity={0.8}
                          onPress={() => { setModal('songlist') }}
                        >
                          <Image url={item.img} style={styles.recCover} />
                          <Text size={11} numberOfLines={1} style={styles.recName}>{item.name}</Text>
                          <Text size={9} color={theme['c-450']} numberOfLines={1} style={styles.recMeta}>
                            {item.play_count ? `${item.play_count} 次播放` : item.author}
                          </Text>
                        </TouchableOpacity>
                      ))
                    }
                  </ScrollView>
                </>
              )
            : null
        }

        {
          recent.length
            ? (
                <>
                  <SectionHead title='最近下载' onPress={() => { setNavActiveId('nav_download') }} />
                  {
                    recent.map(task => (
                      <TouchableOpacity
                        key={task.id}
                        style={styles.row}
                        activeOpacity={0.7}
                        onPress={() => { setNavActiveId('nav_download') }}
                      >
                        <View style={styles.rowMain}>
                          <View style={{
                            ...styles.downloadIcon,
                            backgroundColor: task.isComplate ? 'rgba(52, 211, 153, 0.14)' : theme['c-primary-alpha-800'],
                          }}>
                            <Icon
                              name={task.isComplate ? 'checkbox-marked' : 'download-2'}
                              size={15}
                              color={task.isComplate ? '#34D399' : theme['c-primary-light-200']}
                            />
                          </View>
                          <View style={styles.rowInfo}>
                            <Text size={13} numberOfLines={1}>{task.metadata.musicInfo.name}</Text>
                            <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.rowSub}>
                              {task.isComplate
                                ? `${task.metadata.musicInfo.singer} · ${task.metadata.ext.toUpperCase()} · ${formatSize(task.total)}`
                                : `${task.metadata.musicInfo.singer} · ${task.status === 'run' ? `下载中 ${task.progress.toFixed(0)}%` : task.status === 'error' ? '下载失败' : '等待下载'}`}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))
                  }
                </>
              )
            : null
        }
      </ScrollView>

      {searchVisible ? <SearchModal onClose={() => { setSearchVisible(false) }} /> : null}
      {
        modal === 'songlist'
          ? <PageModal title='歌单广场' onClose={() => { setModal(null) }}><SongList /></PageModal>
          : modal === 'leaderboard'
            ? <PageModal title='排行榜' onClose={() => { setModal(null) }}><Leaderboard /></PageModal>
            : modal === 'mylist'
              ? <PageModal title='我的列表' onClose={() => { setModal(null) }}><Mylist /></PageModal>
              : null
      }
      {
        localVisible
          ? <PageModal title='本地音乐' onClose={() => { setLocalVisible(false) }}><LocalMusic /></PageModal>
          : null
      }
      <DownloadQualityModal ref={downloadModalRef} />
      <UserApiEditModal ref={userApiModalRef} />
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 14,
  },
  brand: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  searchBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cards: {
    paddingLeft: 16,
    paddingRight: 4,
  },
  hScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    marginTop: 24,
    marginBottom: 6,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  sectionArrow: {
    marginLeft: 2,
    marginTop: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  rowMain: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingTop: 7,
    paddingBottom: 7,
  },
  rowCover: {
    width: 46,
    height: 46,
    borderRadius: 9,
    marginRight: 12,
  },
  rowInfo: {
    flexGrow: 1,
    flexShrink: 1,
  },
  rowSub: {
    marginTop: 3,
  },
  moreBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadIcon: {
    width: 46,
    height: 46,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recommendRow: {
    paddingLeft: 16,
    paddingRight: 4,
    paddingTop: 2,
  },
  recCard: {
    width: 132,
    marginRight: 12,
  },
  recCover: {
    width: 132,
    height: 132,
    borderRadius: 16,
    marginBottom: 7,
  },
  recName: {
    lineHeight: 15,
  },
  recMeta: {
    marginTop: 3,
  },
})
