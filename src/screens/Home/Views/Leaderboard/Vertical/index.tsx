import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { getBoardsList } from '@/core/leaderboard'
import { getLeaderboardSetting, saveLeaderboardSetting } from '@/utils/data'
import leaderboardState, { type BoardItem } from '@/store/leaderboard/state'
import boardState from '@/store/leaderboard/state'
import { useSourceListI18n } from '@/components/SourceSelector'
import MusicList, { type MusicListType } from '../MusicList'
import { handlePlay } from '../listAction'
import { addTasks } from '@/core/download'
import { SourceChips, BoardChips } from './Chips'
import { resetLeaderboardHero, setLeaderboardHero } from '@/utils/leaderboardHero'
import PlayerBar from '@/components/player/PlayerBar'

export default () => {
  const musicListRef = useRef<MusicListType>(null)
  const [source, setSource] = useState<LX.OnlineSource>(leaderboardState.sources[0] ?? 'kw')
  const [boards, setBoards] = useState<BoardItem[]>([])
  const [activeId, setActiveId] = useState('')
  const [count, setCount] = useState(0)
  const sourceRef = useRef(source)
  const activeIdRef = useRef('')
  const requestIdRef = useRef(0)
  const sourceList = useSourceListI18n(leaderboardState.sources)

  const loadBoardList = useCallback((src: LX.OnlineSource, preferId?: string) => {
    const requestId = ++requestIdRef.current
    setBoards([])
    setActiveId('')
    activeIdRef.current = ''
    setCount(0)
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
    setCount(0)
    musicListRef.current?.loadList(sourceRef.current, id)
    void saveLeaderboardSetting({ source: sourceRef.current, boardId: id })
  }, [])

  const handleListChange = useCallback((list: LX.Music.MusicInfoOnline[]) => {
    setCount(list.length)
  }, [])

  const handlePlayAll = useCallback(() => {
    const id = activeIdRef.current
    if (!id) return
    const list = boardState.listDetailInfo.id === id ? boardState.listDetailInfo.list : undefined
    void handlePlay(id, list)
  }, [])

  const handleDownloadAll = useCallback(async() => {
    const id = activeIdRef.current
    const list = boardState.listDetailInfo.id === id ? boardState.listDetailInfo.list : []
    if (!list.length) {
      toast('列表还没加载完，稍后再试')
      return
    }
    const confirm = await confirmDialog({
      message: `将当前榜单的 ${list.length} 首歌加入下载队列？`,
      confirmButtonText: '开始下载',
      cancelButtonText: '取消',
    })
    if (!confirm) return
    const added = addTasks(list, { listId: `board__${id}` })
    toast(added ? `已添加 ${added} 首到下载队列` : '这些歌曲已经在下载队列中')
  }, [])

  const activeName = boards.find(b => b.id === activeId)?.name ?? ''
  const sourceName = sourceList.find(s => s.action === source)?.label ?? ''
  const meta = `${count ? `共 ${count} 首` : '正在加载'}${sourceName ? ` · ${sourceName}` : ''}`

  // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
  const heroPlayAll = useCallback(() => { void handlePlayAll() }, [handlePlayAll])
  // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
  const heroDownloadAll = useCallback(() => { void handleDownloadAll() }, [handleDownloadAll])
  // 标题右侧的紧凑卡片从这份状态读（标题栏在 PageModal 里，隔了几层）
  useEffect(() => {
    setLeaderboardHero({ name: activeName, meta, onPlayAll: heroPlayAll, onDownloadAll: heroDownloadAll })
  }, [activeName, meta, heroPlayAll, heroDownloadAll])
  useEffect(() => () => { resetLeaderboardHero() }, [])

  return (
    <View style={styles.container}>
      <SourceChips active={source} onChange={handleSourceChange} />
      <BoardChips boards={boards} activeId={activeId} onChange={handleBoardChange} />
      <View style={styles.list}>
        <MusicList ref={musicListRef} onListChange={handleListChange} />
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
  list: {
    flex: 1,
    marginTop: 8,
  },
})
