import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Glass from '@/components/common/Glass'
import AlbumDiscSpin, { DISC_SIZE } from '@/components/common/AlbumDiscSpin'
import PicImage from '@/components/common/PicImage'
import MusicList from './MusicList'
import { playList, togglePlay } from '@/core/player/player'
import { getListMusics, removeUserList, setActiveList } from '@/core/list'
import { LIST_IDS } from '@/config/constant'
import { measureStartRect, openPlayerWithTransition } from '@/utils/playerOpen'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo, useIsPlay, useProgress, usePlayInfo } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useMyList } from '@/store/list/hook'
import { getListMusicSync } from '@/utils/listManage'
import { useLrcPlay } from '@/plugins/lyric'
import { useKeyboard } from '@/utils/hooks'
import { contrastOn } from '@/theme/solid'
import { cleanSongName } from '@/utils/songName'
import { confirmDialog, createStyle, toast } from '@/utils/tools'

export type FavoriteTab = 'playlist' | 'love' | 'temp'

/** 试听列表只展示最近多少首（真实播放队列不动，只在展示层截断） */
export const TEMP_DISPLAY_LIMIT = 30

/** 迷你播放条和底部胶囊导航同高（飞牛实测 59dp） */
const PLAYER_BAR_HEIGHT = 59
const PLAYER_BAR_RADIUS = PLAYER_BAR_HEIGHT / 2

/**
 * 收藏 / 试听列表的数量。
 *
 * 列表数据在 core 的 allMusicList 里，组件不持有它；这里只在「列表歌曲变化」
 * 事件时同步读一次长度，避免为了两个数字把整份歌曲数组拉进 state。
 */
const useListCounts = () => {
  const [counts, setCounts] = useState(() => ({
    love: getListMusicSync(LIST_IDS.LOVE).length,
    temp: getListMusicSync(LIST_IDS.TEMP).length,
  }))

  useEffect(() => {
    const update = () => {
      setCounts(prev => {
        const next = {
          love: getListMusicSync(LIST_IDS.LOVE).length,
          temp: getListMusicSync(LIST_IDS.TEMP).length,
        }
        return next.love === prev.love && next.temp === prev.temp ? prev : next
      })
    }
    // 页面挂载时列表可能还没初始化完，先读一次真实长度，再等事件刷新
    update()
    void Promise.all([getListMusics(LIST_IDS.LOVE), getListMusics(LIST_IDS.TEMP)])
      .then(() => { update() })
      .catch(() => {})
    global.app_event.on('myListMusicUpdate', update)
    return () => {
      global.app_event.off('myListMusicUpdate', update)
    }
  }, [])

  return counts
}

/**
 * 底部迷你播放器。
 *
 * 和榜单/歌单详情页的 PlayerBar、底部胶囊导航同一套玻璃语言：
 * 磨砂玻璃 + 顶部高光 + 圆形会转的封面；进度只走封面圆环（胶囊描边功能已在 v3.8.2 下线）。
 * 这里额外多一个「队列」入口（打开本页的播放队列弹层），
 * 点击封面/歌名歌手则切到播放器页（和底部导航圆盘走同一个入口）。
 */
