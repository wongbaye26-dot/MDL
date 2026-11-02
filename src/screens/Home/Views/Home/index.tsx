import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import PicImage from '@/components/common/PicImage'
import PageHeader, { HeaderButton } from '@/components/common/PageHeader'
import { useTheme } from '@/store/theme/hook'
import { useDownloadList } from '@/store/download'
import playerState from '@/store/player/state'
import commonState from '@/store/common/state'
import { navigations } from '@/navigation'
import { setNavActiveId } from '@/core/common'
import { getList } from '@/core/songlist'
import type { ListInfoItem } from '@/store/songlist/state'
import { createStyle } from '@/utils/tools'
import { LIST_IDS, NAV_BAR_SPACE } from '@/config/constant'
import { formatSize } from '@/core/download/utils'
import { getLocalMusicList } from '@/core/localMusic'
import { overwriteListMusics } from '@/core/list'
import listAction from '@/store/list/action'
import { playList } from '@/core/player/player'
import SearchModal from '../../Vertical/SearchModal'
import PageModal from '../../Vertical/PageModal'
import SongList from '../SongList'
import Leaderboard from '../Leaderboard'
import CompactHero from '../Leaderboard/Vertical/CompactHero'
import Favorites from '../Mylist/Favorites'
import LocalMusic, { type LocalTab } from '../LocalMusic'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import UserApiEditModal, { type UserApiEditModalType } from '../Setting/settings/Basic/UserApiEditModal'
import BigCard from './BigCard'
import SongRail, { RAIL_ROWS } from './SongRail'

type ModalType = 'songlist' | 'leaderboard' | 'mylist' | null

/** 首页横向歌曲流取多少首：4 行 × 5 列 = 20 首（最近播放固定保留最近 20 首） */
const RAIL_LIMIT = RAIL_ROWS * 5
/** 「最近播放」临时队列的标识（和本地音乐页共用同一套 TEMP 列表机制） */
const RECENT_LIST_ID = 'home_recent'
const LOCAL_RECENT_LIST_ID = 'home_local_recent'

const CARDS = [
  { key: 'leaderboard', title: '排行榜', icon: 'leaderboard', color: '#8B5CF6' },
  { key: 'songlist', title: '歌单广场', icon: 'album', color: '#14B8A6' },
  { key: 'mylist', title: '收藏', icon: 'love', color: '#EC4899' },
  { key: 'local', title: '本地音乐', icon: 'folder-music', color: '#0EA5E9' },
  { key: 'source', title: '音源管理', icon: 'share', color: '#3B82F6' },
] as const

type CardKey = typeof CARDS[number]['key']

/** 播放历史里可能混入下载任务，统一取出歌曲信息 */
const toMusicInfo = (music: LX.Player.PlayMusic): LX.Music.MusicInfo => {
  return 'metadata' in music ? music.metadata.musicInfo : music
}

const SectionHead = ({ title, hint, onPress }: {
  title: string
  /** 标题右侧的灰色小字，比如「共 182 首」 */
  hint?: string
  /** 不传就不显示箭头，也不可点 —— 避免出现「有箭头但点了没反应」 */
  onPress?: () => void
}) => {
  const theme = useTheme()
  return (
    <TouchableOpacity
      style={styles.sectionHead}
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text size={16} style={styles.sectionTitle}>{title}</Text>
      {onPress ? <Icon name='chevron-right' size={16} color={theme['c-400']} style={styles.sectionArrow} /> : null}
      {hint ? <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.sectionHint}>{hint}</Text> : null}
    </TouchableOpacity>
  )
}

