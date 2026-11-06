import { getLocalMusicList } from '@/core/localMusic'
import { localLibraryRepository } from './repository'

/**
 * 身份切换预演（A2-07）。
 *
 * 用已回填的 tracks.fingerprint 生成 legacy_id → fp:<fingerprint> 映射，写入
 * id_map 表；不修改 tracks.id / 播放列表引用，等切读阶段再整体迁移。
 * 同一指纹对应多个 legacy_id 视为重复文件（碰撞），列出数量供归并决策。
 */

export interface IdMapPreview {
  tracks: number
  mapped: number
  missing: number
  collisions: number
  dbMapped: number
  durationMs: number
}

export const buildIdMapPreview = async(): Promise<IdMapPreview> => {
  const start = Date.now()
  const list = await getLocalMusicList()
  const rows = await localLibraryRepository.getFingerprintRows()
  const byFingerprint = new Map<string, string[]>()
  const entries = rows.map(row => {
    const group = byFingerprint.get(row.fingerprint)
    if (group) group.push(row.legacyId)
    else byFingerprint.set(row.fingerprint, [row.legacyId])
    return {
      legacyId: row.legacyId,
      newId: `fp:${row.fingerprint}`,
      fingerprint: row.fingerprint,
      kind: 'fingerprint',
    }
  })
  await localLibraryRepository.replaceIdMap(entries)
  const collisions = [...byFingerprint.values()].filter(group => group.length > 1).length
  return {
    tracks: list.length,
    mapped: entries.length,
    missing: Math.max(0, list.length - entries.length),
    collisions,
    dbMapped: await localLibraryRepository.getIdMapCount(),
    durationMs: Date.now() - start,
  }
}