const MiniPlayer = memo(({ onOpenQueue }: { onOpenQueue: () => void }) => {
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const { progress } = useProgress()
  const lrcPlay = useLrcPlay()
  const progressStyle = useSettingValue('common.navProgressStyle') ?? 'ring'
  const autoHidePlayBar = useSettingValue('common.autoHidePlayBar')
  const { keyboardShown } = useKeyboard()
  const isDark = theme.isDark
  /** 封面节点：打开播放器时量它的屏幕位置作为共享元素动画起点 */
  const coverRef = useRef<View>(null)

  const openPlayer = useCallback(() => {
    openPlayerWithTransition(done => {
      // 飞行的封面按圆盘（48dp）算，外圈那圈 54dp 的进度环不算进起点
      measureStartRect(coverRef.current, done, DISC_SIZE)
    })
  }, [])

  if (autoHidePlayBar && keyboardShown) return null
  if (!musicInfo.name) return null
  const songName = cleanSongName(musicInfo.name, musicInfo.singer)
  const ratio = Math.max(0, Math.min(1, progress))

  return (
    <View style={styles.playerWrap} pointerEvents='box-none'>
      <View
        style={[
          styles.playerCard,
          isDark ? null : styles.playerCardLight,
          isDark
            ? {
                backgroundColor: 'rgba(22,17,30,0.34)',
                shadowColor: '#000000',
              }
            : {
                // 亮色：白色叠层降到最薄，靠 BlurView 透出页面颜色，不做「整块白」
                backgroundColor: 'rgba(255,255,255,0.15)',
                shadowColor: '#6E6285',
              },
        ]}
      >
        <Glass
          blurRadius={24}
          tint={isDark ? 'rgba(22,17,30,0.42)' : 'rgba(255,255,255,0.13)'}
          radius={PLAYER_BAR_RADIUS}
        />

        {/* 玻璃反光：和胶囊导航同一套上半部高光 */}
        <LinearGradient
          colors={isDark
            ? ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0)']
            : ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0)']}
          locations={[0, 0.5, 1]}
          style={styles.playerGloss}
          pointerEvents='none'
        />

        {/* 亮色：底部内阴影撑出玻璃厚度（原来那条 0.5dp 实线描边已去掉） */}
        {isDark
          ? null
          : (
            <LinearGradient
              colors={['rgba(150,140,170,0)', 'rgba(150,140,170,0.22)']}
              style={styles.playerInnerShade}
              pointerEvents='none'
            />
            )}

        {/* 点封面/歌名歌手进播放器页：和底部导航圆盘、迷你播放条走同一个转场入口 */}
        <TouchableOpacity
          style={styles.playerInfo}
          activeOpacity={0.75}
          onPress={openPlayer}
        >
          {/* 封面包一层才能当共享元素起点（AlbumDiscSpin 不是原生 View） */}
          <View ref={coverRef} collapsable={false} style={styles.playerCover}>
            <AlbumDiscSpin
              progress={progressStyle === 'ring' ? ratio : 0}
              showRing={progressStyle !== 'none'}
              dark={isDark}
            />
          </View>
          <View style={styles.playerText}>
            <Text size={13} numberOfLines={1} style={isDark ? styles.playerName : [styles.playerName, styles.lightTextShadow]}>{songName}</Text>
            <Text size={10.5} color={theme['c-450']} numberOfLines={1} style={isDark ? styles.playerSinger : [styles.playerSinger, styles.lightTextShadow]}>
              {lrcPlay.text || musicInfo.singer || '未知歌手'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.playerBtn} activeOpacity={0.6} onPress={togglePlay}>
          <Icon name={isPlay ? 'pause' : 'play'} size={24} color={theme['c-primary']} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.playerBtn} activeOpacity={0.6} onPress={onOpenQueue}>
          <Icon name='playlist-music' size={22} color={theme['c-primary']} />
        </TouchableOpacity>
      </View>
    </View>
  )
})

/**
 * 播放队列弹层。
 *
 * 播放器页的队列面板只在自己页面里，收藏页的迷你播放器也要能进队列，
 * 所以这里按同一套「底部 Sheet + 当前歌高亮」做一个轻量版：
 * 只保留「看队列 / 点歌切歌」，不重复播放器页的播放模式、清空等操作。
 */
