import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, Modal, ScrollView, TouchableOpacity, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'

import Chip from '@/components/common/Chip'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Glass from '@/components/common/Glass'
import CapsuleProgress from '@/components/common/CapsuleProgress'
import AlbumDiscSpin from '@/components/common/AlbumDiscSpin'
import PicImage from '@/components/common/PicImage'
import MusicList from './MusicList'
import { playList, togglePlay } from '@/core/player/player'
import { setActiveList } from '@/core/list'
import { LIST_IDS } from '@/config/constant'
import { measureStartRect, openPlayerWithTransition } from '@/utils/playerOpen'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo, useIsPlay, useProgress, usePlayInfo } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useKeyboard } from '@/utils/hooks'
import { getListMusicSync } from '@/utils/listManage'
import { contrastOn } from '@/theme/solid'
import { cleanSongName } from '@/utils/songName'
import { createStyle } from '@/utils/tools'

type Tab = 'love' | 'temp'

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
    // 页面挂载时列表可能还没初始化完，等下一次事件再刷新
    update()
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
 * 磨砂玻璃 + 顶部高光 + 边缘进度光晕，圆形会转的封面。
 * 这里额外多一个「队列」入口（打开本页的播放队列弹层），
 * 点击封面/歌名歌手则切到播放器页（和底部导航圆盘走同一个入口）。
 */
