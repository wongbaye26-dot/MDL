import { readFileChunk, stat } from '@/utils/fs'
import { buildFingerprint } from './fingerprintCore'

/**
 * 曲目身份模型（A2-06）。
 *
 * 目标：移动/重命名文件后仍能认出同一首，不再以路径为主键。
 * 指纹 = 文件大小 + 时长 + 头/尾各 64KB 采样内容的 FNV 哈希。
 * - 头尾采样足以区分绝大多数音频（同专辑同码率不同歌的头/尾不同）；
 * - content:// 无法采样时回退 MediaStore id；再不行回退旧 id（标记待归并）。
 */

const SAMPLE_BYTES = 64 * 1024

export { hashString, buildFingerprint, type FingerprintInput } from './fingerprintCore'

export interface TrackIdentity {
  id: string
  kind: 'fingerprint' | 'media' | 'legacy'
  fingerprint?: string
  mediaId?: string
  legacyId?: string
}

/** 从文件采样计算指纹；失败返回 null（调用方回退 media/legacy） */
export const computeFileFingerprint = async(
  filePath: string,
  durationMs: number,
  sizeHint?: number,
): Promise<string | null> => {
  if (!filePath || filePath.startsWith('content://')) return null
  try {
    const info = await stat(filePath)
    const size = sizeHint ?? (info as { size?: number }).size ?? 0
    if (!size) return null
    const head = await readFileChunk(filePath, Math.min(SAMPLE_BYTES, size), 0)
    const tailPosition = Math.max(0, size - SAMPLE_BYTES)
    const tail = await readFileChunk(filePath, Math.min(SAMPLE_BYTES, size), tailPosition)
    return buildFingerprint({ size, durationMs, head, tail })
  } catch {
    return null
  }
}

export const resolveTrackIdentity = async(item: {
  id: string
  interval?: string | null
  meta: { filePath: string, size?: number, contentUri?: string | null, songId?: string | number | null }
}): Promise<TrackIdentity> => {
  const durationMs = parseInterval(item.interval)
  const fingerprint = await computeFileFingerprint(item.meta.filePath, durationMs, item.meta.size)
  if (fingerprint) return { id: fingerprint, kind: 'fingerprint', fingerprint, legacyId: item.id }
  const mediaId = item.meta.contentUri ?? item.meta.songId
  if (mediaId != null) {
    const id = `media:${String(mediaId)}`
    return { id, kind: 'media', mediaId: String(mediaId), legacyId: item.id }
  }
  return { id: item.id, kind: 'legacy', legacyId: item.id }
}

const parseInterval = (interval?: string | null): number => {
  if (!interval) return 0
  const parts = interval.split(':').map(part => Number.parseInt(part, 10))
  if (!parts.length || parts.some(Number.isNaN)) return 0
  let seconds = 0
  for (const part of parts) seconds = seconds * 60 + part
  return seconds * 1000
}