const QueueSheet = memo(({ visible, onClose }: { visible: boolean, onClose: () => void }) => {
  const theme = useTheme()
  const playInfo = usePlayInfo()
  const musicInfo = usePlayerMusicInfo()
  const listId = playInfo.playerListId
  const queue = useMemo(() => (
    visible && listId ? getListMusicSync(listId) : []
  ), [visible, listId])

  const handlePlay = useCallback((index: number) => {
    if (!listId) return
    onClose()
    void playList(listId, index)
  }, [listId, onClose])

  return (
    <Modal visible={visible} transparent animationType='slide' onRequestClose={onClose}>
      <View style={styles.queueRoot}>
        {/* 蒙层单独铺在底层：点空白处关闭，点/滚 Sheet 不会误触 */}
        <TouchableOpacity style={styles.queueBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={{ ...styles.queueSheet, backgroundColor: theme['c-content-background'] }}>
          <View style={{ ...styles.queueHandle, backgroundColor: theme['c-350'] }} />
          <View style={styles.queueHead}>
            <Text size={15} style={styles.queueTitle}>播放队列</Text>
            <Text size={10.5} color={theme['c-450']}>{queue.length} 首</Text>
          </View>
          {
            queue.length
              ? (
                <ScrollView style={styles.queueList} showsVerticalScrollIndicator={false}>
                  {
                    queue.map((item, index) => {
                      const active = item.id === musicInfo.id
                      return (
                        <TouchableOpacity
                          key={`${item.id}_${index}`}
                          style={styles.queueRow}
                          activeOpacity={0.6}
                          onPress={() => { handlePlay(index) }}
                        >
                          <PicImage musicInfo={item} listId={listId} style={styles.queueCover} />
                          <View style={styles.queueInfo}>
                            <Text
                              size={13}
                              color={active ? theme['c-primary'] : theme['c-font']}
                              numberOfLines={1}
                            >{cleanSongName(item.name, item.singer)}</Text>
                            <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.queueSinger}>
                              {item.singer || '未知歌手'}
                            </Text>
                          </View>
                          {active ? <Icon name='volume-high' size={15} color={theme['c-primary']} /> : null}
                        </TouchableOpacity>
                      )
                    })
                  }
                </ScrollView>
                )
              : (
                <View style={styles.queueEmpty}>
                  <Icon name='playlist-music' size={26} color={theme['c-400']} />
                  <Text size={12} color={theme['c-450']} style={styles.queueEmptyText}>当前没有播放队列</Text>
                </View>
                )
          }
        </View>
      </View>
    </Modal>
  )
})

/**
 * 收藏页的两个胶囊页签。
 *
 * 现在放在 PageModal 标题「收藏」右侧同一行（PageHeader 的 titleRight），
 * 所以做得比内容区的筛选胶囊小一号（高 28、字号 11.5），正好能塞进页头行内。
 * 状态由 Home 持有（受控）：页头页签和下方列表共用同一份 tab，
 * 收起再打开收藏页时也能记住上次看的是哪个列表。
 */
export const FavoriteTabs = ({ tab, onChange, onCreate }: {
  tab: FavoriteTab
  onChange: (tab: FavoriteTab) => void
  onCreate: () => void
}) => {
  const theme = useTheme()
  const items: Array<{ key: FavoriteTab, label: string, icon: string }> = [
    { key: 'playlist', label: '歌单', icon: 'playlist-music' },
    { key: 'love', label: '收藏', icon: 'heart' },
    { key: 'temp', label: '试听', icon: 'clock-outline' },
  ]

  return (
    <View style={styles.headerTabs}>
      {
        items.map(item => {
          const active = tab === item.key
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.iconTab,
                { backgroundColor: active ? theme['c-primary'] : theme['c-primary-alpha-900'] },
              ]}
              activeOpacity={0.8}
              onPress={() => { if (!active) onChange(item.key) }}
              accessibilityRole='button'
              accessibilityLabel={item.label}
            >
              <Icon
                name={item.icon}
                size={18}
                color={active ? contrastOn(theme['c-primary']) : theme['c-450']}
              />
            </TouchableOpacity>
          )
        })
      }
      <TouchableOpacity
        style={[styles.iconTab, { backgroundColor: theme['c-primary-alpha-800'] }]}
        activeOpacity={0.8}
        onPress={onCreate}
        accessibilityRole='button'
        accessibilityLabel='新建歌单'
      >
        <Icon name='plus' size={19} color={theme['c-primary']} />
      </TouchableOpacity>
    </View>
  )
}

/**
 * 收藏页：「我的收藏」和「试听列表」两个列表。
 *
 * 样式对齐本地音乐 / 下载中心：页头（PageModal 的 PageHeader，标题「收藏」，
 * 两个列表的胶囊页签放在标题右侧同一行）+ 子页概览卡（标题 + 统计 + 播放全部），
 * 列表沿用「我的列表」那套行，底部悬浮一个和胶囊导航同材质的迷你播放器。
 *
 * 注意这是首页 PageModal 里的整屏子页，标题和页签由外壳提供，这里只补概览区和列表；
 * 底部胶囊导航在子页打开期间会被外壳收起（PageModal 的 overlay lock），
 * 列表自带的 NAV_BAR_SPACE 留白正好让迷你播放器悬浮在列表最后一项下面，不会盖住内容。
 *
 * tab 是受控的（Home 持有状态，页头页签和这里共用），切换时照旧 setActiveList。
 */
