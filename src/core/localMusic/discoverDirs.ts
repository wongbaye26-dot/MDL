/**
 * 自动识别「有音乐的文件夹」。
 *
 * 新手引导 / 目录弹窗里用：不想一个个翻文件夹的用户，可以直接扫描手机存储，
 * 把「里面有音频文件」的目录列出来勾选。只做目录级探测，不读标签，速度可控。
 */
import { extname, externalStorageDirectoryPath, readDir } from '@/utils/fs'

const AUDIO_EXT = new Set(['mp3', 'flac', 'm4a', 'aac', 'wav', 'ogg', 'ape', 'wma', 'opus', 'dsf', 'dff'])

/** 这些系统相册/图片目录里几乎没有音乐，跳过省时间（用户自己的音乐目录不受影响） */
const SKIP_ROOT_NAMES = new Set(['Android', 'DCIM', 'Pictures', 'Movies', 'Ringtones', 'Notifications', 'Alarms'])
/** 最多往下看几层 */
const MAX_DEPTH = 5
/** 最多访问多少个目录项，避免极端情况下长时间占用 */
const MAX_ENTRIES = 30000
/** 最多返回多少个候选目录 */
const MAX_RESULT = 60

export interface FoundMusicDir {
  path: string
  name: string
  /** 该目录下（不含子目录）的音频文件数 */
  count: number
  /** 该目录下音频文件总大小（字节） */
  size: number
}

interface Entry {
  name: string
  path: string
  isDirectory?: boolean
  isFile?: boolean
  size?: number
}

const isAudio = (name: string) => AUDIO_EXT.has(extname(name).toLowerCase())

const isEmptyDirName = (name: string) => !name || name.startsWith('.')

/**
 * 扫描存储，找出直接包含音频文件的目录。
 *
 * @param onProgress 已访问的条目数回调（用于界面上的「正在扫描…」）
 */
export const discoverMusicDirs = async(options: {
  roots?: string[]
  onProgress?: (visited: number) => void
} = {}): Promise<FoundMusicDir[]> => {
  const roots = options.roots ?? [externalStorageDirectoryPath]
  const found: FoundMusicDir[] = []
  let visited = 0
  let stopped = false

  const notify = (() => {
    let last = 0
    return (force = false) => {
      const now = Date.now()
      if (!force && now - last < 120) return
      last = now
      options.onProgress?.(visited)
    }
  })()

  const walk = async(dir: string, depth: number, isRoot = false) => {
    if (stopped || depth > MAX_DEPTH) return
    let entries: Entry[]
    try {
      entries = await readDir(dir) as unknown as Entry[]
    } catch {
      return
    }
    let count = 0
    let size = 0
    const subDirs: string[] = []
    for (const entry of entries) {
      visited += 1
      if (visited % 40 === 0) notify()
      if (visited > MAX_ENTRIES) {
        stopped = true
        return
      }
      const name = entry.name ?? ''
      if (isEmptyDirName(name)) continue
      if (entry.isDirectory) {
        if (isRoot && SKIP_ROOT_NAMES.has(name)) continue
        subDirs.push(entry.path)
        continue
      }
      if (isAudio(name)) {
        count += 1
        size += entry.size ?? 0
      }
    }
    if (count > 0) {
      const name = dir.split('/').filter(Boolean).pop() ?? dir
      found.push({ path: dir, name, count, size })
    }
    for (const sub of subDirs) {
      if (stopped) return
      await walk(sub, depth + 1)
    }
  }

  for (const root of roots) {
    if (stopped) break
    await walk(root, 0, true)
  }
  notify(true)

  return found
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
    .slice(0, MAX_RESULT)
}
