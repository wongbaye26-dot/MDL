import settingState from '@/store/setting/state'
import { writeMetadata, writePic } from '@/utils/localMediaMetadata'
import { downloadFile, temporaryDirectoryPath, unlink, writeFile } from '@/utils/fs'
import { getLyricInfo, getPicUrl } from '@/core/music/download'
import { writeTextToSibling } from '@/utils/directoryPicker'
import { isSafPath, joinPath } from './utils'

/**
 * 将歌词、封面、标签写入已下载的文件。
 *
 * SAF（content://）目录：歌词写成同名 .lrc；标签/封面优先直接写文档 uri
 * （原生模块会通过 ParcelFileDescriptor 打开），失败再退回还原出来的真实路径。
 */
/**
 * content://com.android.externalstorage.documents/document/primary%3AMusic%2FDownload%2Fx.flac
 *   → /storage/emulated/0/Music/Download/x.flac
 * 认不出来就返回 null（这种才真的写不了标签）。
 */
const safUriToRealPath = (uri: string): string | null => {
  try {
    const decoded = decodeURIComponent(uri)
    const marker = '/document/'
    const idx = decoded.indexOf(marker)
    if (idx < 0) return null
    const docId = decoded.slice(idx + marker.length)
    const colon = docId.indexOf(':')
    if (colon < 0) return null
    const volume = docId.slice(0, colon)
    const rel = docId.slice(colon + 1)
    const root = volume === 'primary' ? '/storage/emulated/0' : `/storage/${volume}`
    return rel ? `${root}/${rel}` : root
  } catch {
    return null
  }
}

export const writeTaskExtras = async(task: LX.Download.ListItem) => {
  const setting = settingState.setting
  const filePath = task.metadata.filePath
  if (!filePath) return

  const isSaf = isSafPath(filePath)
  const realPath = isSaf ? safUriToRealPath(filePath) : filePath

  if (setting['download.isDownloadLyric']) {
    try {
      const lyricInfo = await getLyricInfo({ musicInfo: task, isRefresh: false })
      const lrc = buildLrcText(lyricInfo)
      if (lrc) {
        if (isSaf) {
          // content:// 文档 uri 不能做字符串换扩展名（会生成 URL 编码的垃圾文件名），
          // 用文件名重建，交给原生在同一个目录里写
          const lrcName = safeBaseName(task.metadata.fileName).replace(/\.[^.]+$/, '.lrc')
          await writeTextToSibling(filePath, lrcName, `\ufeff${lrc}`)
        } else {
          await writeFile(filePath.replace(/\.[^.]+$/, '.lrc'), `\ufeff${lrc}`, 'utf8')
        }
      }
    } catch {}
  }

  // 先把封面下到本地，标签和封面两件事都要用
  let picPath: string | null = null
  if (setting['download.isDownloadPic']) {
    try {
      const url = await getPicUrl({ musicInfo: task, isRefresh: false })
      if (url) {
        picPath = joinPath(temporaryDirectoryPath, `download_pic_${Date.now()}.jpg`)
        await downloadFile(url, picPath).promise
      }
    } catch {}
  }

  // SAF 优先写文档 uri（有授权就一定能写）；失败再退回真实路径
  const targets = isSaf ? [filePath, realPath].filter((p): p is string => !!p) : (realPath ? [realPath] : [])
  for (const target of targets) {
    try {
      if (setting['download.isWriteMetadata']) {
        await writeMetadata(target, {
          name: task.metadata.musicInfo.name,
          singer: task.metadata.musicInfo.singer,
          albumName: task.metadata.musicInfo.meta.albumName ?? '',
        })
      }
      if (picPath) await writePic(target, picPath)
      break
    } catch {}
  }

  if (picPath) void unlink(picPath).catch(() => {})
}

/** 从 content:// 或 URL 编码的路径里取出真正的文件名 */
const safeBaseName = (name: string) => {
  try {
    let n = name
    if (n.includes('%')) n = decodeURIComponent(n)
    const slash = Math.max(n.lastIndexOf('/'), n.lastIndexOf('%2F'))
    if (slash >= 0) n = n.slice(slash + 1)
    return n
  } catch {
    return name
  }
}

const buildLrcText = (lyricInfo: LX.Player.LyricInfo) => {
  const lines: string[] = []
  if (lyricInfo.lyric) lines.push(lyricInfo.lyric)
  if (lyricInfo.tlyric) lines.push(lyricInfo.tlyric)
  return lines.join('\n').trim()
}