export default ({ tab, onCreate, onTabChange }: {
  tab: FavoriteTab
  onCreate: () => void
  /** 当前由 PageHeader 里的 FavoriteTabs 直接改 Home 的状态；这里保留受控签名，方便以后页内再出现切换入口 */
  onTabChange: (tab: FavoriteTab) => void
}) => {
  const theme = useTheme()
  const [queueVisible, setQueueVisible] = useState(false)
  const userLists = useMyList().slice(2) as LX.List.UserListInfo[]
  const [playlist, setPlaylist] = useState<LX.List.UserListInfo | null>(null)
  const counts = useListCounts()
  const playlistCount = playlist ? getListMusicSync(playlist.id).length : 0
  const count = tab === 'playlist' ? playlistCount : tab === 'love' ? counts.love : counts.temp
  const tabTitle = tab === 'playlist' ? (playlist?.name ?? '我的歌单') : tab === 'love' ? '我的收藏' : '试听列表'

  /*
    打开收藏页时不要沿用「跳到正在播放的那首」的列表：
    MusicList 挂载时会看 global.lx.jumpMyListPosition，如果为 true 会直接加载播放队列（TEMP），
    出现「页头写着我的收藏、列表却是试听列表」的错位。这里在子组件挂载前先清掉。
  */
  useMemo(() => { global.lx.jumpMyListPosition = false }, [])

  useEffect(() => {
    if (tab === 'playlist' && !playlist) return
    const id = tab === 'playlist' ? playlist!.id : tab === 'love' ? LIST_IDS.LOVE : LIST_IDS.TEMP
    setActiveList(id)
    let cancelled = false
    // 不用 runAfterInteractions：冷启动时首页动画可能让队列一直不空闲，试听列表会永远不加载
    const timer = setTimeout(() => {
      if (!cancelled) global.state_event.mylistToggled(id)
    }, 60)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [tab, playlist])

  const handleDeletePlaylist = useCallback(async(item: LX.List.UserListInfo) => {
    const confirmed = await confirmDialog({
      message: `删除歌单「${item.name}」？只删除歌单，不删除本地文件。`,
      confirmButtonText: '删除',
      danger: true,
    })
    if (!confirmed) return
    if (playlist?.id === item.id) setPlaylist(null)
    await removeUserList([item.id])
    toast('歌单已删除')
  }, [playlist])

  const handlePlayAll = useCallback(() => {
    if (!count) return
    if (tab === 'playlist' && playlist) {
      void playList(playlist.id, 0)
      return
    }
    const offset = tab === 'temp' ? Math.max(0, counts.temp - TEMP_DISPLAY_LIMIT) : 0
    void playList(tab === 'love' ? LIST_IDS.LOVE : LIST_IDS.TEMP, offset)
  }, [tab, count, counts.temp, playlist])

  const handleOpenQueue = useCallback(() => { setQueueVisible(true) }, [])
  const handleCloseQueue = useCallback(() => { setQueueVisible(false) }, [])

  return (
    <View style={styles.container}>
      {
        tab === 'playlist' && !playlist
          ? (
            <ScrollView contentContainerStyle={styles.playlistContent} showsVerticalScrollIndicator={false}>
              <View style={styles.playlistHero}>
                <View style={[styles.playlistHeroIcon, { backgroundColor: theme['c-primary-alpha-800'] }]}>
                  <Icon name='playlist-music' size={26} color={theme['c-primary']} />
                </View>
                <View style={styles.playlistHeroText}>
                  <Text size={17} style={styles.overviewTitle}>我的歌单</Text>
                  <Text size={11} color={theme['c-450']} style={styles.overviewMeta}>{userLists.length ? `${userLists.length} 个自建歌单` : '还没有自建歌单，点右上角「新建歌单」创建'}</Text>
                </View>
                <TouchableOpacity style={[styles.playAllBtn, { backgroundColor: theme['c-primary'] }]} activeOpacity={0.85} onPress={onCreate}>
                  <Icon name='plus' size={12} color={contrastOn(theme['c-primary'])} />
                  <Text size={11} color={contrastOn(theme['c-primary'])} style={styles.playAllText}>新建</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.waterfall}>
                {[0, 1].map(col => (
                  <View key={col} style={styles.waterfallCol}>
                    {userLists.filter((_, i) => i % 2 === col).map((item, rowIndex) => {
                      const musics = getListMusicSync(item.id)
                      const first = musics.find(m => m.meta?.picUrl) ?? musics[0]
                      const heights = [210, 158, 190, 146, 202, 170]
                      const cardHeight = heights[userLists.indexOf(item) % heights.length]
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.waterfallCard, { height: cardHeight }]}
                          activeOpacity={0.85}
                          onPress={() => { setPlaylist(item) }}
                          onLongPress={() => { void handleDeletePlaylist(item) }}
                        >
                          <View style={[styles.waterfallCover, styles.waterfallPlaceholder, { backgroundColor: theme['c-primary-alpha-800'] }]}>
                            <Icon name='playlist-music' size={34} color={theme['c-primary']} />
                          </View>
                          {first
                            ? <PicImage musicInfo={first} listId={item.id} style={styles.waterfallCover} />
                            : null}
                          <LinearGradient
                            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.82)']}
                            locations={[0, 0.55, 1]}
                            style={styles.waterfallShade}
                            pointerEvents='none'
                          />
                          <View style={styles.waterfallInfo} pointerEvents='none'>
                            <Text size={14} numberOfLines={1} color='#FFFFFF' style={styles.waterfallName}>{item.name}</Text>
                            <Text size={10.5} numberOfLines={1} color='rgba(255,255,255,0.72)'>{musics.length} 首</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.waterfallDelete}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() => { void handleDeletePlaylist(item) }}
                          >
                            <Icon name='trash-can-outline' size={15} color='#FFFFFF' />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                ))}
              </View>
              {
                !userLists.length
                  ? (
                    <View style={[styles.playlistEmpty, { borderColor: theme['c-primary-alpha-700'] }]}>
                      <Icon name='playlist-music' size={30} color={theme['c-primary']} />
                      <Text size={12} color={theme['c-450']} style={styles.playlistEmptyText}>还没有自建歌单，点右上角「新建歌单」创建</Text>
                    </View>
                    )
                  : null
              }
            </ScrollView>
            )
          : (
            <>
              {/* 子页概览区：标题 + 统计 + 播放全部 */}
              <View
                style={{
                  ...styles.overview,
                  backgroundColor: theme['c-primary-alpha-900'],
                  borderColor: theme['c-primary-alpha-700'],
                }}
              >
                <View style={{ ...styles.overviewIcon, backgroundColor: theme['c-primary-alpha-800'] }}>
                  <Icon name={tab === 'love' ? 'love' : tab === 'temp' ? 'clock-outline' : 'playlist-music'} size={20} color={theme['c-primary']} />
                </View>
                <View style={styles.overviewInfo}>
                  <Text size={14} style={styles.overviewTitle}>{tabTitle}</Text>
                  <Text size={10.5} color={theme['c-450']} numberOfLines={1} style={styles.overviewMeta}>
                    {tab === 'love'
                      ? `我的收藏 · ${count} 首 · 长按歌曲可以批量管理`
                      : tab === 'temp'
                        ? `试听列表 · 共 ${count} 首 · 只显示最近 ${TEMP_DISPLAY_LIMIT} 首`
                        : `${playlist?.name ?? ''} · ${playlistCount} 首`}
                  </Text>
                </View>
                {tab === 'playlist'
                  ? (
                    <TouchableOpacity style={styles.overviewBack} activeOpacity={0.8} onPress={() => { setPlaylist(null) }}>
                      <Icon name='chevron-left' size={16} color={theme['c-450']} />
                    </TouchableOpacity>
                    )
                  : null}
                <TouchableOpacity
                  style={{
                    ...styles.playAllBtn,
                    backgroundColor: count ? theme['c-primary'] : theme['c-primary-alpha-800'],
                  }}
                  activeOpacity={0.85}
                  disabled={!count}
                  onPress={handlePlayAll}
                >
                  <Icon name='play' size={12} color={count ? contrastOn(theme['c-primary']) : theme['c-450']} />
                  <Text
                    size={11}
                    color={count ? contrastOn(theme['c-primary']) : theme['c-450']}
                    style={styles.playAllText}
                  >播放全部</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.list}>
                <MusicList hideHeader displayLimit={tab === 'temp' ? TEMP_DISPLAY_LIMIT : undefined} />
              </View>
            </>
            )
      }

      <MiniPlayer onOpenQueue={handleOpenQueue} />
      <QueueSheet visible={queueVisible} onClose={handleCloseQueue} />
    </View>
  )
}

