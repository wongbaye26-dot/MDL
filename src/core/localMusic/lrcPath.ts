/**
 * 同名 .lrc 路径推导（D-18，纯函数，便于单测）。
 *
 * - content:// 文档 uri 无法直接拼同目录路径，返回 null；
 * - 普通路径把最后一个扩展名替换成 `.lrc`；
 * - 没有扩展名时直接追加 `.lrc`；
 * - 查询串/片段（少见）先剥掉，避免生成 `a.flac?x=.lrc`。
 */
export const getSidecarLrcPath = (filePath: string): string | null => {
  if (!filePath || filePath.startsWith('content://')) return null
  const clean = filePath.split(/[?#]/)[0]
  if (!clean) return null
  const slash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'))
  const dot = clean.lastIndexOf('.')
  if (dot > slash + 1) return `${clean.slice(0, dot)}.lrc`
  return `${clean}.lrc`
}