export default () => {
  const theme = useTheme()
  const downloadList = useDownloadList()
  const [searchVisible, setSearchVisible] = useState(false)
  const [modal, setModal] = useState<ModalType>(null)
  const [localVisible, setLocalVisible] = useState(false)
  const [localTab, setLocalTab] = useState<LocalTab>('song')
  const [recommend, setRecommend] = useState<ListInfoItem[]>([])
  /** 最近播放（已去重、最新的在前） */
  const [playedMusic, setPlayedMusic] = useState<LX.Music.MusicInfo[]>([])
  /** 本地曲库 */
  const [localList, setLocalList] = useState<LX.Music.MusicInfoLocal[]>([])
  const userApiModalRef = useRef<UserApiEditModalType>(null)

  const recentDownload = useMemo(() => [...downloadList]
    .sort((a, b) => {
      if (a.isComplate !== b.isComplate) return a.isComplate ? 1 : -1
      return (b.createdAt ?? 0) - (a.createdAt ?? 0)
    })
    .slice(0, 3), [downloadList])

  /** 最近添加歌曲：按文件修改时间倒序（和本地音乐页「最近添加」同一口径） */
  const recentAdded = useMemo(() => [...localList]
    .sort((a, b) => (b.meta.mtime ?? 0) - (a.meta.mtime ?? 0))
    .slice(0, RAIL_LIMIT), [localList])

  useEffect(() => {
    void getList('kw', '全部', 'hot', 1)
      .then(res => { setRecommend((res.list ?? []).slice(0, 8)) })
      .catch(() => {})
  }, [])

  // 本地曲库：先读缓存，扫描完成后再靠事件刷新
  useEffect(() => {
    let alive = true
    void getLocalMusicList().then(list => {
      if (alive) setLocalList(list)
    })
    const handleUpdated = (list: LX.Music.MusicInfoLocal[]) => {
      if (alive) setLocalList(list)
    }
    global.state_event.on('localMusicUpdated', handleUpdated)
    return () => {
      alive = false
      global.state_event.off('localMusicUpdated', handleUpdated)
    }
  }, [])

  useEffect(() => {
    /**
     * 只认 playPlayedListChanged：播放历史是在 addPlayedList 里 push 的，
     * 而 playMusicInfoChanged 触发时历史可能还没写进去（首页会一直显示上一首）。
     * 回调参数是 `{ ...array }` 展开出来的对象（没有 length），所以直接读 store 里的真数组。
     */
    const handleUpdate = () => {
      const seen = new Set<string>()
      const out: LX.Music.MusicInfo[] = []
      const src = playerState.playedList
      for (let i = src.length - 1; i >= 0 && out.length < RAIL_LIMIT; i--) {
        const info = toMusicInfo(src[i].musicInfo)
        if (seen.has(info.id)) continue
        seen.add(info.id)
        out.push(info)
      }
      setPlayedMusic(out)
    }
    handleUpdate()
    global.state_event.on('playPlayedListChanged', handleUpdate)
    return () => {
      global.state_event.off('playPlayedListChanged', handleUpdate)
    }
  }, [])

  /** 用临时播放队列播第 index 首：首页点哪首就播哪首，不动用户的「我的列表」 */
  const playFrom = useCallback(async(list: LX.Music.MusicInfo[], index: number, listId: string) => {
    const target = list[index]
    if (!target) return
    await overwriteListMusics(LIST_IDS.TEMP, list)
    listAction.setTempListMeta({ id: listId })
    void playList(LIST_IDS.TEMP, index)
  }, [])

  const openLocal = useCallback((tab: LocalTab = 'song') => {
    setLocalTab(tab)
    setLocalVisible(true)
  }, [])

  const handleCard = useCallback((key: CardKey) => {
    switch (key) {
      case 'local':
        openLocal('song')
        break
      case 'source':
        userApiModalRef.current?.show()
        break
      case 'songlist':
        navigations.pushSongListScreen(commonState.componentIds.home!)
        break
      default:
        setModal(key)
    }
  }, [openLocal])

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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: NAV_BAR_SPACE }}>
        <PageHeader
          title='EMO音乐'
          right={<HeaderButton icon='search-2' onPress={() => { setSearchVisible(true) }} />}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.hScroll}
          contentContainerStyle={styles.cards}
        >
          {
            CARDS.map((card, i) => (
              <BigCard
                key={card.key}
                index={i}
                title={card.title}
                icon={card.icon}
                color={card.color}
                onPress={() => { handleCard(card.key) }}
              />
            ))
          }
        </ScrollView>

        {
          playedMusic.length
            ? (
                <>
                  <SectionHead title='最近播放' />
                  <SongRail
                    items={playedMusic}
                    showSource
                    onPress={index => { void playFrom(playedMusic, index, RECENT_LIST_ID) }}
                  />
                </>
              )
            : null
        }

        {
          recentAdded.length
            ? (
                <>
                  <SectionHead
                    title='最近添加'
                    hint={`共 ${localList.length} 首`}
                    onPress={() => { openLocal('recent') }}
                  />
                  <SongRail
                    items={recentAdded}
                    onPress={index => { void playFrom(recentAdded, index, LOCAL_RECENT_LIST_ID) }}
                  />
                </>
              )
            : null
        }

        {
          recommend.length
            ? (
                <>
                  <SectionHead title='推荐歌单' onPress={() => { navigations.pushSongListScreen(commonState.componentIds.home!) }} />
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
                          onPress={() => { navigations.pushSongListScreen(commonState.componentIds.home!) }}
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
          recentDownload.length
            ? (
                <>
                  <SectionHead title='最近下载' onPress={() => { setNavActiveId('nav_download') }} />
                  {
                    recentDownload.map(task => (
                      <TouchableOpacity
                        key={task.id}
                        style={styles.row}
                        activeOpacity={0.7}
                        onPress={() => { setNavActiveId('nav_download') }}
                      >
                        <View style={styles.rowMain}>
                          <View style={styles.downloadCoverWrap}>
                            <PicImage musicInfo={task} style={styles.rowCover} />
                            <View style={{
                              ...styles.downloadBadge,
                              backgroundColor: task.isComplate ? 'rgba(52, 211, 153, 0.92)' : 'rgba(168, 85, 247, 0.92)',
                            }}>
                              <Icon
                                name={task.isComplate ? 'check' : 'download-2'}
                                size={9}
                                color='#FFFFFF'
                              />
                            </View>
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
          ? (
            <PageModal
              title='歌单广场'
              onClose={() => { setModal(null) }}
              right={(
                <TouchableOpacity
                  style={styles.headerAction}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => { global.app_event.openSonglistLink() }}
                >
                  <Icon name='link-variant' size={19} color={theme['c-450']} />
                </TouchableOpacity>
              )}
            >
              <SongList />
            </PageModal>
            )
          : modal === 'leaderboard'
            ? (
                <PageModal title='排行榜' onClose={() => { setModal(null) }} right={<CompactHero />}>
                  <Leaderboard />
                </PageModal>
              )
            : modal === 'mylist'
              ? <PageModal title='收藏' onClose={() => { setModal(null) }}><Favorites /></PageModal>
              : null
      }
      {
        localVisible
          ? (
            <PageModal title='本地音乐' onClose={() => { setLocalVisible(false) }}>
              <LocalMusic initialTab={localTab} onClose={() => { setLocalVisible(false) }} />
            </PageModal>
            )
          : null
      }
      <UserApiEditModal ref={userApiModalRef} />
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  headerAction: {
    width: 44,
    height: 44,
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
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  sectionArrow: {
    marginLeft: 2,
    marginTop: 1,
  },
  sectionHint: {
    marginLeft: 'auto',
    paddingLeft: 8,
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
  downloadCoverWrap: {
    width: 46,
    height: 46,
    borderRadius: 9,
    marginRight: 12,
  },
  downloadBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
