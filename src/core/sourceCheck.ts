import musicSdk from '@/utils/musicSdk'
import { toNewMusicInfo, toOldMusicInfo } from '@/utils'
import { log } from '@/utils/log'

/**
 * 音源「音乐质量」实测检测。
 *
 * 思路（和真实播放链路保持一致）：
 * 1. 用内置搜索接口对当前脚本声明的每个音源搜一首探测歌，取第一条结果；
 * 2. 按当前脚本声明的音质从高到低依次向脚本请求播放地址；
 * 3. 对拿到的播放地址做 HEAD / Range 探测，读取 content-type、content-length、
 *    accept-ranges，按歌曲时长推断码率，确认这个地址是否真的可播放。
 *
 * 全程带进度回调、可取消，单个音源失败不影响其它音源。
 */

/** 音质从高到低（和播放/下载的降级顺序一致） */
const QUALITY_ORDER: LX.Quality[] = ['flac24bit', 'flac', 'wav', 'ape', '320k', '192k', '128k']

/** 默认探测歌：热词，绝大多数源都能搜到 */
export const DEFAULT_CHECK_KEYWORD = '晴天 周杰伦'

/** 每个音源最多实测的档位数，避免一次检测发太多请求 */
const MAX_QUALITY_PER_SOURCE = 5

/** 同时检测的音源数量 */
const SOURCE_CONCURRENCY = 2

/** 单次搜索超时 */
const SEARCH_TIMEOUT = 15_000
/** 单次取播放地址超时 */
const GET_URL_TIMEOUT = 15_000
/** 单次地址探测超时 */
const PROBE_TIMEOUT = 8_000

export type SourceCheckPhase = 'search' | 'get-url' | 'probe' | 'done'

export interface SourceCheckQualityResult {
  quality: LX.Quality
  ok: boolean
  /** 实测到的播放地址（仅本次检测用，不持久化） */
  url?: string
  contentType?: string
  contentLength?: number
  /** 由 content-length / 歌曲时长推断的码率（kbps） */
  bitrate?: number
  acceptRanges?: string
  /** 该档位从取地址到探测完成的耗时（毫秒） */
  timeMs: number
  error?: string
}

export type SourceCheckStatus = 'pending' | 'checking' | 'ok' | 'failed'

export interface SourceCheckResult {
  source: LX.OnlineSource
  sourceName: string
  status: SourceCheckStatus
  musicName?: string
  singer?: string
  /** 实测可用的最高音质 */
  bestQuality?: LX.Quality
  /** 最高可用音质的端到端延迟（毫秒） */
  latencyMs?: number
  qualities: SourceCheckQualityResult[]
  error?: string
}

export interface SourceCheckProgress {
  total: number
  finished: number
  phase: SourceCheckPhase
  /** 当前正在检测的音源 */
  current: string[]
  keyword: string
}

export interface SourceCheckOptions {
  /** 探测歌曲关键词，默认 {@link DEFAULT_CHECK_KEYWORD} */
  keyword?: string
  /** 要检测的音源 id，默认取当前脚本音质矩阵里的全部音源 */
  sources?: string[]
  /** 音质矩阵，默认 global.lx.qualityList */
  qualitys?: LX.QualityList
  onProgress?: (progress: SourceCheckProgress, results: SourceCheckResult[]) => void
}

export interface SourceCheckTask {
  promise: Promise<SourceCheckResult[]>
  cancel: () => void
}

// RN 的 fetch 没在 TS 里声明完整的 Response 类型，这里只取用得到的字段
interface FetchResponseLike {
  ok: boolean
  status: number
  headers: { get: (name: string) => string | null }
}
type FetchLike = (url: string, init: {
  method?: string
  headers?: Record<string, string>
  signal?: AbortSignal
}) => Promise<FetchResponseLike>

const getFetch = (): FetchLike => (global as unknown as { fetch: FetchLike }).fetch

const sleep = async(ms: number): Promise<void> => {
  await new Promise<void>(resolve => { setTimeout(resolve, ms) })
}

const withTimeout = async<T>(promise: Promise<T>, timeout: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => { reject(new Error(message)) }, timeout)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timer != null) clearTimeout(timer)
  }
}

const getSourceName = (source: string): string => {
  const target = (musicSdk as unknown as { sources?: Array<{ id: string, name: string }> }).sources?.find(item => item.id === source)
  return target?.name ?? source
}

