import { getMusicUrl } from '@/core/music'
import { getNextPlayMusicInfo, resetRandomNextMusicInfo } from '@/core/player/player'
import { checkUrl } from '@/utils/request'
import playerState from '@/store/player/state'
import { isCached } from '@/plugins/player/utils'

/**
 * 下一首 URL 预解析。
 *
 * 为什么需要：在线播放时「下一首」要等：取播放地址（可能还要换源/降级）→ 播放器起播。
 * 如果等当前歌快播完才开始解析，用户听到的就是几秒空白，点「下一首」同理。
 * 这里提前把下一首的 URL 解析好并写进 URL 缓存（getMusicUrl 内部会 saveMusicUrl），
 * 真正切歌时直接命中缓存，起播几乎无延迟。
 *
 * 触发时机（两处，互为兜底）：
 * 1. 切歌后延迟 3 秒预解析一次：早解析，用户手动点「下一首」也能瞬间起播；
 * 2. 播放进度进入最后 30 秒还没解析成功时再试（上一次可能因为网络抖动失败了）。
 *
 * 上一版只在最后 10 秒触发、且失败后 info 一直保留导致不再重试；
 * 现在有重试次数上限 + 失败退避，避免死循环和无谓请求。
 */

/** 提前多少秒开始兜底预解析 */
const PRELOAD_AHEAD_SECONDS = 30
/** 切歌后延迟多久开始预解析（避免刚起播时和音频流抢带宽） */
const PRELOAD_DELAY = 3000
/** 同一首歌最多尝试解析几次 */
const MAX_ATTEMPTS = 3
/** 两次解析尝试之间的最小间隔（进度兜底触发用） */
const RETRY_GAP = 8000

interface PreloadState {
  info: LX.Player.PlayMusicInfo | null
  url: string
  attempts: number
  loading: boolean
  lastAttemptAt: number
}

const preloadState: PreloadState = {
  info: null,
  url: '',
  attempts: 0,
  loading: false,
  lastAttemptAt: 0,
}

let delayTimer: ReturnType<typeof setTimeout> | null = null

const clearDelayTimer = () => {
  if (delayTimer) {
    clearTimeout(delayTimer)
    delayTimer = null
  }
}

const resetPreloadInfo = () => {
  clearDelayTimer()
  preloadState.info = null
  preloadState.url = ''
  preloadState.attempts = 0
  preloadState.lastAttemptAt = 0
}

/**
 * 解析下一首播放地址。
 * @param force 进度兜底触发时允许在已有结果后重新解析（例如 URL 已经过期）
 */
const preloadNextMusicUrl = async(force = false): Promise<void> => {
  if (preloadState.loading) return
  if (preloadState.attempts >= MAX_ATTEMPTS && !force) return
  const now = Date.now()
  if (!force && now - preloadState.lastAttemptAt < RETRY_GAP) return

  preloadState.loading = true
  preloadState.lastAttemptAt = now
  try {
    // 下一首信息只取一次：随机模式下反复调用会打乱「下一首」的随机结果
    const info = preloadState.info ?? await getNextPlayMusicInfo()
    if (!info) return
    preloadState.info = info
    preloadState.attempts++

    let url = await getMusicUrl({ musicInfo: info.musicInfo }).catch(() => '')
    // 只有网络地址才需要验证：本地文件路径做 HEAD 请求必然失败，白白多一次请求
    if (url && /^https?:/i.test(url)) {
      // 只验证「缓存里有没有 / 地址还能不能用」，验证失败就强制刷新一次地址
      const [cached, available] = await Promise.all([
        isCached(url).catch(() => false),
        checkUrl(url).then(() => true).catch(() => false),
      ])
      if (!cached && !available) {
        url = await getMusicUrl({ musicInfo: info.musicInfo, isRefresh: true }).catch(() => '')
      }
    }
    preloadState.url = url
    if (url) clearDelayTimer()
  } finally {
    preloadState.loading = false
  }
}

export default () => {
  const schedulePreload = () => {
    clearDelayTimer()
    delayTimer = setTimeout(() => {
      delayTimer = null
      void preloadNextMusicUrl()
    }, PRELOAD_DELAY)
  }

  const handleSetPlayInfo = () => {
    resetPreloadInfo()
    schedulePreload()
  }

  const handleConfigUpdated: typeof global.state_event.configUpdated = (keys) => {
    if (!keys.includes('player.togglePlayMethod')) return
    // 播放模式变了，之前缓存的「下一首」可能已经不对，重新随机/预解析
    if (!preloadState.info || preloadState.info.isTempPlay) return
    resetRandomNextMusicInfo()
    resetPreloadInfo()
    schedulePreload()
  }

  const handlePlayProgressChanged: typeof global.state_event.playProgressChanged = (progress) => {
    const duration = progress.maxPlayTime
    if (duration <= 10) return
    if (duration - progress.nowPlayTime > PRELOAD_AHEAD_SECONDS) return
    // 已经有解析好的地址就不要再请求
    if (preloadState.url) return
    if (preloadState.attempts >= MAX_ATTEMPTS) return
    void preloadNextMusicUrl()
  }

  global.app_event.on('musicToggled', handleSetPlayInfo)
  global.state_event.on('configUpdated', handleConfigUpdated)
  global.state_event.on('playProgressChanged', handlePlayProgressChanged)

  // 冷启动恢复播放时可能不会触发 musicToggled，进入页面后先排一次
  if (playerState.playMusicInfo.musicInfo) schedulePreload()
}
