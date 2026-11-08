import { getData, saveData } from '@/plugins/storage'
import { localLibraryRepository } from './repository'
import { mapRowToLocalTrack } from './mapTrack'

/**
 * 切读 R0（A2-07）：读源开关与 JSON/DB 双读对比。
 *
 * R1 起默认读 SQLite（repository）；DB 为空时自动回退 JSON，
 * 保留 `json` 开关用于回滚。DB 行的 id 当前仍是 legacy id，
 * 因此切换读源不会改变播放/收藏引用。
 */

const KEY = 'local_library_read_source_v1'

export type ReadSource = 'json' | 'repository'

export const getReadSource = async(): Promise<ReadSource> => {
  // 曲库写入权威源是 JSON；SQLite 仅作影子/自检，必须显式 setReadSource('repository')
  // 才会切过去。避免默认读到缺列/滞后的 DB，导致刮削字段“写完消失”。
  const value = await getData<ReadSource>(KEY).catch(() => null)
  return value === 'repository' ? 'repository' : 'json'
}

export const setReadSource = async(source: ReadSource): Promise<void> => {
  await saveData(KEY, source)
}

export const readLibraryFromRepository = async(limit = 10000): Promise<LX.Music.MusicInfoLocal[]> => {
  const rows = await localLibraryRepository.getTracks(limit, 0)
  return rows.map(mapRowToLocalTrack)
}

export interface ReadSourceCompare {
  jsonCount: number
  dbCount: number
  onlyJson: number
  onlyDb: number
  fieldDiffs: number
  durationMs: number
}

/** 对比旧 JSON 与 DB 映射后的曲库（按 id、歌名、歌手、路径、时长） */
export const compareReadSources = async(jsonList: LX.Music.MusicInfoLocal[]): Promise<ReadSourceCompare> => {
  const start = Date.now()
  const dbList = await readLibraryFromRepository(jsonList.length + 1000)
  const dbById = new Map(dbList.map(item => [item.id, item]))
  const jsonIds = new Set(jsonList.map(item => item.id))
  let onlyJson = 0
  let fieldDiffs = 0
  for (const item of jsonList) {
    const dbItem = dbById.get(item.id)
    if (!dbItem) { onlyJson += 1; continue }
    if (
      dbItem.name !== item.name ||
      dbItem.singer !== (item.singer ?? '') ||
      dbItem.meta.filePath !== item.meta.filePath ||
      dbItem.interval !== item.interval
    ) fieldDiffs += 1
  }
  const onlyDb = dbList.filter(item => !jsonIds.has(item.id)).length
  return {
    jsonCount: jsonList.length,
    dbCount: dbList.length,
    onlyJson,
    onlyDb,
    fieldDiffs,
    durationMs: Date.now() - start,
  }
}
