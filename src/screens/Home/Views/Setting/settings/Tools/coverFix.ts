import { getLocalMusicList, updateLocalMusicPic } from '@/core/localMusic'
import { fetchNetworkCover, invalidateEmbeddedCover, isCoverUsable, readEmbeddedCover } from '@/core/localMusic/cover'
import { unlink } from '@/utils/fs'
import { downloadCover, resolveWriteTargets, writeCoverToFile } from './fileWrite'

/**
 * 音乐工具 - 补封面逻辑。
 *
 * 统计口径（和用户看到的一致）：**要能真的显示出来才算有封面**。
 * 1. 文件里能抽出内嵌封面 → 有（顺便写回曲库自愈）；
 * 2. `meta.picUrl` 是 http 地址或确实存在的本地文件 → 有；
 * 3. 其它（尤其是 MediaStore 的 `content://.../albumart/...`，没封面时也会生成）→ 缺失。
 *
 * 补封面顺序：内嵌 → 联网找 → 下载图片 → 尽量写进音频文件 → 写回曲库。
 * 文件不允许改写（没授权 / 格式不支持）时，退化成「只在曲库记网络地址」，不计失败。
 */

export interface TaskProgress {
  done: number
  total: number
}

export interface CoverScanResult {
  total: number
  missing: LX.Music.MusicInfoLocal[]
}

export interface CoverFixSummary {
  /** 文件里本来就有封面，只是曲库没记住 */
  local: number
  /** 联网找到封面并写进了音频文件 */
  network: number
  /** 图片有了但文件写不进去，只记在曲库里 */
  libraryOnly: number
  /** 联网也没找到（或整首处理失败） */
  notFound: number
}

export interface CoverFixCallbacks {
  onProgress: (progress: TaskProgress) => void
  isAlive: () => boolean
}

/** 曲库里记的封面地址是否真能用：albumart 的 content:// 一律不算（加载必然失败） */
const isStoredCoverUsable = async(url?: string | null): Promise<boolean> => {
  if (!url) return false
  if (/^content:\/\//i.test(url)) return false
  return isCoverUsable(url)
}

/** 扫一遍曲库，统计真正没有可显示封面的歌（内嵌封面能抽到的顺便写回曲库自愈） */
export const scanMissingCovers = async(
  callbacks: Pick<CoverFixCallbacks, 'onProgress' | 'isAlive'>,
): Promise<CoverScanResult | null> => {
  // 不要原地改 getLocalMusicList() 返回的数组，先复制一份
  const list = [...await getLocalMusicList()]
  const total = list.length
  const missing: LX.Music.MusicInfoLocal[] = []
  callbacks.onProgress({ done: 0, total })

  for (let i = 0; i < total; i++) {
    if (!callbacks.isAlive()) return null
    const item = list[i]
    const filePath = item.meta.filePath
    let covered = await isStoredCoverUsable(item.meta.picUrl)

    if (!covered && filePath) {
      // picUrl 不可用（典型是 albumart 地址）→ 看看文件里到底有没有内嵌封面。
      // 这里不主动清缓存：同一会话里重新统计应该走缓存（否则每次都要把 233 个文件重开一遍），
      // 写入封面后由 fixOne / tagScrape 显式 invalidate。
      const embedded = await readEmbeddedCover(item).catch(() => '')
      if (embedded) {
        // 抽到了就直接写回曲库，列表/播放器下次不用再开文件
        await updateLocalMusicPic(filePath, embedded).catch(() => {})
        covered = true
      }
    }

    if (!covered) missing.push(item)
    // 每 5 首刷一次进度，避免每首 setState 把界面拖慢
    if (i % 5 === 0 || i === total - 1) callbacks.onProgress({ done: i + 1, total })
  }

  return { total, missing }
}

type FixResult = keyof CoverFixSummary

/** 处理一首缺失封面的歌 */
const fixOne = async(item: LX.Music.MusicInfoLocal): Promise<FixResult> => {
  const filePath = item.meta.filePath
  if (!filePath) return 'notFound'

  // ① 扫描时可能因为文件被占用没抽出来，这里再试一次
  invalidateEmbeddedCover(filePath)
  const embedded = await readEmbeddedCover(item).catch(() => '')
  if (embedded) {
    await updateLocalMusicPic(filePath, embedded)
    return 'local'
  }

  // ② 联网找封面
  const url = await fetchNetworkCover(item)
  if (!url) return 'notFound'

  // ③ 下载图片后尽量写进文件；写不进去至少让曲库记住网络地址
  const targets = await resolveWriteTargets(item)
  const picPath = await downloadCover(url)
  let written = ''
  if (picPath) {
    try {
      written = await writeCoverToFile(targets, picPath)
    } finally {
      void unlink(picPath).catch(() => {})
    }
  }

  if (written) {
    // 写完重新抽一次：曲库指向本地缓存文件，比网络地址稳定
    invalidateEmbeddedCover(filePath)
    const fresh = await readEmbeddedCover(item).catch(() => '')
    if (fresh) {
      await updateLocalMusicPic(filePath, fresh)
      return 'network'
    }
    // 写入接口没报错但重新抽不到（个别 ROM 会「伪成功」）：曲库退回网络地址，
    // 按「仅曲库」统计，别骗用户说已经写进文件了
    await updateLocalMusicPic(filePath, url)
    return 'libraryOnly'
  }

  await updateLocalMusicPic(filePath, url)
  return 'libraryOnly'
}

/** 批量补封面：单首失败不中断整批，返回分项统计 */
export const fixCovers = async(
  items: LX.Music.MusicInfoLocal[],
  callbacks: CoverFixCallbacks,
): Promise<CoverFixSummary> => {
  const summary: CoverFixSummary = { local: 0, network: 0, libraryOnly: 0, notFound: 0 }
  const total = items.length
  callbacks.onProgress({ done: 0, total })

  for (let i = 0; i < total; i++) {
    if (!callbacks.isAlive()) break
    try {
      summary[await fixOne(items[i])]++
    } catch {
      // 单首文件损坏 / 网络异常都不应该让整批停下
      summary.notFound++
    }
    callbacks.onProgress({ done: i + 1, total })
  }

  return summary
}
