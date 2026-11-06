import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { getBoardsList } from '@/core/leaderboard'
import { getLeaderboardSetting, saveLeaderboardSetting } from '@/utils/data'
import leaderboardState, { type BoardItem } from '@/store/leaderboard/state'
import boardState from '@/store/leaderboard/state'
import MusicList, { type MusicListType } from '../MusicList'
import { handlePlay } from '../listAction'
import { addTasks } from '@/core/download'
import { getSelectionBar } from '@/utils/selectionBar'
import { BoardChips } from './Chips'
import { resetHeaderSources, setHeaderSources } from './headerSources'
import { resetLeaderboardHero, setLeaderboardHero } from '@/utils/leaderboardHero'
import PlayerBar from '@/components/player/PlayerBar'
import LiquidGlass from '@/components/common/LiquidGlass'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'

/**
 * 排行榜（横竖屏共用）。
 *
 * 版面分三层，和本地音乐 / 下载中心一致：
 *   1. PageModal 的页头「排行榜」+ 右侧「来源图标组 + 播放/下载按钮」（CompactHero）
 *   2. 一排横向滚动的榜单 chips（16 的左右边距）
 *   3. 歌曲列表 + 底部悬浮 PlayerBar（列表底部由 OnlineList 预留 NAV_BAR_SPACE）
 *
 * 来源图标不再单独占一排：状态通过 headerSources 模块级 store 写给页头的
 * CompactHero → HeaderSourceBar（导航层级隔了几层，用不了 props）。
 */
export default () => {
  const glassStyle = useSettingValue('common.navGlassStyle') ?? 'liquid'
  const theme = useTheme()
  const musicListRef = useRef<MusicListType>(null)
  const [source, setSource] = useState<LX.OnlineSource>(leaderboardState.sources[0] ?? 'kw')
  const [boards, setBoards] = useState<BoardItem[]>([])
  const [activeId, setActiveId] = useState('')
  const sourceRef = useRef(source)
  const activeIdRef = useRef('')
  const requestIdRef = useRef(0)

  const loadBoardList = useCallback((src: LX.OnlineSource, preferId?: string) => {
    const requestId = ++requestIdRef.current
    setBoards([])
    setActiveId('')
    activeIdRef.current = ''
    void getBoardsList(src).then(list => {
      if (requestId !== requestIdRef.current) return
      if (!list.length) {
        toast('该音源暂时没有可用榜单')
        return
      }
      const target = preferId && list.some(b => b.id === preferId) ? preferId : list[0].id
      setBoards(list)
      setActiveId(target)
      activeIdRef.current = target
      musicListRef.current?.loadList(src, target)
      void saveLeaderboardSetting({ source: src, boardId: target })
    }).catch(() => {
      if (requestId !== requestIdRef.current) return
      toast('榜单加载失败，请检查音源是否可用')
    })
  }, [])

  useEffect(() => {
    void getLeaderboardSetting().then(({ source, boardId }) => {
      const src = leaderboardState.sources.includes(source) ? source : (leaderboardState.sources[0] ?? 'kw')
      sourceRef.current = src
      setSource(src)
      loadBoardList(src, boardId)
    })
  }, [loadBoardList])

  const handleSourceChange = useCallback((src: LX.OnlineSource) => {
    sourceRef.current = src
    setSource(src)
    loadBoardList(src)
  }, [loadBoardList])

  const handleBoardChange = useCallback((id: string) => {
    activeIdRef.current = id
    setActiveId(id)
    musicListRef.current?.loadList(sourceRef.current, id)
    void saveLeaderboardSetting({ source: sourceRef.current, boardId: id })
  }, [])

  const handlePlayAll = useCallback(() => {
    const id = activeIdRef.current
    if (!id) return
    // 多选时只播放选中的；没选中才播放当前榜单全部
    const selected = getSelectionBar().selectedList
    const all = boardState.listDetailInfo.id === id ? boardState.listDetailInfo.list : undefined
    const list = selected.length ? selected : all
    void handlePlay(id, list)
  }, [])

  const handleDownloadAll = useCallback(async() => {
    const id = activeIdRef.current
    const selected = getSelectionBar().selectedList
    const all = boardState.listDetailInfo.id === id ? boardState.listDetailInfo.list : []
    const list = selected.length ? selected : all
    if (!list.length) {
      toast('列表还没加载完，稍后再试')
      return
    }
    const confirm = await confirmDialog({
      message: selected.length
        ? `将选中的 ${list.length} 首歌加入下载队列？`
        : `将当前榜单的 ${list.length} 首歌加入下载队列？`,
      confirmButtonText: '开始下载',
      cancelButtonText: '取消',
    })
    if (!confirm) return
    const added = addTasks(list, { listId: `board__${id}` })
    toast(added ? `已添加 ${added} 首到下载队列` : '这些歌曲已经在下载队列中')
  }, [])

  const activeName = boards.find(b => b.id === activeId)?.name ?? ''

  // 把「来源列表 / 当前来源 / 切换回调」写给页头右侧的 HeaderSourceBar（同一个页头里隔层渲染）
  useEffect(() => {
    setHeaderSources({
      visible: true,
      sources: leaderboardState.sources,
      active: source,
      onChange: handleSourceChange,
    })
  }, [source, handleSourceChange])
  // 退出排行榜子页时清掉，避免来源图标残留在其它页头
  useEffect(() => () => { resetHeaderSources() }, [])

  // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
  const heroPlayAll = useCallback(() => { void handlePlayAll() }, [handlePlayAll])
  // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
  const heroDownloadAll = useCallback(() => { void handleDownloadAll() }, [handleDownloadAll])
  // 页头右侧的紧凑按钮从这份状态读（标题栏在 PageModal 里，隔了几层）。
  // 榜单名/歌曲数不再在标题栏重复展示，这里只同步「当前是否已选中某个榜单 + 两个操作」。
  useEffect(() => {
    setLeaderboardHero({ name: activeName, meta: '', onPlayAll: heroPlayAll, onDownloadAll: heroDownloadAll })
  }, [activeName, heroPlayAll, heroDownloadAll])
  useEffect(() => () => { resetLeaderboardHero() }, [])

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <LiquidGlass mode={glassStyle} blurRadius={24} radius={0} tint={theme.isDark ? 'rgba(20,16,28,0.42)' : 'rgba(255,255,255,0.34)'} isDark={theme.isDark} seamless flat />
        <BoardChips boards={boards} activeId={activeId} onChange={handleBoardChange} />
      </View>
      <View style={styles.list}>
        <MusicList ref={musicListRef} />
      </View>
      {/* 迷你播放器：和歌单广场/歌单详情同一套；榜单本来就在首页里，转场不需要等 pop */}
      <PlayerBar isHome />
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  filters: {
    paddingTop: 2,
    paddingBottom: 6,
  },
  list: {
    flex: 1,
    marginTop: 4,
  },
})
