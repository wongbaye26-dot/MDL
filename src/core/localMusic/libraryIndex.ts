import { useEffect, useMemo, useRef } from 'react'
import { getData, saveData } from '@/plugins/storage'

/**
 * 本地曲库的派生索引（W1 / D-01）。
 *
 * 目标：把「专辑 / 艺人 / 文件夹 / 最近添加」这些每次渲染都重新 reduce 的分组，
 * 收敛成一份可缓存的纯数据；页面只按 id 取歌，不再各自扫描全量列表。
 *
 * 约束：
 *  - 不改 `MusicInfoLocal.id`（仍是 `local_${filePath}`），队列/收藏/歌单引用不动；
 *  - 只读派生，不写曲库；所有 key 归一化后合并大小写/空格/括号差异；
 *  - 索引可随时删除重建，持久化只用于冷启动快速出首屏。
 */

const INDEX_KEY = 'local_music_index_v1'

export interface LocalAlbumIndexItem {
  key: string
  name: string
  /** 出现最多的歌手（用于副标题） */
  singer: string
  songIds: string[]
  count: number
  totalSeconds: number
  coverId?: string
}

export interface LocalArtistIndexItem {
  key: string
  name: string
  songIds: string[]
  count: number
  totalSeconds: number
  coverId?: string
}

export interface LocalFolderIndexItem {
  key: string
  path: string
  name: string
  songIds: string[]
  count: number
  totalSize: number
  coverId?: string
}

export interface LocalLibraryIndex {
  version: 1
  builtAt: number
  trackCount: number
  totalSeconds: number
  albums: Record<string, LocalAlbumIndexItem>
  artists: Record<string, LocalArtistIndexItem>
  folders: Record<string, LocalFolderIndexItem>
  /** 最近添加（mtime 倒序）的歌曲 id */
  recentIds: string[]
}

/** key 归一化：去首尾空格、折叠空格、去掉常见包裹/分隔噪音、小写 */
export const normalizeGroupKey = (text?: string | null) => (text ?? '')
  .trim()
  .toLowerCase()
  .replace(/[\s]+/g, ' ')
  .replace(/[【】[\]()（）《》<>]/g, '')
  .trim()

/** 艺人字段拆分：A/B、A、B、A & B、A feat. B 都拆成多个艺人 */
export const splitArtists = (singer?: string | null) => {
  const parts = (singer ?? '')
    .split(/[/、,&]|\sfeat\.?\s|\sft\.?\s/i)
    .map(part => part.trim())
    .filter(Boolean)
  return parts.length ? parts : ['未知歌手']
}

const secondsOfInterval = (interval?: string | null) => {
  if (!interval) return 0
  const parts = interval.split(':').map(part => Number.parseInt(part, 10))
  if (!parts.length || parts.some(Number.isNaN)) return 0
  let seconds = 0
  for (const part of parts) seconds = seconds * 60 + part
  return seconds
}

const parentOf = (path: string) => {
  const index = path.lastIndexOf('/')
  return index <= 0 ? '/' : path.slice(0, index)
}

const baseNameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1) || path

interface AlbumBuilder {
  item: LocalAlbumIndexItem
  singerCount: Map<string, number>
}

interface ArtistBuilder {
  item: LocalArtistIndexItem
}