const parseInterval = (interval: string | null | undefined): number => {
  if (!interval) return 0
  const arr = interval.split(':').map(Number)
  if (arr.some(n => !Number.isFinite(n))) return 0
  let seconds = 0
  for (const num of arr) seconds = seconds * 60 + num
  return seconds
}

interface AudioProbeResult {
  ok: boolean
  statusCode?: number
  contentType?: string
  contentLength?: number
  acceptRanges?: string
  error?: string
  /** HEAD 直接网络失败（连不上/超时）：此时没必要再用 GET 重试 */
  networkError?: boolean
}

/**
 * 只读响应头，不读 body：HEAD 失败时用 `Range: bytes=0-0` 的 GET 兜底。
 * 有些 CDN 无视 Range 会直接回 200 全量，但 JS 侧不读 body，最多只占用连接。
 */
/** 有些脚本返回的地址没有协议头，探测前补全 */
const normalizeUrl = (rawUrl: string): string => {
  const url = rawUrl.trim()
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  return `http://${url}`
}

const probeAudioUrl = async(rawUrl: string): Promise<AudioProbeResult> => {
  const fetchImpl = getFetch()
  if (typeof fetchImpl !== 'function') return { ok: false, error: 'fetch unavailable' }
  const url = normalizeUrl(rawUrl)

  const request = async(method: 'head' | 'get', range?: string): Promise<AudioProbeResult> => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | null = null
    try {
      timer = setTimeout(() => { try { controller.abort() } catch {} }, PROBE_TIMEOUT)
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
      }
      if (range) headers.Range = range
      const resp = await fetchImpl(url, { method, headers, signal: controller.signal })
      const getHeader = (name: string): string => {
        try {
          return resp.headers.get(name) ?? ''
        } catch {
          return ''
        }
      }
      const contentLength = Number(getHeader('content-length') || 0)
      return {
        ok: resp.ok || resp.status === 206,
        statusCode: resp.status,
        contentType: getHeader('content-type'),
        contentLength: Number.isFinite(contentLength) ? contentLength : 0,
        acceptRanges: getHeader('accept-ranges'),
      }
    } catch (err: any) {
      return { ok: false, networkError: true, error: err?.message ?? 'probe failed' }
    } finally {
      if (timer != null) clearTimeout(timer)
    }
  }

  let result = await request('head')
  const needFallback = !result.networkError && (!result.ok || !result.contentLength || (result.contentType ?? '').toLowerCase().includes('text/html'))
  if (needFallback) {
    // HEAD 不被支持 / 返回错误页时，用极小的 Range GET 再探一次
    const rangeResult = await request('get', 'bytes=0-0')
    if (rangeResult.ok) result = { ...result, ...rangeResult }
    else if (!result.ok) result = rangeResult
  }
  if (!result.ok) return result

  const contentType = (result.contentType ?? '').toLowerCase()
  const isErrorPage = contentType.includes('text/html')
  return {
    ...result,
    ok: !isErrorPage,
    error: isErrorPage ? 'invalid content-type' : undefined,
  }
}

const sortQualitys = (list: LX.Quality[]): LX.Quality[] => {
  const order = (quality: LX.Quality) => {
    const index = QUALITY_ORDER.indexOf(quality)
    return index < 0 ? QUALITY_ORDER.length : index
  }
  return [...list].sort((a, b) => order(a) - order(b))
}

const buildQualityChain = (declared: LX.Quality[], musicInfo: LX.Music.MusicInfoOnline): LX.Quality[] => {
  const songQualitys = Object.keys(musicInfo.meta._qualitys ?? {}) as LX.Quality[]
  const supportList = sortQualitys(declared)
  const available = supportList.filter(quality => songQualitys.includes(quality))
  if (available.length) return available.slice(0, MAX_QUALITY_PER_SOURCE)
  // 脚本声明的音质和搜索结果元数据对不上时，退回脚本声明的音质，仍然实测一遍
  const fallback = supportList.length ? supportList : sortQualitys(songQualitys)
  return (fallback.length ? fallback : ['320k', '128k'] as LX.Quality[]).slice(0, MAX_QUALITY_PER_SOURCE)
}

