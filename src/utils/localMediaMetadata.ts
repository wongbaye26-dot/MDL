import { temporaryDirectoryPath, readDir, extname, mkdir, stat, unlink } from '@/utils/fs'
import {
  readPic as _readPic,
  writeMetadata as _writeMetadata,
  writePic as _writePic,
  type MusicMetadata,
} from 'react-native-local-media-metadata'
export {
  type MusicMetadata,
  type MusicMetadataFull,
  readMetadata,
  readLyric,
  writeLyric,
} from 'react-native-local-media-metadata'

const picCachePath = temporaryDirectoryPath + '/local-media-metadata'

/**
 * 原生写标签前会把文件复制到 `<cache>/local-media-metadata-temp-file/`，
 * 但它只对「临时文件」调用 mkdirs，目录本身不存在 / 被误建成普通文件时，
 * 部分 ROM 上会直接抛 `FileOutputStream: open failed: ENOENT`。
 * 所有写入入口都先过一遍这里，保证目录真实存在。
 */
const nativeTempPath = `${temporaryDirectoryPath}/local-media-metadata-temp-file`
const ensureNativeTempDir = async() => {
  const info = await stat(nativeTempPath).catch(() => null)
  if (info && !info.isDirectory) await unlink(nativeTempPath).catch(() => {})
  if (!info || !info.isDirectory) await mkdir(nativeTempPath).catch(() => {})
}

export const writeMetadata = async(filePath: string, metadata: MusicMetadata, isOverwrite = false): Promise<void> => {
  await ensureNativeTempDir()
  return _writeMetadata(filePath, metadata, isOverwrite)
}

export const writePic = async(filePath: string, picPath: string): Promise<void> => {
  await ensureNativeTempDir()
  return _writePic(filePath, picPath)
}


export const scanAudioFiles = async(dirPath: string) => {
  const files = await readDir(dirPath)
  return files.filter(file => {
    if (file.mimeType?.startsWith('audio/')) return true
    if (extname(file?.name ?? '') === 'ogg') return true
    return false
  }).map(file => file)
}

/**
 * 抽内嵌封面（原生会把图片写到缓存目录并返回路径）。
 *
 * 注意：这里**不要**清理缓存目录。以前每次启动都会把整个目录删掉，
 * 但曲库里存的 `meta.picUrl` 直接指向这些文件 —— 一删，所有从文件里抽出来的封面
 * 立刻变成死链：列表显示占位块，音乐工具却统计成「有封面」，两边对不上。
 * 缓存文件名就是音频文件名，数量天然被曲库大小限制，不需要定期清理。
 */
export const readPic = async(dirPath: string): Promise<string> => _readPic(dirPath, picCachePath)

// export interface MusicMetadata {
//   type: 'mp3' | 'flac' | 'ogg' | 'wav'
//   bitrate: string
//   interval: number
//   size: number
//   ext: 'mp3' | 'flac' | 'ogg' | 'wav'
//   albumName: string
//   singer: string
//   name: string
// }
// export const readMetadata = async(filePath: string): Promise<MusicMetadata | null> => {
//   return LocalMediaModule.readMetadata(filePath)
// }

// export const readPic = async(filePath: string): Promise<string> => {
//   return LocalMediaModule.readPic(filePath)
// }

// export const readLyric = async(filePath: string): Promise<string> => {
//   return LocalMediaModule.readLyric(filePath)
// }


