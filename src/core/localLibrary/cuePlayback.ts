/** CUE 分段播放的纯计算（A2-09），供播放器起播 seek 与段末切段使用 */

export interface CueMeta {
  cueStartMs?: number
  cueEndMs?: number
}

/** 起播秒数：仅当存在 cueStartMs 且当前没有恢复进度时使用 */
export const getCueStartSeconds = (meta: CueMeta | undefined, currentSeconds: number): number => {
  if (meta?.cueStartMs == null || meta.cueStartMs < 0) return currentSeconds
  return currentSeconds > 0 ? currentSeconds : meta.cueStartMs / 1000
}

/** 是否已经到段末（留 250ms 提前量，避免最后一帧被截掉） */
export const shouldAdvanceCue = (meta: CueMeta | undefined, positionMs: number): boolean => {
  if (meta?.cueEndMs == null || meta.cueEndMs <= 0) return false
  return positionMs >= meta.cueEndMs - 250
}
