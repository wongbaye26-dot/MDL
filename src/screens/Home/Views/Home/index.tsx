import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, ScrollView, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import PicImage from '@/components/common/PicImage'
import PageHeader, { HeaderButton } from '@/components/common/PageHeader'
import { useTheme } from '@/store/theme/hook'
import { useDownloadList } from '@/store/download'
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
import { getRecentPlayList } from '@/core/player/recentPlay'
import SearchModal from '../../Vertical/SearchModal'
import PageModal from '../../Vertical/PageModal'
import SongList from '../SongList'
import Leaderboard from '../Leaderboard'
import CompactHero from '../Leaderboard/Vertical/CompactHero'
import Favorites, { FavoriteTabs, type FavoriteTab } from '../Mylist/Favorites'
import LocalMusic, { type LocalTab } from '../LocalMusic'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { useHorizontalMode } from '@/utils/hooks'
import UserApiEditModal, { type UserApiEditModalType } from '../Setting/settings/Basic/UserApiEditModal'
import BigCard, { getBigCardMetrics } from './BigCard'
import SongRail, { RAIL_ROWS } from './SongRail'

type ModalType = 'songlist' | 'leaderboard' | 'mylist' | null

/** 首页横向歌曲流取多少首：4 行 × 5 列 = 20 首（最近播放固定保留最近 20 首） */
const RAIL_LIMIT = RAIL_ROWS * 5
/** 「最近播放」临时队列的标识（和本地音乐页共用同一套 TEMP 列表机制） */
const RECENT_LIST_ID = 'home_recent'
const LOCAL_RECENT_LIST_ID = 'home_local_recent'

/**
 * 首页四张大卡：每张卡自带一套渐变配色和持续动效（见 BigCard）
 * variant 决定卡上的装饰动效，顺序就是横向轮播的顺序
 */
const CARDS = [
  { key: 'leaderboard', title: '排行榜', icon: 'leaderboard', variant: 'bars' },
  { key: 'songlist', title: '歌单广场', icon: 'album', variant: 'vinyl' },
  { key: 'mylist', title: '收藏', icon: 'love', variant: 'hearts' },
  { key: 'source', title: '音源管理', icon: 'share', variant: 'ripple' },
] as const