const styles = createStyle({
  playlistContent: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 140,
  },
  playlistHero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  playlistHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistHeroText: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingLeft: 10,
  },
  waterfall: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  waterfallCol: {
    flex: 1,
    gap: 10,
    alignItems: 'stretch',
  },
  waterfallCard: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  waterfallCover: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  waterfallPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterfallShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '72%',
  },
  waterfallInfo: {
    position: 'absolute',
    left: 12,
    right: 34,
    bottom: 10,
  },
  waterfallName: {
    fontWeight: '700',
  },
  waterfallDelete: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistList: {
    marginTop: 14,
    gap: 10,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  playlistRowCover: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistRowInfo: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingLeft: 12,
    paddingRight: 8,
  },
  playlistRowName: {
    fontWeight: '600',
  },
  playlistRowMeta: {
    marginTop: 3,
  },
  playlistRowDelete: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  playlistCard: {
    width: '47.8%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
    paddingBottom: 10,
  },
  playlistEmpty: {
    marginTop: 16,
    paddingVertical: 28,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistEmptyText: {
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  playlistDelete: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistCover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistCount: {
    marginTop: 2,
    paddingHorizontal: 2,
  },
  playlistName: {
    marginTop: 9,
    paddingHorizontal: 2,
    fontWeight: '600',
  },
  overviewBack: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  container: {
    flex: 1,
  },
  overview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    marginRight: 16,
    marginTop: 4,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 16,
    borderWidth: 0.5,
  },
  overviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overviewInfo: {
    // flexBasis: 0 + minWidth: 0 才能让中间文字真正让位给右侧按钮
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    paddingLeft: 10,
    paddingRight: 8,
  },
  overviewTitle: {
    fontWeight: '700',
  },
  overviewMeta: {
    marginTop: 4,
  },
  playAllBtn: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: 14,
  },
  playAllText: {
    marginLeft: 4,
    fontWeight: '600',
  },
  /** 页头标题行内的两个小胶囊（高度比内容区筛选胶囊小一号，能放进 PageHeader 行内） */
  headerTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconTab: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTabIcon: {
    marginRight: 4,
  },
  list: {
    flex: 1,
    marginTop: 4,
  },
  playerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 6,
    // 竖屏底部没有手势条时留 12dp，和胶囊导航的 14dp 底部留白接近
    paddingBottom: 12,
    alignItems: 'center',
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 292,
    height: PLAYER_BAR_HEIGHT,
    borderRadius: PLAYER_BAR_RADIUS,
    // 和胶囊 / PlayerBar / 横屏迷你播放器一致：进度环左缘距条边 3dp
    paddingLeft: 3,
    paddingRight: 4,
    elevation: 10,
    shadowOpacity: 0.26,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    overflow: 'hidden',
  },
  playerCardLight: {
    // 亮色玻璃更透，外部阴影稍微加重一点把边界托出来（深色分支沿用 playerCard 的阴影）
    elevation: 18,
    shadowOpacity: 0.42,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  playerGloss: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: PLAYER_BAR_HEIGHT * 0.66,
  },
  playerInnerShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: PLAYER_BAR_HEIGHT * 0.55,
  },
  lightTextShadow: {
    // 亮色玻璃上是深色文字：给白色微阴影，透到深色背景上也能读
    textShadowColor: 'rgba(255,255,255,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  playerInfo: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerCover: {
    width: 54,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerText: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 6,
    marginRight: 4,
  },
  playerName: {
    fontWeight: '600',
  },
  playerSinger: {
    marginTop: 2,
  },
  playerBtn: {
    width: 38,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  queueBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  queueSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: '70%',
  },
  queueHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  queueHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
  },
  queueTitle: {
    flexGrow: 1,
    fontWeight: '700',
  },
  queueList: {
    flexGrow: 0,
    flexShrink: 1,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 6,
  },
  queueCover: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  queueInfo: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  queueSinger: {
    marginTop: 2,
  },
  queueEmpty: {
    alignItems: 'center',
    paddingTop: 26,
    paddingBottom: 26,
  },
  queueEmptyText: {
    marginTop: 10,
  },
})
