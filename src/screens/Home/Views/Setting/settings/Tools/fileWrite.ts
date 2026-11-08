import { downloadFile, existsFile, extname, stat, temporaryDirectoryPath, unlink } from '@/utils/fs'
import { findAudioByPath } from '@/utils/directoryPicker'
import { writeMetadata, writePic, type MusicMetadata } from '@/utils/localMediaMetadata'
import { writeFlacTags } from '@/utils/flacTag'
import { scanFile } from '@/utils/nativeModules/download'

/**
 * 写回音频文件的公共逻辑（补封面 / 刮削标签共用）。
 *
 * 目标地址的优先级：`meta.contentUri` → `meta.filePath` → 用路径反查 MediaStore 的 contentUri。
 * 公共目录（用户用文件夹选择器授权的目录）按真实路径打不开，只能走 SAF 文档 uri；
 * 应用私有目录反过来直接按路径写最稳。原生模块两种地址都支持（内部有临时文件回退）。
 */

const isContentUri = (path?: string | null): path is string => !!path && path.startsWith('content://')

/** content://.../document/primary%3AMusic%2Fx.flac → /storage/emulated/0/Music/x.flac */
const contentUriToRealPath = (uri: string): string => {
  try {
    const decoded = decodeURIComponent(uri)
    const marker = '/document/'
    const index = decoded.indexOf(marker)
    if (index < 0) return ''
    const docId = decoded.slice(index + marker.length)
    const colon = docId.indexOf(':')
    if (colon < 0) return ''
    const volume = docId.slice(0, colon)
    const relative = docId.slice(colon + 1)
    const root = volume === 'primary'
      ? '/storage/emulated/0'
      : /^[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}$/.test(volume) ? `/storage/${volume}` : ''
    if (!root) return ''
    return relative ? `${root}/${relative}` : root
  } catch {
    return ''
  }
}

export interface WriteTargets {
  /** 依次尝试的写入地址 */
  list: string[]
  /** 真实磁盘路径（FLAC 纯 JS 兜底写入用；空 = 拿不到真实路径） */
  realPath: string
  ext: string
}

export const resolveWriteTargets = async(item: LX.Music.MusicInfoLocal): Promise<WriteTargets> => {
  const filePath = (item.meta.filePath ?? '').trim()
  const contentUri = (item.meta.contentUri ?? '').trim()
  const list: string[] = []
  const push = (path?: string | null) => {
    if (path && !list.includes(path)) list.push(path)
  }

  // SAF 文档 uri 有授权就一定能写，优先；然后才是真实路径
  push(contentUri)
  push(filePath)
  // 老数据可能只有路径没有 contentUri，用 MediaStore 反查一次
  if (filePath && !isContentUri(filePath)) {
    const found = await findAudioByPath(filePath).catch(() => null)
    if (found?.contentUri) push(found.contentUri)
  }

  const realPath = isContentUri(filePath)
    ? (contentUriToRealPath(filePath) || contentUriToRealPath(contentUri))
    : filePath
  const ext = (item.meta.ext || extname(realPath || filePath)).toLowerCase()

  return { list, realPath, ext }
}

/** 下载网络封面到缓存目录，返回本地路径（'' = 下载失败，调用方不用清理） */
export const downloadCover = async(url: string): Promise<string> => {
  const ext = /\.png(\?|#|$)/i.test(url) ? 'png' : 'jpg'
  const picPath = `${temporaryDirectoryPath}/tools_cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  try {
    await downloadFile(url, picPath).promise
    // 4xx/5xx 时 RNFS 也会 resolve，用文件大小兜一下，避免把错误页写进音频文件
    const info = await stat(picPath).catch(() => null)
    if (Number(info?.size ?? 0) < 1024) throw new Error('封面文件异常')
    return picPath
  } catch {
    void unlink(picPath).catch(() => {})
    return ''
  }
}

export interface TagWriteResult {
  /** 标签最终写到了哪个地址（'' = 没写进文件） */
  target: string
  /** 文件被重写后 MediaStore 可能分配新 id，刷新后的 contentUri（'' = 没变化/拿不到） */
  contentUri?: string
}

/**
 * 文件被「临时文件替换」后，MediaStore 里的旧 id 会失效（content://media/.../6391 No item），
 * 播放器会一直重试到超时。这里触发系统媒体扫描，并轮询拿到新 contentUri。
 */
export const refreshMediaUri = async(filePath: string): Promise<string> => {
  if (!filePath || filePath.startsWith('content://')) return ''
  await scanFile(filePath).catch(() => false)
  for (let i = 0; i < 8; i++) {
    const found = await findAudioByPath(filePath).catch(() => null)
    if (found?.contentUri) return found.contentUri
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  return ''
}

/**
 * 把歌名 / 歌手 / 专辑写进音频文件。
 * 原生库失败时，真实路径下的 FLAC 再用纯 JS 重写一遍（SAF 的 content:// 不支持）。
 * 纯 JS 写入不传封面 → 保留文件里原有的 PICTURE，不会把已有封面弄丢。
 */
export const writeTagsToFile = async(
  targets: WriteTargets,
  tags: MusicMetadata & { year?: string, genre?: string, language?: string },
): Promise<TagWriteResult> => {
  // 原生库只支持歌名/歌手/专辑；写成功后若还有年份/风格/语言，FLAC 再补一次扩展标签
  const flacTags = {
    TITLE: tags.name,
    ARTIST: tags.singer,
    ALBUM: tags.albumName,
    DATE: tags.year ?? '',
    GENRE: tags.genre ?? '',
    LANGUAGE: tags.language ?? '',
  }
  const hasExtra = !!(tags.year || tags.genre || tags.language)
  // 纯 JS 的 FLAC 写入只能操作真实路径；SAF/content:// 条目没有可读真实路径，强行 readFile 会原生崩溃
  const plainRealPath = targets.list.find(path => !path.startsWith('content://')) ? targets.realPath : ''
  for (const target of targets.list) {
    try {
      await writeMetadata(target, {
        name: tags.name,
        singer: tags.singer,
        albumName: tags.albumName,
      })
      if (hasExtra && targets.ext === 'flac' && plainRealPath && await existsFile(plainRealPath)) {
        try {
          await writeFlacTags(plainRealPath, flacTags)
          const contentUri = await refreshMediaUri(plainRealPath)
          return { target, contentUri }
        } catch {}
      }
      return { target }
    } catch {}
  }

  if (targets.realPath && targets.ext === 'flac') {
    try {
      await writeFlacTags(targets.realPath, flacTags)
      const contentUri = await refreshMediaUri(targets.realPath)
      return { target: targets.realPath, contentUri }
    } catch {}
  }

  return { target: '' }
}

/**
 * 只把封面写进音频文件（补封面用）。
 * @returns 写入成功的地址（'' = 文件不允许改写）
 */
export const writeCoverToFile = async(targets: WriteTargets, picPath: string): Promise<string> => {
  for (const target of targets.list) {
    try {
      await writePic(target, picPath)
      return target
    } catch {}
  }

  // FLAC 纯 JS 兜底：tags 传空对象 → 保留文件里原有的标签，只换 PICTURE
  if (targets.realPath && targets.ext === 'flac') {
    try {
      await writeFlacTags(targets.realPath, {}, picPath)
      return targets.realPath
    } catch {}
  }

  return ''
}