const MiniPlayer = memo(({ onOpenQueue }: { onOpenQueue: () => void }) => {
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const { progress } = useProgress()
  const progressStyle = useSettingValue('common.navProgressStyle') ?? 'border'
  const autoHidePlayBar = useSettingValue('common.autoHidePlayBar')
  const { keyboardShown } = useKeyboard()
  const isDark = theme.isDark
  const [barSize, setBarSize] = useState({ w: 0, h: 0 })
  /** 封面节点：打开播放器时量它的屏幕位置作为共享元素动画起点 */
  const coverRef = useRef<View>(null)

  /** 呼吸灯：和胶囊/播放条同一份节奏 */
  const breathe = useRef(new Animated.Value(0.62)).current
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0.62, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]))
    anim.start()
    return () => { anim.stop() }
  }, [breathe])

  const openPlayer = useCallback(() => {
    openPlayerWithTransition(done => {
      // 飞行的封面按圆盘（40dp）算，外圈那圈 54dp 的进度环不算进起点
      measureStartRect(coverRef.current, done, 40)
    })
  }, [])

  if (autoHidePlayBar && keyboardShown) return null
  if (!musicInfo.name) return null
  const songName = cleanSongName(musicInfo.name, musicInfo.singer)
  const ratio = Math.max(0, Math.min(1, progress))

  return (
    <View style={styles.playerWrap} pointerEvents='box-none'>
      <View
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout
          setBarSize(prev => (Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5) ? prev : { w: width, h: height })
        }}
        style={{
          ...styles.playerCard,
          backgroundColor: isDark ? 'rgba(22,17,30,0.34)' : 'rgba(255,255,255,0.42)',
          shadowColor: isDark ? '#000000' : '#6E6285',
        }}
      >
        <Glass
          blurRadius={24}
          tint={isDark ? 'rgba(22,17,30,0.42)' : 'rgba(255,255,255,0.34)'}
          radius={PLAYER_BAR_RADIUS}
        />

        {/* 玻璃反光：和胶囊导航同一套上半部高光 */}
        <LinearGradient
          colors={isDark
            ? ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0)']
            : ['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
          locations={[0, 0.55, 1]}
          style={styles.playerGloss}
          pointerEvents='none'
        />

        <CapsuleProgress
          width={barSize.w}
          height={barSize.h}
          progress={progressStyle === 'border' ? ratio : 0}
          color={theme['c-primary']}
          breathe={breathe}
        />

        {/* 点封面/歌名歌手进播放器页：和底部导航圆盘、迷你播放条走同一个转场入口 */}
        <TouchableOpacity
          style={styles.playerInfo}
          activeOpacity={0.75}
          onPress={openPlayer}
        >
          {/* 封面包一层才能当共享元素起点（AlbumDiscSpin 不是原生 View） */}
          <View ref={coverRef} collapsable={false} style={styles.playerCover}>
            <AlbumDiscSpin
              discSize={40}
              ringSize={54}
              progress={ratio}
              showRing={progressStyle === 'ring'}
              dark={isDark}
            />
          </View>
          <View style={styles.playerText}>
            <Text size={13} numberOfLines={1} style={styles.playerName}>{songName}</Text>
            <Text size={10.5} color={theme['c-450']} numberOfLines={1} style={styles.playerSinger}>
              {musicInfo.singer || '未知歌手'}
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
 * 收藏页：「我的收藏」和「试听列表」并列成两个胶囊页签。
 *
 * 样式对齐本地音乐 / 下载中心：顶部一张概览卡（标题 + 统计 + 播放全部），
 * 下面一排胶囊页签，列表沿用「我的列表」那套卡片行，
 * 底部悬浮一个和胶囊导航同材质的迷你播放器。
 *
 * 注意这是首页 PageModal 里的整屏子页，标题「收藏」由 PageModal 的 PageHeader 提供，
 * 这里不再重复画一个全屏页头，只补子页内的概览区；底部胶囊导航在子页打开期间
 * 会被外壳收起（PageModal 的 overlay lock），列表自带的 NAV_BAR_SPACE 留白
 * 正好让迷你播放器悬浮在列表最后一项下面，不会盖住内容。
 */
export default () => {
  const theme = useTheme()
  const [tab, setTab] = useState<Tab>('love')
  const [queueVisible, setQueueVisible] = useState(false)
  const counts = useListCounts()
  const count = tab === 'love' ? counts.love : counts.temp
  const tabTitle = tab === 'love' ? '我的收藏' : '试听列表'

  useEffect(() => {
    setActiveList(tab === 'love' ? LIST_IDS.LOVE : LIST_IDS.TEMP)
  }, [tab])

  const handlePlayAll = useCallback(() => {
    if (!count) return
    void playList(tab === 'love' ? LIST_IDS.LOVE : LIST_IDS.TEMP, 0)
  }, [tab, count])

  const handleOpenQueue = useCallback(() => { setQueueVisible(true) }, [])
  const handleCloseQueue = useCallback(() => { setQueueVisible(false) }, [])

  return (
    <View style={styles.container}>
      {/* 子页概览区：标题 + 统计 + 播放全部，和本地音乐的扫描卡/下载中心的页头标签同一套 token */}
      <View
        style={{
          ...styles.overview,
          backgroundColor: theme['c-primary-alpha-900'],
          borderColor: theme['c-primary-alpha-700'],
        }}
      >
        <View style={{ ...styles.overviewIcon, backgroundColor: theme['c-primary-alpha-800'] }}>
          <Icon name={tab === 'love' ? 'love' : 'clock-outline'} size={20} color={theme['c-primary']} />
        </View>
        <View style={styles.overviewInfo}>
          <Text size={14} style={styles.overviewTitle}>{tabTitle}</Text>
          <Text size={10.5} color={theme['c-450']} numberOfLines={1} style={styles.overviewMeta}>
            {tab === 'love'
              ? `我的收藏 · ${count} 首 · 长按歌曲可以批量管理`
              : `试听列表 · ${count} 首 · 临时放进来试听的歌，重启不会丢`}
          </Text>
        </View>
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

      <View style={styles.tabs}>
        <Chip
          label='我的收藏'
          active={tab === 'love'}
          onPress={() => { if (tab !== 'love') setTab('love') }}
        />
        <Chip
          label='试听列表'
          active={tab === 'temp'}
          onPress={() => { if (tab !== 'temp') setTab('temp') }}
        />
      </View>

      <View style={styles.list}>
        <MusicList hideHeader />
      </View>

      <MiniPlayer onOpenQueue={handleOpenQueue} />
      <QueueSheet visible={queueVisible} onClose={handleCloseQueue} />
    </View>
  )
}

const styles = createStyle({
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
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 2,
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
    paddingLeft: 8,
    paddingRight: 4,
    elevation: 10,
    shadowOpacity: 0.26,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    overflow: 'hidden',
  },
  playerGloss: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: PLAYER_BAR_HEIGHT * 0.66,
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
