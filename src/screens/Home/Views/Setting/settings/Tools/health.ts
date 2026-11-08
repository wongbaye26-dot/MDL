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

/** 一组重复歌曲（同歌名 + 同歌手归一化后相同） */
export interface DuplicateGroup {
  key: string
  /** 组内至少 2 首；items[0] 是体检时选出的「建议保留」的一首 */
  items: LX.Music.MusicInfoLocal[]
}

export interface LibraryHealth {
  total: number
  totalSize: number
  /** 文件里没有内嵌封面、曲库地址也不可用 */
  missingCovers: LX.Music.MusicInfoLocal[]
  /** 文件里有内嵌封面，只是曲库记的地址失效：修复时写回即可，不用联网 */
  healableCovers: LX.Music.MusicInfoLocal[]
  tagIncomplete: TagIncompleteItem[]
  /** 缺语言/年份/风格的歌曲（联网补全用） */
  metaIncomplete: LX.Music.MusicInfoLocal[]
  missingLyrics: LX.Music.MusicInfoLocal[]
  invalid: LX.Music.MusicInfoLocal[]
  /** content:// 条目没法判断同目录有没有 .lrc，跳过的数量（用于界面说明） */
  lyricsUnknown: number
  /** 重复歌曲分组（同歌名 + 歌手） */
  duplicates: DuplicateGroup[]
  /** 重复条目里「多余」的数量（总数 - 分组数） */
  duplicateExtras: number
  /** 已知码率且低于 192kbps 的歌曲 */
  lowBitrate: LX.Music.MusicInfoLocal[]
  /** 时长未知 / 过短(<15s) / 过长(>3h) 的歌曲 */
  durationAbnormal: LX.Music.MusicInfoLocal[]
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
  metaIncomplete: [],
  missingLyrics: [],
  invalid: [],
  lyricsUnknown: 0,
  duplicates: [],
  duplicateExtras: 0,
  lowBitrate: [],
  durationAbnormal: [],
})

/** 低码率阈值（kbps）：低于这个值的音质听感明显变差 */
const LOW_BITRATE_KBPS = 192
/** 时长异常阈值（秒） */
const MIN_DURATION = 15
const MAX_DURATION = 3 * 60 * 60

/** 把 meta.bitrate（'918' / '918 kbps' / 原始 bps）统一成 kbps；认不出返回 0 */
export const parseBitrateKbps = (raw?: string | null): number => {
  if (!raw) return 0
  const value = parseFloat(String(raw).replace(/[^\d.]/g, ''))
  if (!Number.isFinite(value) || value <= 0) return 0
  // 有些音源/标签返回的是 bps（如 918000），统一换算成 kbps
  return value > 10000 ? value / 1000 : value
}

/** '03:55' → 235 秒；解析不出返回 0 */
const parseIntervalSeconds = (interval?: string | null): number => {
  if (!interval) return 0
  const parts = interval.split(':').map(part => parseInt(part, 10))
  if (!parts.length || parts.some(Number.isNaN)) return 0
  let seconds = 0
  for (const part of parts) seconds = seconds * 60 + part
  return seconds
}

