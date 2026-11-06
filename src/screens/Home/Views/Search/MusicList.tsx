import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import OnlineList, { type OnlineListType, type OnlineListProps } from '@/components/OnlineList'
import { search } from '@/core/search/music'
import searchMusicState, { type Source } from '@/store/search/music/state'
import EmptyView from './EmptyView'
import { getLocalMusicList } from '@/core/localMusic'
import { deduplicationList } from '@/utils'

/** 本地匹配最多拼进结果多少首：再多会把在线结果淹掉 */
const LOCAL_MATCH_LIMIT = 10

export interface MusicListType {
  loadList: (text: string, source: Source) => void
}

/**
 * 在本地曲库里搜「歌名 / 歌手」命中的歌。
 * 限 10 首、按 id 去重（曲库可能因为重复扫描出现同 id 条目）。
 */
const matchLocalMusic = async(text: string): Promise<LX.Music.MusicInfoLocal[]> => {
  if (!text) return []
  const kw = text.toLowerCase()
  const matched: LX.Music.MusicInfoLocal[] = []
  const ids = new Set<string>()
  // getLocalMusicList 返回的是副本，这里只读不原地改
  for (const item of await getLocalMusicList()) {
    if (ids.has(item.id)) continue
    const name = (item.name ?? '').toLowerCase()
    const singer = (item.singer ?? '').toLowerCase()
    if (!name.includes(kw) && !singer.includes(kw)) continue
    ids.add(item.id)
    matched.push(item)
    if (matched.length >= LOCAL_MATCH_LIMIT) break
  }
  return matched
}

/** 本地匹配存在或「全部音源」时需要显示「本地 / 音源」来源标记 */
const needShowSource = (localMatches: LX.Music.MusicInfoLocal[], source: Source) => (
  source === 'all' || localMatches.length > 0
)