/** 从完整曲库构建索引（纯函数，可直接单测） */
export const buildLibraryIndex = (list: LX.Music.MusicInfoLocal[]): LocalLibraryIndex => {
  const albums = new Map<string, AlbumBuilder>()
  const artists = new Map<string, ArtistBuilder>()
  const folders = new Map<string, LocalFolderIndexItem>()
  let totalSeconds = 0

  for (const item of list) {
    const duration = secondsOfInterval(item.interval)
    totalSeconds += duration
    const picUrl = item.meta.picUrl ?? undefined

    /* 专辑：按专辑名归一化合并；同名不同歌手视为同一张（当前数据没有 albumArtist 字段） */
    const albumName = (item.meta.albumName ?? '').trim() || '未知专辑'
    const albumKey = normalizeGroupKey(albumName)
    let album = albums.get(albumKey)
    if (!album) {
      album = {
        item: {
          key: albumKey,
          name: albumName,
          singer: (item.singer ?? '').trim(),
          songIds: [],
          count: 0,
          totalSeconds: 0,
          coverId: undefined,
        },
        singerCount: new Map(),
      }
      albums.set(albumKey, album)
    }
    album.item.songIds.push(item.id)
    album.item.count += 1
    album.item.totalSeconds += duration
    if (!album.item.coverId && picUrl) album.item.coverId = item.id
    if (item.singer) album.singerCount.set(item.singer, (album.singerCount.get(item.singer) ?? 0) + 1)

    /* 艺人：多歌手拆开，每人都能在这首歌下被找到 */
    for (const artistName of splitArtists(item.singer)) {
      const artistKey = normalizeGroupKey(artistName) || '未知歌手'
      let artist = artists.get(artistKey)
      if (!artist) {
        artist = {
          item: {
            key: artistKey,
            name: artistName,
            songIds: [],
            count: 0,
            totalSeconds: 0,
            coverId: undefined,
          },
        }
        artists.set(artistKey, artist)
      }
      artist.item.songIds.push(item.id)
      artist.item.count += 1
      artist.item.totalSeconds += duration
      if (!artist.item.coverId && picUrl) artist.item.coverId = item.id
    }

    /* 文件夹：按直接父目录聚合 */
    const folderPath = parentOf(item.meta.filePath)
    let folder = folders.get(folderPath)
    if (!folder) {
      folder = {
        key: folderPath,
        path: folderPath,
        name: baseNameOf(folderPath),
        songIds: [],
        count: 0,
        totalSize: 0,
        coverId: undefined,
      }
      folders.set(folderPath, folder)
    }
    folder.songIds.push(item.id)
    folder.count += 1
    folder.totalSize += (item.meta as LX.Music.MusicInfoMeta_local & { size?: number }).size ?? 0
    if (!folder.coverId && picUrl) folder.coverId = item.id
  }

  /* 专辑副标题取出现最多的歌手 */
  for (const album of albums.values()) {
    let bestSinger = ''
    let bestCount = 0
    for (const [singer, count] of album.singerCount) {
      if (count > bestCount) {
        bestCount = count
        bestSinger = singer
      }
    }
    if (bestSinger) album.item.singer = bestSinger
  }

  const recentIds = [...list]
    .sort((a, b) => (b.meta.mtime ?? 0) - (a.meta.mtime ?? 0))
    .slice(0, 500)
    .map(item => item.id)

  return {
    version: 1,
    builtAt: Date.now(),
    trackCount: list.length,
    totalSeconds,
    albums: Object.fromEntries([...albums].map(([key, value]) => [key, value.item])),
    artists: Object.fromEntries([...artists].map(([key, value]) => [key, value.item])),
    folders: Object.fromEntries(folders),
    recentIds,
  }
}

/** 读持久化索引（只用于快速出首屏，页面仍会后台重建） */
export const loadLibraryIndexCache = async(): Promise<LocalLibraryIndex | null> => {
  try {
    const data = await getData<LocalLibraryIndex>(INDEX_KEY)
    if (!data || data.version !== 1 || !Array.isArray(data.recentIds)) return null
    return data
  } catch {
    return null
  }
}

export const saveLibraryIndexCache = async(index: LocalLibraryIndex): Promise<void> => {
  try {
    await saveData(INDEX_KEY, index)
  } catch {}
}

export const clearLibraryIndexCache = async(): Promise<void> => {
  try {
    await saveData(INDEX_KEY, null)
  } catch {}
}

/**
 * 页面用 hook：随曲库数组变化重建索引，并 debounce 落盘。
 * 构建是纯同步的，10k 首在单帧内完成；后续若超预算再按 200 首分片。
 */
export const useLocalLibraryIndex = (list: LX.Music.MusicInfoLocal[]): LocalLibraryIndex => {
  const index = useMemo(() => buildLibraryIndex(list), [list])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      void saveLibraryIndexCache(index)
    }, 2000)
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
    }
  }, [index])

  return index
}
