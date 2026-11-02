/**
 * 排行榜「当前榜单」的紧凑卡片数据。
 *
 * 排行榜的标题栏在 `PageModal` 里，而榜单数据（名字/播放全部/下载）在 `Leaderboard` 内部，
 * 中间隔了几层 —— 和之前的多选栏一样，用一份模块级状态把它们连起来：
 * `Leaderboard` 写入，`PageModal` 标题右侧的 `CompactHero` 读取。
 */

interface LeaderboardHeroState {
  name: string
  meta: string
  onPlayAll?: () => void
  onDownloadAll?: () => void
}

let state: LeaderboardHeroState = { name: '', meta: '' }
const listeners = new Set<() => void>()

const emit = () => {
  for (const listener of listeners) listener()
}

export const getLeaderboardHero = () => state

export const subscribeLeaderboardHero = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const setLeaderboardHero = (next: LeaderboardHeroState) => {
  // 回调和文案都没变就不触发重渲染
  if (
    next.name === state.name &&
    next.meta === state.meta &&
    next.onPlayAll === state.onPlayAll &&
    next.onDownloadAll === state.onDownloadAll
  ) return
  state = next
  emit()
}

export const resetLeaderboardHero = () => {
  state = { name: '', meta: '' }
  emit()
}
