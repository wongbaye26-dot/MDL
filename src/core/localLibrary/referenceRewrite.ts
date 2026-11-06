import { getListMusics, getUserLists } from '@/core/list'
import { LIST_IDS } from '@/config/constant'
import { localLibraryRepository } from './repository'

/**
 * 引用改写预演（A2-07/切读前门禁）。
 *
 * 用 id_map 把收藏 / 默认列表 / 用户歌单里的 legacy id 映射为 fp id，
 * 只统计会替换多少条、是否出现重复引用，不写回任何列表。
 */

export interface ListRewritePreview {
  listId: string
  name: string
  total: number
  local: number
  mapped: number
  conflicts: number
}

export interface ReferenceRewritePreview {
  lists: ListRewritePreview[]
  mappedTotal: number
  conflictsTotal: number
  durationMs: number
}

export const previewReferenceRewrite = async(): Promise<ReferenceRewritePreview> => {
  const start = Date.now()
  const idMap = await localLibraryRepository.getIdMapEntries()
  const map = new Map(idMap.map(entry => [entry.legacyId, entry.newId]))
  const userLists = await getUserLists().catch(() => [])
  const playlists = [
    { id: LIST_IDS.LOVE, name: '我的收藏' },
    { id: LIST_IDS.DEFAULT, name: '默认列表' },
    ...userLists.map(list => ({ id: list.id, name: list.name })),
  ]
  const lists: ListRewritePreview[] = []
  let mappedTotal = 0
  let conflictsTotal = 0
  for (const playlist of playlists) {
    const musics = await getListMusics(playlist.id).catch(() => [])
    let local = 0
    let mapped = 0
    let conflicts = 0
    const mappedIds = new Set<string>()
    for (const music of musics) {
      if (!('meta' in music) || !music.meta || typeof music.meta !== 'object') continue
      local += 1
      const newId = map.get(music.id)
      if (!newId) continue
      mapped += 1
      if (mappedIds.has(newId)) conflicts += 1
      else mappedIds.add(newId)
    }
    mappedTotal += mapped
    conflictsTotal += conflicts
    lists.push({ listId: playlist.id, name: playlist.name, total: musics.length, local, mapped, conflicts })
  }
  return { lists, mappedTotal, conflictsTotal, durationMs: Date.now() - start }
}