const getMusicUrlFromSource = async(source: LX.OnlineSource, musicInfo: LX.Music.MusicInfoOnline, quality: LX.Quality): Promise<string> => {
  const sdk = (musicSdk as unknown as Record<string, {
    getMusicUrl?: (songInfo: any, type: LX.Quality) => { promise: Promise<{ url?: string } | string>, canceleFn?: () => void, cancelHttp?: () => void }
  }>)[source]
  if (!sdk?.getMusicUrl) throw new Error('source not support getMusicUrl')
  const requestObj = sdk.getMusicUrl(toOldMusicInfo(musicInfo), quality)
  const result = await withTimeout(requestObj.promise, GET_URL_TIMEOUT, 'get music url timeout')
  const url = typeof result === 'string' ? result : result?.url
  if (!url) throw new Error('empty music url')
  return url
}

const checkOneSource = async(
  source: LX.OnlineSource,
  declaredQualitys: LX.Quality[],
  keyword: string,
  isCancelled: () => boolean,
  onPhase: (phase: SourceCheckPhase) => void,
): Promise<SourceCheckResult> => {
  const base: SourceCheckResult = {
    source,
    sourceName: getSourceName(source),
    status: 'checking',
    qualities: [],
  }

  onPhase('search')
  const sdk = (musicSdk as unknown as Record<string, {
    musicSearch?: { search?: (text: string, page: number, limit: number) => Promise<{ list: any[] }> }
  }>)[source]
  if (!sdk?.musicSearch?.search) {
    return { ...base, status: 'failed', error: '该音源不支持搜索' }
  }

  let searchResult: { list: any[] }
  try {
    searchResult = await withTimeout(sdk.musicSearch.search(keyword, 1, 10), SEARCH_TIMEOUT, 'search timeout')
  } catch (err: any) {
    log.error(`[sourceCheck] search ${source} failed:`, err?.message ?? err)
    return { ...base, status: 'failed', error: err?.message ?? 'search failed' }
  }
  if (isCancelled()) return { ...base, status: 'failed', error: 'cancelled' }

  const rawMusicInfo = searchResult?.list?.[0]
  if (!rawMusicInfo) return { ...base, status: 'failed', error: '没有搜索到探测歌曲' }

  const musicInfo = toNewMusicInfo(rawMusicInfo) as LX.Music.MusicInfoOnline
  const result: SourceCheckResult = {
    ...base,
    musicName: musicInfo.name,
    singer: musicInfo.singer,
  }
  const qualityChain = buildQualityChain(declaredQualitys, musicInfo)
  const duration = parseInterval(musicInfo.interval)

  for (const quality of qualityChain) {
    if (isCancelled()) {
      result.status = result.bestQuality ? 'ok' : 'failed'
      result.error = 'cancelled'
      return result
    }
    const startTime = Date.now()
    let url: string
    onPhase('get-url')
    try {
      url = await getMusicUrlFromSource(source, musicInfo, quality)
    } catch (err: any) {
      result.qualities.push({
        quality,
        ok: false,
        timeMs: Date.now() - startTime,
        error: err?.message ?? 'get music url failed',
      })
      continue
    }
    if (isCancelled()) return result

    onPhase('probe')
    const probe = await probeAudioUrl(url)
    const payload: SourceCheckQualityResult = {
      quality,
      ok: probe.ok,
      url,
      contentType: probe.contentType,
      contentLength: probe.contentLength,
      acceptRanges: probe.acceptRanges,
      timeMs: Date.now() - startTime,
      error: probe.ok ? undefined : (probe.error ?? `HTTP ${probe.statusCode ?? ''}`.trim()),
    }
    // 有 content-length + 歌曲时长时推断实际码率，可作为「脚本标称音质」的旁证
    if (probe.ok && probe.contentLength && duration > 0) {
      const bitrate = Math.round(probe.contentLength * 8 / duration / 1000)
      if (Number.isFinite(bitrate) && bitrate > 0) payload.bitrate = bitrate
    }
    result.qualities.push(payload)
    if (probe.ok && !result.bestQuality) {
      result.bestQuality = quality
      result.latencyMs = payload.timeMs
    }
    if (!probe.ok) {
      log.info(`[sourceCheck] ${source} ${quality} probe failed:`, payload.error)
    }
    // 已经拿到最高可用音质后，剩下的档位只是补充矩阵，可以稍微让一下网络
    await sleep(60)
  }

  if (isCancelled() && !result.bestQuality) {
    result.status = 'failed'
    result.error = 'cancelled'
    return result
  }
  if (result.bestQuality) {
    result.status = 'ok'
  } else {
    result.status = 'failed'
    result.error = result.qualities[result.qualities.length - 1]?.error ?? '所有音质均不可用'
  }
  return result
}

