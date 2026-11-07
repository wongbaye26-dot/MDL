import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import PicImage from '@/components/common/PicImage'
import PageHeader, { HeaderButton } from '@/components/common/PageHeader'
import LiquidGlass from '@/components/common/LiquidGlass'
import { useStatusbarHeight } from '@/store/common/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { useDownloadList } from '@/store/download'
import commonState from '@/store/common/state'
import { navigations } from '@/navigation'
import { setNavActiveId } from '@/core/common'
import { getList } from '@/core/songlist'
import type { ListInfoItem } from '@/store/songlist/state'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
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
import SongListHeaderSourceBar from '../SongList/HeaderSourceBar'
import Favorites, { FavoriteTabs, type FavoriteTab } from '../Mylist/Favorites'
import ListNameEdit, { type ListNameEditType } from '../Mylist/MyList/ListNameEdit'
import listState from '@/store/list/state'
import LocalMusic, { type LocalTab } from '../LocalMusic'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { useWindowSize } from '@/utils/hooks'
import UserApiEditModal, { type UserApiEditModalType } from '../Setting/settings/Basic/UserApiEditModal'
import BigCard from './BigCard'
import ListeningStatsModal from './ListeningStatsModal'
import SongRail, { RAIL_ROWS } from './SongRail'
import { CoverImage } from '../LocalMusic/cover'

type ModalType = 'songlist' | 'leaderboard' | 'mylist' | null

/** 首页横向歌曲流取多少首：4 行 × 5 列 = 20 首（最近播放固定保留最近 20 首） */
const RAIL_LIMIT = RAIL_ROWS * 5
/** 「最近播放」临时队列的标识（和本地音乐页共用同一套 TEMP 列表机制） */
const RECENT_LIST_ID = 'home_recent'
const LOCAL_RECENT_LIST_ID = 'home_local_recent'

/**
 * 首页大卡（5 张）：每张卡自带一套渐变配色和持续动效（见 BigCard）
 * variant 决定卡上的装饰动效，顺序就是横向轮播的顺序
 */
