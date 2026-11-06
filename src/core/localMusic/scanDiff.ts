/**
 * 增量扫描的可复用判定（W1 / D-03，纯函数，便于单测）。
 *
 * 复用条件：路径相同（由调用方按 path 分组）+ 新旧 mtime 都是有效值且一致 +
 * 文件大小一致。mtime 缺失/为 0 时保守地重新读标签，避免旧数据被错误复用。
 */
export interface ScannableFile {
  path: string
  mtime?: number | Date | null
  size?: number
}

export interface PreviousIndexItem {
  meta: {
    mtime?: number
    size?: number
  }
}

/** 统一把 mtime 归一化成毫秒时间戳；无法识别返回 0 */
export const toMtimeMs = (mtime?: number | Date | null): number => {
  if (typeof mtime === 'number' && Number.isFinite(mtime)) return mtime
  if (mtime instanceof Date) return mtime.getTime()
  return 0
}

/** 当前扫描文件能否直接复用曲库里的旧条目 */
export const canReuseScannedFile = (
  prev: PreviousIndexItem | undefined,
  file: ScannableFile,
): boolean => {
  if (!prev) return false
  const fileMtime = toMtimeMs(file.mtime)
  const prevMtime = prev.meta.mtime ?? 0
  if (fileMtime <= 0 || prevMtime <= 0) return false
  if (fileMtime !== prevMtime) return false
  return (file.size ?? 0) === (prev.meta.size ?? 0)
}