/**
 * 创建一次音源实测检测任务。
 *
 * ```ts
 * const task = createSourceCheckTask({ keyword: '晴天 周杰伦', onProgress })
 * task.cancel() // 需要时取消
 * const results = await task.promise
 * ```
 */
export const createSourceCheckTask = (options: SourceCheckOptions = {}): SourceCheckTask => {
  const keyword = (options.keyword ?? DEFAULT_CHECK_KEYWORD).trim() || DEFAULT_CHECK_KEYWORD
  const qualitys = options.qualitys ?? global.lx.qualityList ?? {}
  const declaredSources = options.sources ?? Object.keys(qualitys)
  const sources = declaredSources.filter(source => source !== 'local') as LX.OnlineSource[]

  const results: SourceCheckResult[] = sources.map(source => ({
    source,
    sourceName: getSourceName(source),
    status: 'pending',
    qualities: [],
  }))

  let cancelled = false
  let cursor = 0
  let finished = 0
  const current = new Set<string>()

  const emit = (phase: SourceCheckPhase) => {
    if (cancelled) return
    options.onProgress?.({
      total: sources.length,
      finished,
      phase,
      current: [...current],
      keyword,
    }, results.map(item => ({ ...item, qualities: [...item.qualities] })))
  }

  const promise = new Promise<SourceCheckResult[]>((resolve) => {
    if (!sources.length) {
      options.onProgress?.({ total: 0, finished: 0, phase: 'done', current: [], keyword }, [])
      resolve(results)
      return
    }
    emit('search')
    const worker = async() => {
      for (;;) {
        if (cancelled) return
        const index = cursor++
        if (index >= sources.length) return
        const source = sources[index]
        current.add(source)
        emit('search')
        const result = await checkOneSource(source, qualitys[source] ?? [], keyword, () => cancelled, phase => { emit(phase) })
          .catch((err: any): SourceCheckResult => ({
            source,
            sourceName: getSourceName(source),
            status: 'failed',
            qualities: [],
            error: err?.message ?? 'check failed',
          }))
        current.delete(source)
        finished++
        results[index] = result
        emit('done')
      }
    }
    void Promise.all(Array.from({ length: Math.min(SOURCE_CONCURRENCY, sources.length) }, async() => worker())).then(() => {
      emit('done')
      resolve(results)
    })
  })

  return {
    promise,
    cancel() {
      cancelled = true
      emit('done')
    },
  }
}

/**
 * 把检测结果格式化成可复制 / 写日志的纯文本
 */
export const formatSourceCheckResult = (results: SourceCheckResult[], keyword?: string): string => {
  const lines: string[] = []
  lines.push(`Emo 音源音乐质量检测${keyword ? `（探测歌曲：${keyword}）` : ''}`)
  lines.push(new Date().toLocaleString())
  for (const item of results) {
    const status = item.status === 'ok' ? '可用' : item.status === 'pending' ? '未检测' : '失败'
    const best = item.bestQuality ? `最高实测 ${item.bestQuality}${item.latencyMs != null ? ` / ${item.latencyMs}ms` : ''}` : ''
    lines.push(`\n[${item.sourceName}] ${status}${best ? ` · ${best}` : ''}${item.error ? ` · ${item.error}` : ''}`)
    if (item.musicName) lines.push(`  探测歌曲：${item.musicName} - ${item.singer ?? ''}`)
    for (const quality of item.qualities) {
      const detail = [
        quality.ok ? '可播放' : '不可用',
        quality.bitrate ? `约 ${quality.bitrate}kbps` : '',
        quality.contentType ?? '',
        quality.contentLength ? `${(quality.contentLength / 1024 / 1024).toFixed(2)}MB` : '',
        `${quality.timeMs}ms`,
        quality.error ?? '',
      ].filter(Boolean).join(' · ')
      lines.push(`  ${quality.quality}: ${detail}`)
    }
  }
  return lines.join('\n')
}
