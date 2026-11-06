/**
 * 本地格式能力标记（W3 / D-12）。
 *
 * 当前播放内核（ExoPlayer）对 APE / WMA / DSD(DSF/DFF) 支持不完整，
 * 先按扩展名给出「可能不支持」提示；真正播放失败时仍交给播放器错误兜底。
 * 这是提示，不阻止用户尝试播放。
 */
const LIKELY_UNSUPPORTED = new Set(['ape', 'wma', 'dsf', 'dff'])

export const isLikelyUnsupportedLocal = (item: LX.Music.MusicInfoLocal): boolean => {
  const ext = (item.meta.ext ?? item.meta.filePath.split('.').pop() ?? '').toLowerCase()
  return LIKELY_UNSUPPORTED.has(ext)
}
