import { getData, saveData } from '@/plugins/storage'
import { LIST_IDS } from '@/config/constant'
import { getListMusics, getUserLists, overwriteListMusics } from '@/core/list'
import { getLocalMusicList, rewriteLocalMusicIds } from '@/core/localMusic'
import { localLibraryRepository } from './repository'
import { buildIdMapPreview } from './identitySwitch'
import { backfillIdentities } from './backfill'
import { createLibraryBackup } from './backup'

/**
 * A-3 tracks.id 主键迁移：legacy id → fp:<fingerprint>。
 *
 * 约束：
 * - 先备份旧 JSON；迁移可反向调用回滚；
 * - 只处理 id_map 中已回填指纹的曲目；
 * - 收藏/默认列表/用户歌单/@play_info 引用同步改写；
 * - 冲突（fp id 已存在）跳过并计数，不覆盖已有行。
 */

export interface IdListPreview {
  listId: string
  name: string
  total: number
  mapped: number
  conflicts: number
}

export interface IdMigrationPreview {
  tracks: number
  mapEntries: number
  localMapped: number
  lists: IdListPreview[]
  mappedTotal: number
  conflictsTotal: number
  durationMs: number
}

const buildMap = async(): Promise<Map<string, string>> => {
  let entries = await localLibraryRepository.getIdMapEntries()
  if (!entries.length) {
    // 断电/回滚演练会清空 DB，指纹与 id_map 需要先重建
    await backfillIdentities(await getLocalMusicList())
    await buildIdMapPreview()
    entries = await localLibraryRepository.getIdMapEntries()
  }
  return new Map(entries.map(entry => [entry.legacyId, entry.newId]))
}

const listDefs = async(): Promise<Array<{ id: string, name: string }>> => {
  const userLists = await getUserLists().catch(() => [])
  return [
    { id: LIST_IDS.LOVE, name: '我的收藏' },
    { id: LIST_IDS.DEFAULT, name: '默认列表' },
    ...userLists.map(list => ({ id: list.id, name: list.name })),
  ]
}

const rewriteLists = async(map: Map<string, string>): Promise<IdListPreview[]> => {
  const result: IdListPreview[] = []
  for (const def of await listDefs()) {
    const musics = await getListMusics(def.id).catch(() => [])
    let mapped = 0
    let conflicts = 0
    const seen = new Set<string>()
    const next = musics.map(music => {
      const newId = map.get(music.id)
      if (!newId || newId === music.id) return music
      mapped += 1
      if (seen.has(newId)) conflicts += 1
      else seen.add(newId)
      return { ...music, id: newId }
    })
    if (mapped) await overwriteListMusics(def.id, next).catch(() => {})
    result.push({ listId: def.id, name: def.name, total: musics.length, mapped, conflicts })
  }
  return result
}

const playableLocal = (music: LX.Music.MusicInfo): boolean => 'meta' in music && !!music.meta && typeof music.meta === 'object'

export const previewIdMigration = async(): Promise<IdMigrationPreview> => {
  const start = Date.now()
  const list = await getLocalMusicList()
  const map = await buildMap()
  const localMapped = list.filter(item => map.has(item.id)).length
  const lists: IdListPreview[] = []
  let mappedTotal = 0
  let conflictsTotal = 0
  for (const def of await listDefs()) {
    const musics = await getListMusics(def.id).catch(() => [])
    let mapped = 0
    let conflicts = 0
    const seen = new Set<string>()
    for (const music of musics) {
      if (!playableLocal(music)) continue
      const newId = map.get(music.id)
      if (!newId) continue
      mapped += 1
      if (seen.has(newId)) conflicts += 1
      else seen.add(newId)
    }
    mappedTotal += mapped
    conflictsTotal += conflicts
    lists.push({ listId: def.id, name: def.name, total: musics.length, mapped, conflicts })
  }
  return {
    tracks: list.length,
    mapEntries: map.size,
    localMapped,
    lists,
    mappedTotal,
    conflictsTotal,
    durationMs: Date.now() - start,
  }
}

export interface IdMigrationResult {
  ok: boolean
  backupTracks: number
  tracksUpdated: number
  conflicts: number
  localUpdated: number
  lists: IdListPreview[]
  playInfoUpdated: boolean
  durationMs: number
  error?: string
}

export const applyIdMigration = async(): Promise<IdMigrationResult> => {
  const start = Date.now()
  try {
    const backup = await createLibraryBackup()
    const map = await buildMap()
    const dbResult = await localLibraryRepository.migrateTrackIds([...map.entries()])
    const localUpdated = await rewriteLocalMusicIds(map)
    const lists = await rewriteLists(map)
    let playInfoUpdated = false
    const playInfo = await getData<{ music?: { id?: string }, listId?: string }>('@play_info').catch(() => null)
    if (playInfo?.music?.id) {
      const newId = map.get(playInfo.music.id)
      if (newId) {
        playInfo.music = { ...playInfo.music, id: newId }
        await saveData('@play_info', playInfo)
        playInfoUpdated = true
      }
    }
    return {
      ok: true,
      backupTracks: backup.tracks,
      tracksUpdated: dbResult.updated,
      conflicts: dbResult.conflicts,
      localUpdated,
      lists,
      playInfoUpdated,
      durationMs: Date.now() - start,
    }
  } catch (error) {
    return {
      ok: false,
      backupTracks: 0,
      tracksUpdated: 0,
      conflicts: 0,
      localUpdated: 0,
      lists: [],
      playInfoUpdated: false,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'ID 迁移失败',
    }
  }
}

export const rollbackIdMigration = async(): Promise<IdMigrationResult> => {
  const start = Date.now()
  try {
    const entries = await localLibraryRepository.getIdMapEntries()
    const reverse = new Map(entries.map(entry => [entry.newId, entry.legacyId]))
    const dbResult = await localLibraryRepository.migrateTrackIds([...reverse.entries()])
    const localUpdated = await rewriteLocalMusicIds(reverse)
    const lists = await rewriteLists(reverse)
    let playInfoUpdated = false
    const playInfo = await getData<{ music?: { id?: string }, listId?: string }>('@play_info').catch(() => null)
    if (playInfo?.music?.id) {
      const oldId = reverse.get(playInfo.music.id)
      if (oldId) {
        playInfo.music = { ...playInfo.music, id: oldId }
        await saveData('@play_info', playInfo)
        playInfoUpdated = true
      }
    }
    return {
      ok: true,
      backupTracks: 0,
      tracksUpdated: dbResult.updated,
      conflicts: dbResult.conflicts,
      localUpdated,
      lists,
      playInfoUpdated,
      durationMs: Date.now() - start,
    }
  } catch (error) {
    return {
      ok: false,
      backupTracks: 0,
      tracksUpdated: 0,
      conflicts: 0,
      localUpdated: 0,
      lists: [],
      playInfoUpdated: false,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'ID 回滚失败',
    }
  }
}