export default forwardRef<MusicListType, {}>((props, ref) => {
  const listRef = useRef<OnlineListType>(null)
  const searchInfoRef = useRef<{ text: string, source: Source }>({ text: '', source: 'kw' })
  /**
   * 当前关键词命中的本地歌曲缓存。
   * 搜索、下拉刷新、加载更多都从同一份缓存里取，
   * 避免出现「首次不显示本地 / 下拉刷新后本地消失 / 再搜一次才回来」。
   */
  const localMatchesRef = useRef<{ text: string, list: LX.Music.MusicInfoLocal[] }>({ text: '', list: [] })
  const isUnmountedRef = useRef(false)
  /**
   * 每次搜索生成一个请求号。
   * 异步返回的本地匹配 / 在线结果如果已经不是最新一次搜索，就直接丢掉，
   * 防止快速改关键词时旧结果盖到新列表上。
   */
  const requestIdRef = useRef(0)

  const getLocalMatches = useCallback(async(text: string, force = false) => {
    const cache = localMatchesRef.current
    if (!force && cache.text === text) return cache.list
    const list = await matchLocalMusic(text)
    // 只缓存最后一次搜索的匹配，避免旧关键词的结果被复用
    if (searchInfoRef.current.text === text) localMatchesRef.current = { text, list }
    return list
  }, [])

  /**
   * 把本地匹配拼在在线结果前面，并同步「本地/在线」标记。
   *
   * 注意：`core/search/music` 的 `search()` 每次返回的都是「累积后的整页列表」
   * （第 2 页返回第 1、2 页合并后的结果），而 OnlineList 的 `setList` 是整体替换
   * data（`isAppend` 只决定要不要清空多选），并不做真正的追加。
   * 所以每次（首搜 / 刷新 / 加载更多）都要把本地匹配重新拼回最前面，
   * 只在第一页拼、翻页只传在线部分的话，一加载更多本地结果就消失了。
   * 这里再按 id 去一次重，避免任何来源下出现重复行。
   */
  const applyList = useCallback((
    online: LX.Music.MusicInfoOnline[],
    localMatches: LX.Music.MusicInfoLocal[],
    isAppend = false,
  ) => {
    const merged = deduplicationList([
      ...localMatches,
      ...online,
    ] as unknown as LX.Music.MusicInfoOnline[])
    listRef.current?.setList(
      merged,
      isAppend,
      needShowSource(localMatches, searchInfoRef.current.source),
    )
  }, [])

  useImperativeHandle(ref, () => ({
    async loadList(text, source) {
      const requestId = ++requestIdRef.current
      searchInfoRef.current.text = text
      searchInfoRef.current.source = source
      // 每次真正发起搜索都重新算一遍本地匹配（曲库可能刚更新过），
      // 结果顺手写进缓存给下拉刷新 / 加载更多复用
      const localMatches = await getLocalMatches(text, true)
      if (isUnmountedRef.current || requestId !== requestIdRef.current) return
      listRef.current?.setList(
        localMatches as unknown as LX.Music.MusicInfoOnline[],
        false,
        needShowSource(localMatches, source),
      )
      const listInfo = searchMusicState.listInfos[source]
      if (searchMusicState.searchText == text && searchMusicState.source == source && listInfo?.list.length) {
        requestAnimationFrame(() => {
          if (isUnmountedRef.current || requestId !== requestIdRef.current) return
          applyList(listInfo.list, localMatches)
        })
      } else {
        listRef.current?.setStatus('loading')
        const page = 1
        return search(text, page, source).then((list) => {
          if (isUnmountedRef.current || requestId !== requestIdRef.current) return
          requestAnimationFrame(() => {
            if (isUnmountedRef.current || requestId !== requestIdRef.current) return
            applyList(list, localMatches)
            listRef.current?.setStatus(searchMusicState.listInfos[source]!.maxPage <= page ? 'end' : 'idle')
          })
        }).catch(() => {
          if (isUnmountedRef.current || requestId !== requestIdRef.current) return
          listRef.current?.setStatus('error')
        })
      }
    },
  }), [applyList, getLocalMatches])

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  /** 下拉刷新：本地匹配复用当前关键词的缓存，和在线第一页重新拼一次 */
  const handleRefresh: OnlineListProps['onRefresh'] = () => {
    const { text, source } = searchInfoRef.current
    if (!text) return
    const page = 1
    listRef.current?.setStatus('refreshing')
    void (async() => {
      try {
        const localMatches = await getLocalMatches(text)
        if (isUnmountedRef.current) return
        const list = await search(text, page, source)
        if (isUnmountedRef.current) return
        applyList(list, localMatches)
        listRef.current?.setStatus(searchMusicState.listInfos[source]!.maxPage <= page ? 'end' : 'idle')
      } catch {
        if (isUnmountedRef.current) return
        listRef.current?.setStatus('error')
      }
    })()
  }

  /** 加载更多：search 返回的是「累积后的整页列表」，本地匹配依旧拼在最前面 */
  const handleLoadMore: OnlineListProps['onLoadMore'] = () => {
    const { text, source } = searchInfoRef.current
    if (!text) return
    const info = searchMusicState.listInfos[source]!
    const page = info?.list.length ? info.page + 1 : 1
    listRef.current?.setStatus('loading')
    void (async() => {
      try {
        const localMatches = await getLocalMatches(text)
        if (isUnmountedRef.current) return
        const list = await search(text, page, source)
        if (isUnmountedRef.current) return
        applyList(list, localMatches, true)
        listRef.current?.setStatus(info.maxPage <= page ? 'end' : 'idle')
      } catch {
        if (isUnmountedRef.current) return
        listRef.current?.setStatus('error')
      }
    })()
  }

  return <OnlineList
    ref={listRef}
    onRefresh={handleRefresh}
    onLoadMore={handleLoadMore}
    checkHomePagerIdle
    hideModeBar
    autoFetchPic
    ListEmptyComponent={EmptyView}
  />
})
