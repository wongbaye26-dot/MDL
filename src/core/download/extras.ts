import settingState from '@/store/setting/state'
import { writeMetadata, writePic } from '@/utils/localMediaMetadata'
import { downloadFile, temporaryDirectoryPath, unlink, writeFile } from '@/utils/fs'
import { getLyricInfo, getPicUrl } from '@/core/music/download'
import { writeTextToSibling } from '@/utils/directoryPicker'
import { isSafPath, joinPath } from './utils'

/**
 * 将歌词、封面、标签写入已下载的文件
 * 注意：SAF（content://）目录下的文件无法直接写入标签，只写入同名 .lrc 文件
 */
export const writeTaskExtras = async(task: LX.Download.ListItem) => {
  const setting = settingState.setting
  const filePath = task.metadata.filePath
  if (!filePath) return

  const isSaf = isSafPath(filePath)

  if (setting['download.isDownloadLyric']) {
    try {
      const lyricInfo = await getLyricInfo({ musicInfo: task, isRefresh: false })
      const lrc = buildLrcText(lyricInfo)
      if (lrc) {
        if (isSaf) {
          // content:// 文档 uri 不能做字符串换扩展名（会生成 URL 编码的垃圾文件名），
          // 用文件名重建，交给原生在同一个目录里写
          const lrcName = task.metadata.fileName.replace(/\.[^.]+$/, '.lrc')
          await writeTextToSibling(filePath, lrcName, `\ufeff${lrc}`)
        } else {
          await writeFile(filePath.replace(/\.[^.]+$/, '.lrc'), `\ufeff${lrc}`, 'utf8')
        }
      }
    } catch (err) {
    }
  }

  if (isSaf) return

  if (setting['download.isWriteMetadata']) {
    try {
      await writeMetadata(filePath, {
        name: task.metadata.musicInfo.name,
        singer: task.metadata.musicInfo.singer,
        albumName: task.metadata.musicInfo.meta.albumName ?? '',
      })
    } catch (err) {
    }
  }

  if (setting['download.isDownloadPic']) {
    let picPath: string | null = null
    try {
      const url = await getPicUrl({ musicInfo: task, isRefresh: false })
      if (url) {
        picPath = joinPath(temporaryDirectoryPath, `download_pic_${Date.now()}.jpg`)
        await downloadFile(url, picPath).promise
        await writePic(filePath, picPath)
      }
    } catch (err) {
    } finally {
      if (picPath) {
        void unlink(picPath).catch(() => {})
      }
    }
  }
}

const buildLrcText = (lyricInfo: LX.Player.LyricInfo) => {
  const lines: string[] = []
  if (lyricInfo.lyric) lines.push(lyricInfo.lyric)
  if (lyricInfo.tlyric) lines.push(lyricInfo.tlyric)
  return lines.join('\n').trim()
}