/** 歌名 / 歌手归一化：忽略大小写、空格、括号、连字符这类噪音，用于找重复 */
const normalizeForDuplicate = (text?: string | null) => (text ?? '')
  .toLowerCase()
  .replace(/[\s\-–—_·・()（）[\]【】<>、,，/&.。'"“”!！?？:：]/g, '')

/** 重复歌曲分组：歌名+歌手归一化后相同的放在一组，组内按「体积大、文件名短」排前面建议保留 */
const collectDuplicates = (list: LX.Music.MusicInfoLocal[]): DuplicateGroup[] => {
  const groups = new Map<string, LX.Music.MusicInfoLocal[]>()
  for (const item of list) {
    const name = normalizeForDuplicate(item.name)
    if (!name) continue
    const singer = normalizeForDuplicate(item.singer)
    const key = `${name}|${singer}`
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }
  const result: DuplicateGroup[] = []
  for (const [key, items] of groups) {
    if (items.length < 2) continue
    // 建议保留体积更大的（同歌名同歌手时通常码率/完整度更好）
    items.sort((a, b) => (b.meta.size ?? 0) - (a.meta.size ?? 0))
    result.push({ key, items })
  }
  result.sort((a, b) => b.items.length - a.items.length)
  return result
}

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
      if (!item.meta.language || !item.meta.year || !item.meta.genre) result.metaIncomplete.push(item)

      // 歌词：只检测真实路径旁边有没有 .lrc；content:// 没法和目录做比较
      const lyricState = await checkLyricFile(item.meta.filePath)
      if (lyricState === 'no') result.missingLyrics.push(item)
      else if (lyricState === 'unknown') result.lyricsUnknown++

      // 码率：已知且明显偏低（无损文件码率通常远高于阈值，不会误报）
      const kbps = parseBitrateKbps(item.meta.bitrate)
      if (kbps > 0 && kbps < LOW_BITRATE_KBPS) result.lowBitrate.push(item)

      // 时长：未知 / 过短 / 过长都算异常
      const seconds = parseIntervalSeconds(item.interval)
      if (!seconds || seconds < MIN_DURATION || seconds > MAX_DURATION) result.durationAbnormal.push(item)
    }

    // 每 5 首刷一次进度，别让每首 setState 把界面拖慢
    if (i % 5 === 0 || i === total - 1) callbacks.onProgress({ done: i + 1, total })
  }

  // 重复歌曲：只在「文件还在」的条目里统计（无效条目单独处理）
  const invalidSet = new Set(result.invalid)
  const validList = list.filter(item => !invalidSet.has(item))
  result.duplicates = collectDuplicates(validList)
  result.duplicateExtras = result.duplicates.reduce((sum, group) => sum + group.items.length - 1, 0)

  return result
}

/** 生成曲库体检报告文本（复制 / 导出用），列表最多列 60 条避免文本过长 */
export const buildHealthReport = (health: LibraryHealth): string[] => {
  const lines = [
    `曲库体检：共 ${health.total} 首，总大小 ${health.totalSize} 字节`,
    `缺封面 ${health.missingCovers.length} 首（另有 ${health.healableCovers.length} 首本地封面可写回）`,
    `标签待补 ${health.tagIncomplete.length} 首`,
    `缺歌词 ${health.missingLyrics.length} 首（content:// 无法判断 ${health.lyricsUnknown} 首）`,
    `重复歌曲 ${health.duplicates.length} 组，多余 ${health.duplicateExtras} 首`,
    `低码率(<192kbps) ${health.lowBitrate.length} 首`,
    `时长异常/未知 ${health.durationAbnormal.length} 首`,
    `文件已丢失 ${health.invalid.length} 首`,
  ]
  const appendList = (title: string, list: LX.Music.MusicInfoLocal[]) => {
    if (!list.length) return
    lines.push('', `# ${title}（${list.length} 首）`)
    for (const item of list.slice(0, 60)) {
      lines.push(`${item.name || '未知歌曲'} - ${item.singer || '未知歌手'}｜${item.meta.filePath || ''}`)
    }
  }
  appendList('缺封面', health.missingCovers)
  appendList('缺歌词', health.missingLyrics)
  appendList('低码率', health.lowBitrate)
  appendList('时长异常', health.durationAbnormal)
  appendList('文件已丢失', health.invalid)
  if (health.duplicates.length) {
    lines.push('', `# 重复歌曲（${health.duplicates.length} 组）`)
    for (const group of health.duplicates.slice(0, 30)) {
      lines.push(`${group.items[0].name || '未知歌曲'} - ${group.items[0].singer || '未知歌手'}｜组内 ${group.items.length} 首`)
    }
  }
  return lines
}