type CardKey = typeof CARDS[number]['key']

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
  /** 收藏页当前页签：提升到首页，PageHeader 标题行里的页签和列表共用同一份状态 */
  const [favoriteTab, setFavoriteTab] = useState<FavoriteTab>('love')
  const [localVisible, setLocalVisible] = useState(false)
  const [localTab, setLocalTab] = useState<LocalTab>('song')
  const [recommend, setRecommend] = useState<ListInfoItem[]>([])
  /** 最近播放（已去重、最新的在前） */
  const [playedMusic, setPlayedMusic] = useState<LX.Music.MusicInfo[]>([])
  /** 本地曲库 */
  const [localList, setLocalList] = useState<LX.Music.MusicInfoLocal[]>([])
  const userApiModalRef = useRef<UserApiEditModalType>(null)

  /**
   * 首页四张大卡：居中吸附轮播。
   *  - 卡片尺寸/间距从 BigCard 的同一套缩放函数拿，snapToInterval 才能严丝合缝；
   *  - 左右留白 =（视口宽 − 卡宽）/2，第一张和最后一张都能停在正中；
   *  - scrollX 走 native driver，每张卡的 scale/倾斜/透明度都由它插值出来。
   */
  const compact = useHorizontalMode()
  const cardMetrics = getBigCardMetrics(compact)
  const cardInterval = cardMetrics.width + cardMetrics.gap
  const cardsScrollX = useRef(new Animated.Value(0)).current
  const [cardsViewport, setCardsViewport] = useState(0)
  const cardsSidePad = Math.max(0, (cardsViewport - cardMetrics.width) / 2)
  const handleCardsScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { x: cardsScrollX } } }],
    { useNativeDriver: true },
  ), [cardsScrollX])
  /** 每张卡的滚动进度：0 = 正中，±1 = 相邻卡（按吸附步长缓存，避免每次 render 重建动画节点） */
  const cardProgress = useMemo(() => CARDS.map((_, i) => cardsScrollX.interpolate({
    inputRange: [(i - 1) * cardInterval, i * cardInterval, (i + 1) * cardInterval],
    outputRange: [-1, 0, 1],
    extrapolate: 'clamp',
  })), [cardsScrollX, cardInterval])

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

  /** 最近播放里本地 / 在线的构成，放在标题右侧一眼看清 */
  const recentHint = useMemo(() => {
    if (!playedMusic.length) return undefined
    const local = playedMusic.filter(m => m.source === 'local').length
    const online = playedMusic.length - local
    return local && online ? `本地 ${local} · 在线 ${online}` : local ? `本地 ${local}` : `在线 ${online}`
  }, [playedMusic])

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

  // 最近播放：独立持久化历史，和随机模式 / 播放列表切换无关
  useEffect(() => {
    let alive = true
    void getRecentPlayList().then(list => {
      if (alive) setPlayedMusic(list.slice(0, RAIL_LIMIT))
    })
    const handleUpdate = (list: LX.Music.MusicInfo[]) => {
      if (alive) setPlayedMusic(list.slice(0, RAIL_LIMIT))
    }
    global.state_event.on('recentPlayUpdated', handleUpdate)
    return () => {
      alive = false
      global.state_event.off('recentPlayUpdated', handleUpdate)
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

  const openLocal = useCallback((tab: LocalTab) => {
    setLocalTab(tab)
    setLocalVisible(true)
  }, [])

  const handleCard = useCallback((key: CardKey) => {
    switch (key) {
      case 'source':
        userApiModalRef.current?.show()
        break
      case 'songlist':
        navigations.pushSongListScreen(commonState.componentIds.home!)
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: NAV_BAR_SPACE }}>
        <PageHeader
          title='EMO音乐'
          right={<HeaderButton icon='search-2' onPress={() => { setSearchVisible(true) }} />}
        />

        {/*
          四张大卡：居中吸附轮播。
          左右留白让每张卡都能停在正中；滚动时按 progress（0 = 正中，±1 = 相邻卡）做
          scale 0.9→1、translateY、轻微 rotate/rotateY、相邻透明度变化，松手吸附回弹。
        */}
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.hScroll}
          contentContainerStyle={[styles.cards, { paddingLeft: cardsSidePad, paddingRight: cardsSidePad }]}
          snapToInterval={cardInterval}
          decelerationRate='fast'
          scrollEventThrottle={16}
          onScroll={handleCardsScroll}
          onLayout={e => {
            const { width } = e.nativeEvent.layout
            setCardsViewport(prev => (Math.abs(prev - width) > 0.5 ? width : prev))
          }}
        >
          {
            CARDS.map((card, i) => (
              <BigCard
                key={card.key}
                index={i}
                title={card.title}
                icon={card.icon}
                variant={card.variant}
                progress={cardProgress[i]}
                onPress={() => { handleCard(card.key) }}
              />
            ))
          }
        </Animated.ScrollView>

        {
          // 常显：没有历史时给一个空态，而不是整块消失（位置会跳来跳去）
          playedMusic.length
            ? (
                <>
                  <SectionHead title='最近播放' hint={recentHint} />
                  <SongRail
                    items={playedMusic}
                    showSource
                    onPress={index => { void playFrom(playedMusic, index, RECENT_LIST_ID) }}
                  />
                </>
              )
            : (
                <>
                  <SectionHead title='最近播放' />
                  <View style={styles.railEmpty}>
                    <View style={{ ...styles.railEmptyIcon, backgroundColor: theme['c-primary-alpha-900'] }}>
                      <Icon name='play-circle-outline' size={20} color={theme['c-400']} />
                    </View>
                    <Text size={12} color={theme['c-450']}>还没有播放记录，听一首歌就会出现在这里</Text>
                  </View>
                </>
              )
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
              ? (
                <PageModal
                  title='收藏'
                  onClose={() => { setModal(null) }}
                  titleRight={<FavoriteTabs tab={favoriteTab} onChange={setFavoriteTab} />}
                >
                  <Favorites tab={favoriteTab} onTabChange={setFavoriteTab} />
                </PageModal>
                )
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
    // 左右留白在渲染时按视口宽度算（让卡片能停在正中），这里只留出上下缩放/倾斜的余量
    paddingTop: 2,
    paddingBottom: 12,
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
    // 自己占满标题右侧的剩余宽度再右对齐：RN 里 Text 直接靠 marginLeft: 'auto' 定位会被
    // 压成「本地 3 · 在…」，必须先用 flex: 1 把宽度撑开（同关于页 infoValue 的坑）
    flex: 1,
    marginLeft: 8,
    textAlign: 'right',
  },
  railEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    marginRight: 16,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'transparent',
  },
  railEmptyIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
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
