import { existsFile } from '@/utils/fs'
import { getLocalMusicList } from '@/core/localMusic'
import { isCoverUsable, readEmbeddedCover } from '@/core/localMusic/cover'
import { getTagIssues, type TagIncompleteItem } from '@/core/localMusic/scrape'

/**
 * 曲库体检：一次扫描算出音乐工具各个区块要用的全部数字与待处理列表。
 *
 * 为什么不各区块自己扫：
 * 233 首歌每首都去抽内嵌封面/读文件，分开扫就是 2~3 遍重复 IO；而且页面一进来
 * 就想看到总览（歌曲数/大小/缺封面/缺歌词/无效条目）。这里只扫一遍、统一进度，
 * 各区块直接消费结果，点「修复/刮削/补歌词/移除」后由父组件触发重扫。
 *
 * 性能：**扫描只读，不写曲库**。上一版扫描时会把抽到的封面逐首写回
 * （每首一次 localMusicUpdated），233 首会触发几百次列表重渲染。现在改成
 * 只记录「文件里有封面但曲库地址失效」的条目（healableCovers），等用户点
 * 「开始补封面」时再写回，扫描本身不产生任何持久化写入。
 */

/** 体检进度：done / total 都是「歌曲数」 */
export interface HealthProgress {
  done: number
  total: number
}

export interface LibraryHealth {
  total: number
  totalSize: number
  /** 文件里没有内嵌封面、曲库地址也不可用 */
  missingCovers: LX.Music.MusicInfoLocal[]
  /** 文件里有内嵌封面，只是曲库记的地址失效：修复时写回即可，不用联网 */
  healableCovers: LX.Music.MusicInfoLocal[]
  tagIncomplete: TagIncompleteItem[]
  missingLyrics: LX.Music.MusicInfoLocal[]
  invalid: LX.Music.MusicInfoLocal[]
  /** content:// 条目没法判断同目录有没有 .lrc，跳过的数量（用于界面说明） */
  lyricsUnknown: number
}

export interface HealthScanCallbacks {
  onProgress: (progress: HealthProgress) => void
  isAlive: () => boolean
}

export const createEmptyHealth = (): LibraryHealth => ({
  total: 0,
  totalSize: 0,
  missingCovers: [],
  healableCovers: [],
  tagIncomplete: [],
  missingLyrics: [],
  invalid: [],
  lyricsUnknown: 0,
})

const isSafPath = (path: string) => path.startsWith('content://')

/** 取父目录：/a/b/c.flac → /a/b */
const parentDirOf = (path: string) => path.replace(/[/\\][^/\\]+$/, '')

/** /a/b/c.flac → /a/b/c.lrc；识别不出扩展名返回 '' */
const lrcPathOf = (path: string) => {
  const slash = path.lastIndexOf('/')
  const dot = path.lastIndexOf('.')
  if (dot <= slash) return ''
  return `${path.slice(0, dot)}.lrc`
}

/**
 * 文件是不是真的不在了。
 *
 * 不能只看 `existsFile(filePath) === false`：没有「所有文件访问」权限时，
 * 公共目录的真实路径一律 stat 不到，会把整库都判成无效条目（用户一点「移除」
 * 就把曲库清空了）。所以还要父目录能读到，才认为文件真的被删了。
 */
const isInvalidEntry = async(item: LX.Music.MusicInfoLocal): Promise<boolean> => {
  const filePath = item.meta.filePath
  if (!filePath) return true
  if (isSafPath(filePath)) return false
  if (await existsFile(filePath).catch(() => true)) return false
  const dir = parentDirOf(filePath)
  if (!dir || dir === filePath) return false
  return existsFile(dir).catch(() => false)
}

/** 真实路径可访问时，再判断同目录 .lrc 在不在；判断不了返回 'unknown' */
const checkLyricFile = async(filePath: string): Promise<'yes' | 'no' | 'unknown'> => {
  if (!filePath || isSafPath(filePath)) return 'unknown'
  const lrcPath = lrcPathOf(filePath)
  if (!lrcPath) return 'unknown'
  // 音频文件本身 stat 不到（多半是权限问题）就不要猜，否则会把全库算成缺歌词
  if (!await existsFile(filePath).catch(() => true)) return 'unknown'
  return await existsFile(lrcPath).catch(() => true) ? 'yes' : 'no'
}

/** 扫一遍曲库，算出体检总览和所有待处理列表（只读，不改曲库） */
export const scanLibraryHealth = async(callbacks: HealthScanCallbacks): Promise<LibraryHealth | null> => {
  // core 的 getLocalMusicList 已经返回副本；这里再复制一次，保证绝不原地改曲库数组
  const list = [...await getLocalMusicList()]
  const total = list.length
  const result = createEmptyHealth()
  result.total = total
  callbacks.onProgress({ done: 0, total })

  for (let i = 0; i < total; i++) {
    if (!callbacks.isAlive()) return null
    const item = list[i]
    result.totalSize += item.meta.size ?? 0

    if (await isInvalidEntry(item)) {
      // 文件都没了，封面/标签/歌词这些检查没有意义，单独归到「无效条目」
      result.invalid.push(item)
    } else {
      // 封面：曲库地址可用就不开文件；不可用才抽内嵌（抓到的同时也给预览列表补缩略图缓存）
      if (!await isCoverUsable(item.meta.picUrl)) {
        const embedded = await readEmbeddedCover(item).catch(() => '')
        if (embedded) result.healableCovers.push(item)
        else result.missingCovers.push(item)
      }

      // 标签：纯字段判断，不用读文件
      const issues = getTagIssues(item)
      if (issues.length) result.tagIncomplete.push({ item, issues })

      // 歌词：只检测真实路径旁边有没有 .lrc；content:// 没法和目录做比较
      const lyricState = await checkLyricFile(item.meta.filePath)
      if (lyricState === 'no') result.missingLyrics.push(item)
      else if (lyricState === 'unknown') result.lyricsUnknown++
    }

    // 每 5 首刷一次进度，别让每首 setState 把界面拖慢
    if (i % 5 === 0 || i === total - 1) callbacks.onProgress({ done: i + 1, total })
  }

  return result
}
