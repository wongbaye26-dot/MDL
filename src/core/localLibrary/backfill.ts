import { resolveTrackIdentity } from './identity'
import { localLibraryRepository } from './repository'

/**
 * 指纹回填（A2-06/A2-07）。
 *
 * 对当前曲库逐首采样头/尾 64KB 算指纹，写回 tracks.fingerprint；
 * 暂不改 id（切读阶段再做 legacy→fp 迁移），只用于验证身份模型与差异归并。
 */

export interface BackfillResult {
  total: number
  fingerprint: number
  media: number
  legacy: number
  failed: number
  durationMs: number
}

export const backfillIdentities = async(
  list: LX.Music.MusicInfoLocal[],
  isAlive: () => boolean = () => true,
): Promise<BackfillResult> => {
  const start = Date.now()
  let fingerprint = 0
  let media = 0
  let legacy = 0
  let failed = 0
  for (const item of list) {
    if (!isAlive()) break
    try {
      const identity = await resolveTrackIdentity(item)
      if (identity.kind === 'fingerprint' && identity.fingerprint) {
        await localLibraryRepository.updateTrackFingerprint(item.id, identity.fingerprint)
        fingerprint += 1
      } else if (identity.kind === 'media') {
        media += 1
      } else {
        legacy += 1
      }
    } catch {
      failed += 1
    }
  }
  return { total: list.length, fingerprint, media, legacy, failed, durationMs: Date.now() - start }
}
