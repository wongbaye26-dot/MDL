import { useEffect, useRef, useState } from 'react'
import { getPicUrl } from '@/core/music/online'

/**
 * 歌单详情列表的专辑封面补齐。
 *
 * 部分音源的「歌单歌曲列表」接口不返回单曲封面（例如 kw 的 filterListDetail 里
 * 直接写死了 img: null，kg 的部分映射也一样），映射到 LX.Music.MusicInfoOnline 后
 * 就是 item.meta.picUrl 为空，列表只能显示 Image 组件的占位图。
 *
 * 这里在列表层做兜底：对没有封面的歌曲按 source + songmid 异步请求在线封面
 * （core/music 的 getPicUrl，失败时不允许换源，避免顺手把歌曲切到别的音源）。
 * 只在显式开启 autoFetchPic 的列表（歌单详情）生效，其它 OnlineList 调用方不受影响。
 *
 * 性能约定：
 * - 并发 3 个请求，避免几十首歌同时打网络把滚动拖慢
 * - 结果按歌曲 id 缓存（进程级），失败也记录下来，失败不重试
 * - 结果分批 flush 回 state（300ms），避免每补一张图就整表重渲染一次；
 *   行组件是 memo 的，只有拿到新封面的那一行会真正重渲染
 */

/** 同时进行的补图请求数 */
const MAX_CONCURRENT = 3
/** 补图结果分批写回 state 的间隔 */
const FLUSH_INTERVAL = 300

/** songId -> 封面 url，跨页面复用，重新进同一个歌单不用再请求 */
const picUrlCache = new Map<string, string>()
/** 补图失败的歌曲，进程内不再重试 */
const picUrlFailed = new Set<string>()
/** 请求中的歌曲，避免列表多次 setList 时重复入队 */
const picUrlPending = new Set<string>()

export const getCachedPicUrl = (id: string) => picUrlCache.get(id)

export default function useAutoFetchPicUrls(list: LX.Music.MusicInfoOnline[], enabled: boolean): Record<string, string> {
  const [picUrls, setPicUrls] = useState<Record<string, string>>({})
  const mountedRef = useRef(true)
  const queueRef = useRef<LX.Music.MusicInfoOnline[]>([])
  const runningRef = useRef(0)
  const pendingUrlsRef = useRef<Record<string, string>>({})
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    const flush = () => {
      flushTimerRef.current = null
      if (!mountedRef.current) return
      const pending = pendingUrlsRef.current
      pendingUrlsRef.current = {}
      setPicUrls(prev => ({ ...prev, ...pending }))
    }
    const scheduleFlush = () => {
      if (flushTimerRef.current) return
      flushTimerRef.current = setTimeout(flush, FLUSH_INTERVAL)
    }

    const runNext = () => {
      if (!mountedRef.current) return
      const queue = queueRef.current
      while (runningRef.current < MAX_CONCURRENT && queue.length) {
        const item = queue.shift()!
        runningRef.current++
        void getPicUrl({
          musicInfo: item,
          isRefresh: false,
          // 只补封面，不允许为了一张图把歌曲换到别的音源
          allowToggleSource: false,
        }).then(url => {
          picUrlPending.delete(item.id)
          if (!url) {
            picUrlFailed.add(item.id)
            return
          }
          picUrlCache.set(item.id, url)
          // 顺手写回歌曲本身：同一份数据在播放页/下载等地方也能直接复用
          item.meta.picUrl = url
          // 组件已经卸载时只留缓存，不再触发 setState / 定时器
          if (!mountedRef.current) return
          pendingUrlsRef.current[item.id] = url
          scheduleFlush()
        }).catch(() => {
          picUrlPending.delete(item.id)
          picUrlFailed.add(item.id)
        }).finally(() => {
          runningRef.current--
          runNext()
        })
      }
    }

    // 收集本页里还没有封面的歌曲入队
    for (const item of list) {
      if (!item.id || item.meta.picUrl) continue
      if (picUrlCache.has(item.id) || picUrlFailed.has(item.id) || picUrlPending.has(item.id)) continue
      picUrlPending.add(item.id)
      queueRef.current.push(item)
    }
    runNext()
  }, [enabled, list])

  return picUrls
}