const CARDS = [
  { key: 'leaderboard', title: '排行榜', icon: 'leaderboard', variant: 'bars' },
  { key: 'songlist', title: '歌单广场', icon: 'album', variant: 'vinyl' },
  { key: 'mylist', title: '收藏', icon: 'love', variant: 'hearts' },
  // 越靠前越常看：统计卡放在「音源管理」前面，但排在三个高频入口之后
  { key: 'stats', title: '听歌统计', icon: 'chart-donut', variant: 'stats' },
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
  const statusBarHeight = useStatusbarHeight()
  const glassStyle = useSettingValue('common.navGlassStyle') ?? 'liquid'
  const downloadList = useDownloadList()
  const [searchVisible, setSearchVisible] = useState(false)
  const [modal, setModal] = useState<ModalType>(null)
  /** 收藏页当前页签：提升到首页，PageHeader 标题行里的页签和列表共用同一份状态 */
  const [favoriteTab, setFavoriteTab] = useState<FavoriteTab>('love')
  const [localVisible, setLocalVisible] = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)
  const [localTab, setLocalTab] = useState<LocalTab>('song')
  const [localAlbum, setLocalAlbum] = useState<string | null>(null)
  const [recommend, setRecommend] = useState<ListInfoItem[]>([])
  /** 最近播放（已去重、最新的在前） */
  const [playedMusic, setPlayedMusic] = useState<LX.Music.MusicInfo[]>([])
  /** 本地曲库 */
  const [localList, setLocalList] = useState<LX.Music.MusicInfoLocal[]>([])
  const userApiModalRef = useRef<UserApiEditModalType>(null)
  const listNameEditRef = useRef<ListNameEditType>(null)

  /**
   * 首页 5 张大卡：对齐飞牛音乐的大卡横向轮播。
   * 卡片宽约 42% 视口、高约 0.87 宽、圆角 24；左起 16dp，右侧留 16dp。
   */
  const GRID_PADDING = scaleSizeW(16)
  const GRID_GAP = scaleSizeW(12)
  const [cardsViewport, setCardsViewport] = useState(0)
  const { width: windowWidth, height: windowHeight } = useWindowSize()
  // 横屏时视口很宽，但仍按屏幕短边定卡片尺寸，保证和竖版卡片差不多大
  const cardBase = Math.round(Math.min(windowWidth, windowHeight) * 0.42)
  const cardWidth = cardsViewport > 0 ? Math.min(Math.round(cardsViewport * 0.42), cardBase) : 0
  const cardHeight = Math.round(cardWidth * 0.87)

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

  /** 最近添加专辑：按专辑名聚合，取每组最新文件时间 */
  const recentAlbums = useMemo(() => {
    const map = new Map<string, { key: string, name: string, singer: string, coverItem: LX.Music.MusicInfoLocal, latest: number, count: number }>()
    for (const item of localList) {
      const name = (item.meta.albumName ?? '').trim() || '未知专辑'
      const key = name.toLowerCase()
      const mtime = item.meta.mtime ?? 0
      const prev = map.get(key)
      if (!prev) {
        map.set(key, { key, name, singer: item.singer ?? '', coverItem: item, latest: mtime, count: 1 })
      } else {
        prev.count += 1
        if (mtime > prev.latest) {
          prev.latest = mtime
          prev.coverItem = item
          prev.singer = item.singer ?? ''
        }
      }
    }
    return [...map.values()].sort((a, b) => b.latest - a.latest).slice(0, 10)
  }, [localList])

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

  const openLocal = useCallback((tab: LocalTab, album?: string) => {
    setLocalTab(tab)
    setLocalAlbum(album ?? null)
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
      case 'stats':
        setStatsVisible(true)
        break
      default:
        setModal(key)
    }
  }, [])

  useEffect(() => {
    const open = () => { setModal('mylist') }
    global.app_event.on('openFavorites', open)
    return () => { global.app_event.off('openFavorites', open) }
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
      {/* 首页主滚动：不要右侧滚动条（Material You 的滚动容器默认不画 indicator） */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: NAV_BAR_SPACE }}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader title='Emo音乐' />

        {/*
          5 张大卡：对齐飞牛音乐的横向吸附轮播；卡片视觉由 BigCard 负责。
        */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.hScroll}
          decelerationRate='fast'
          snapToInterval={cardWidth + GRID_GAP}
          contentContainerStyle={[styles.cardsRow, { paddingLeft: GRID_PADDING, paddingRight: GRID_PADDING, gap: GRID_GAP }]}
          onLayout={e => {
            const { width } = e.nativeEvent.layout
            setCardsViewport(prev => (Math.abs(prev - width) > 0.5 ? width : prev))
          }}
        >
          {
            cardWidth > 0
              ? CARDS.map((card, i) => (
                <BigCard
                  key={card.key}
                  index={i}
                  title={card.title}
                  icon={card.icon}
                  variant={card.variant}
                  width={cardWidth}
                  height={cardHeight}
                  onPress={() => { handleCard(card.key) }}
                />
              ))
              : null
          }
        </ScrollView>

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
          recentAlbums.length
            ? (
                <>
                  <SectionHead title='最近添加专辑' onPress={() => { openLocal('album') }} />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.hScroll}
                    contentContainerStyle={styles.albumRow}
                  >
                    {
                      recentAlbums.map(album => (
                        <TouchableOpacity
                          key={album.key}
                          style={styles.albumCard}
                          activeOpacity={0.8}
                          onPress={() => { openLocal('album', album.name) }}
                        >
                          <CoverImage item={album.coverItem} size={scaleSizeW(118)} radius={16} inset={0} />
                          <Text size={12.5} numberOfLines={1} style={styles.albumName}>{album.name}</Text>
                          <Text size={9.5} color={theme['c-450']} numberOfLines={1}>{`${album.singer || '未知歌手'} · ${album.count} 首`}</Text>
                        </TouchableOpacity>
                      ))
                    }
                  </ScrollView>
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

      {/* 悬浮搜索：下滑时固定在右上角，液态玻璃胶囊 */}
      <View style={{ position: 'absolute', top: statusBarHeight + 12, right: 16 }}>
        <TouchableOpacity
          style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.85}
          accessibilityRole='button'
          accessibilityLabel='搜索'
          onPress={() => { setSearchVisible(true) }}
        >
          <LiquidGlass mode={glassStyle} blurRadius={20} radius={20} tint={theme['c-primary-alpha-800']} isDark={theme.isDark} />
          <Icon name='magnify' size={19} color={theme['c-primary']} />
        </TouchableOpacity>
      </View>

      {searchVisible ? <SearchModal onClose={() => { setSearchVisible(false) }} /> : null}
      {
        modal === 'songlist'
          ? (
            <PageModal
              title='歌单广场'
              onClose={() => { setModal(null) }}
              right={(
                <View style={styles.headerRight}>
                  {/* 歌单广场的来源图标移到页头标题右侧，和链接按钮同一水平线对齐 */}
                  <SongListHeaderSourceBar />
                  {/* 和独立页 SongListScreen 完全一致：PageHeader 的 40dp 圆形按钮 + icon 20 */}
                  <HeaderButton
                    icon='link-variant'
                    size={20}
                    color={theme['c-450']}
                    onPress={() => { global.app_event.openSonglistLink() }}
                  />
                </View>
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
                  titleRight={(
                    <FavoriteTabs
                      tab={favoriteTab}
                      onChange={setFavoriteTab}
                      onCreate={() => { listNameEditRef.current?.showCreate(listState.userList.length) }}
                    />
                  )}
                >
                  <Favorites tab={favoriteTab} onTabChange={setFavoriteTab} onRename={item => { listNameEditRef.current?.show(item) }} onCreate={() => { listNameEditRef.current?.showCreate(listState.userList.length) }} />
                </PageModal>
                )
              : null
      }
      {
        localVisible
          ? (
            <PageModal title='本地音乐' onClose={() => { setLocalVisible(false) }}>
              <LocalMusic initialTab={localTab} initialAlbum={localAlbum} onClose={() => { setLocalVisible(false) }} onOpenFavorites={() => { setLocalVisible(false); setModal('mylist') }} />
            </PageModal>
            )
          : null
      }
      <UserApiEditModal ref={userApiModalRef} />
      <ListNameEdit ref={listNameEditRef} />
      <ListeningStatsModal visible={statsVisible} onClose={() => { setStatsVisible(false) }} />
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardsRow: {
    paddingTop: 2,
    paddingBottom: 12,
  },
  hScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  albumRow: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 4,
  },
  albumCard: {
    width: scaleSizeW(118),
    marginRight: 12,
  },
  albumName: {
    marginTop: 6,
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
