import { updateLocalMusicPic } from '@/core/localMusic'
import { fetchNetworkCover, invalidateEmbeddedCover, readEmbeddedCover } from '@/core/localMusic/cover'
import { unlink } from '@/utils/fs'
import { downloadCover, resolveWriteTargets, writeCoverToFile } from './fileWrite'

/**
 * 音乐工具 - 补封面逻辑（封面统计在 health.ts 里统一做，这里只负责「修」）。
 *
 * 补封面顺序：本地内嵌 → 联网找 → 下载图片 → 尽量写进音频文件 → 写回曲库。
 * 文件不允许改写（没授权 / 格式不支持）时，退化成「只在曲库记网络地址」，不计失败。
 *
 * 两类待修复条目：
 * - healableCovers：体检时已经抽出内嵌封面、只是曲库地址失效 → 写回曲库即可（快，不联网）；
 * - missingCovers：文件里确实没有 → 联网找并尽量写进文件。
 * 体检阶段**不写曲库**（避免一次扫描几百次 localMusicUpdated），写回集中到这里。
 */

export interface TaskProgress {
  done: number
  total: number
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

type FixResult = keyof CoverFixSummary

/** 处理一首真缺封面的歌 */
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

/** 批量补封面：先写回体检时抽到的本地封面，再处理真缺封面的；单首失败不中断整批 */
export const fixCovers = async(
  healableCovers: LX.Music.MusicInfoLocal[],
  missingCovers: LX.Music.MusicInfoLocal[],
  callbacks: CoverFixCallbacks,
): Promise<CoverFixSummary> => {
  const summary: CoverFixSummary = { local: 0, network: 0, libraryOnly: 0, notFound: 0 }
  const total = healableCovers.length + missingCovers.length
  let done = 0
  callbacks.onProgress({ done, total })

  // ① 文件里本来就有封面：只把抽到的本地路径写回曲库（体检时已经抽过，走内存缓存，很快）
  for (const item of healableCovers) {
    if (!callbacks.isAlive()) return summary
    const filePath = item.meta.filePath
    try {
      const embedded = await readEmbeddedCover(item).catch(() => '')
      if (embedded && filePath) {
        await updateLocalMusicPic(filePath, embedded)
        summary.local++
      } else {
        // 扫描到这里之后文件被删 / 被改了：按未找到处理
        summary.notFound++
      }
    } catch {
      summary.notFound++
    }
    callbacks.onProgress({ done: ++done, total })
  }

  // ② 真缺封面的：联网找 + 写文件
  for (const item of missingCovers) {
    if (!callbacks.isAlive()) break
    try {
      summary[await fixOne(item)]++
    } catch {
      // 单首文件损坏 / 网络异常都不应该让整批停下
      summary.notFound++
    }
    callbacks.onProgress({ done: ++done, total })
  }

  return summary
}
