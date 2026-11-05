import { updateLocalMusicFilePath } from '@/core/localMusic'
import { clipFileName, filterFileName, joinPath } from '@/core/download/utils'
import { existsFile, extname, moveFile } from '@/utils/fs'
import { deleteDocument, findAudioByPath } from '@/utils/directoryPicker'
import { scanFile } from '@/utils/nativeModules/download'
import { cleanSongName } from '@/utils/songName'
import { buildReportLine } from './report'

/**
 * 按统一模板批量重命名本地音乐文件。
 *
 * 默认模板 `{歌手} - {歌名}`（和下载目录的命名格式一致），支持：
 *   {歌名}  {歌手}  {专辑}
 * 扩展名由音频文件自身决定，模板里不需要写。
 *
 * 安全策略：
 * - 先预览（旧名 → 新名 + 冲突标记），用户确认后才真正改名；
 * - 只处理真实磁盘路径：SAF content:// 条目拿不到可重命名的文档地址，直接跳过并提示；
 * - 重名冲突（同一批目标重名 / 目标文件已存在）不执行，列进失败清单；
 * - 改名成功后同步曲库记录、重命名同名 .lrc、补扫 MediaStore、清掉旧路径的媒体库记录。
 */

export const DEFAULT_RENAME_TEMPLATE = '{歌手} - {歌名}'

export type RenamePreviewStatus = 'ok' | 'unchanged' | 'conflict' | 'saf' | 'invalid'

export interface RenamePreviewItem {
  item: LX.Music.MusicInfoLocal
  oldName: string
  newName: string
  oldPath: string
  /** 预览阶段算出的目标路径（status === 'ok' 时才可直接使用） */
  newPath: string
  status: RenamePreviewStatus
  reason?: string
}

export interface RenameProgress {
  done: number
  total: number
}

export interface RenameSummary {
  renamed: number
  failed: number
  /** 被跳过（SAF / 与原名相同）的数量 */
  skipped: number
  stopped: boolean
  failures: string[]
}

export interface RenameCallbacks {
  onProgress: (progress: RenameProgress) => void
  isAlive: () => boolean
}

const isSafPath = (path: string) => path.startsWith('content://')

/** 取路径最后一段 */
const baseNameOf = (path: string) => {
  if (!path) return ''
  const slash = path.lastIndexOf('/')
  return slash >= 0 ? path.slice(slash + 1) : path
}

/** /a/b/c.flac → /a/b/c.lrc */
const lrcPathOf = (path: string) => {
  const slash = path.lastIndexOf('/')
  const dot = path.lastIndexOf('.')
  if (dot <= slash) return ''
  return `${path.slice(0, dot)}.lrc`
}

/** 父目录 */
const parentDirOf = (path: string) => {
  const slash = path.lastIndexOf('/')
  return slash > 0 ? path.slice(0, slash) : ''
}

/**
 * 按模板渲染新文件名（含扩展名）。
 * @returns '' 表示模板渲染结果为空，不能用于改名
 */
export const renderRenameName = (item: LX.Music.MusicInfoLocal, template: string): string => {
  const name = cleanSongName(item.name, item.singer)
  const singer = (item.singer ?? '').trim() || '未知歌手'
  const album = (item.meta.albumName ?? '').trim()
  let text = template
    .replace(/\{歌名\}/g, name)
    .replace(/\{歌手\}/g, singer)
    .replace(/\{专辑\}/g, album)
    .trim()
  if (!text) return ''
  // 和下载模块同一套过滤规则：去掉文件名非法字符、裁剪过长文件名
  text = filterFileName(text)
  if (!text) return ''
  const ext = item.meta.ext || extname(item.meta.filePath)
  return clipFileName(ext ? `${text}.${ext}` : text)
}

/** 生成改名预览（异步：要检查目标文件是否已存在） */
export const buildRenamePreview = async(
  items: LX.Music.MusicInfoLocal[],
  template: string,
): Promise<RenamePreviewItem[]> => {
  const result: RenamePreviewItem[] = []
  const targets = new Set<string>()

  for (const item of items) {
    const oldPath = item.meta.filePath ?? ''
    const oldName = baseNameOf(oldPath)
    const newName = renderRenameName(item, template)
    const base: RenamePreviewItem = {
      item,
      oldName,
      newName,
      oldPath,
      newPath: '',
      status: 'ok',
    }

    if (!oldPath || isSafPath(oldPath)) {
      result.push({ ...base, status: 'saf', reason: 'SAF 目录条目暂不支持改名' })
      continue
    }
    if (!newName) {
      result.push({ ...base, status: 'invalid', reason: '模板渲染结果为空' })
      continue
    }
    if (newName === oldName) {
      result.push({ ...base, status: 'unchanged' })
      continue
    }
    const newPath = joinPath(parentDirOf(oldPath), newName)
    base.newPath = newPath
    if (targets.has(newPath)) {
      result.push({ ...base, status: 'conflict', reason: '本批次里有同名目标' })
      continue
    }
    targets.add(newPath)
    if (await existsFile(newPath).catch(() => false)) {
      result.push({ ...base, status: 'conflict', reason: '目标文件已存在' })
      continue
    }
    result.push(base)
  }

  return result
}

/** 预览统计（界面用） */
export const summarizeRenamePreview = (preview: RenamePreviewItem[]) => {
  let ok = 0
  let unchanged = 0
  let conflict = 0
  let saf = 0
  let invalid = 0
  for (const item of preview) {
    switch (item.status) {
      case 'ok': ok++; break
      case 'unchanged': unchanged++; break
      case 'conflict': conflict++; break
      case 'saf': saf++; break
      default: invalid++; break
    }
  }
  return { ok, unchanged, conflict, saf, invalid, total: preview.length }
}

/** 执行改名（只处理 status === 'ok' 的条目） */
export const runRenameBatch = async(
  preview: RenamePreviewItem[],
  callbacks: RenameCallbacks,
): Promise<RenameSummary> => {
  const tasks = preview.filter(item => item.status === 'ok')
  const summary: RenameSummary = {
    renamed: 0,
    failed: 0,
    skipped: preview.length - tasks.length,
    stopped: false,
    failures: [],
  }
  const total = tasks.length
  callbacks.onProgress({ done: 0, total })

  for (let i = 0; i < total; i++) {
    if (!callbacks.isAlive()) {
      summary.stopped = true
      break
    }
    const task = tasks[i]
    try {
      await moveFile(task.oldPath, task.newPath)

      // 同名 .lrc 一起改名，否则歌词就「丢」了
      const oldLrc = lrcPathOf(task.oldPath)
      const newLrc = lrcPathOf(task.newPath)
      if (oldLrc && newLrc && await existsFile(oldLrc).catch(() => false)) {
        await moveFile(oldLrc, newLrc).catch(() => {})
      }

      // 曲库记录同步（id 由路径派生，必须一起更新）
      await updateLocalMusicFilePath(task.oldPath, task.newPath)

      // 媒体库：新路径补扫、旧路径记录删掉，避免重新扫描时出现幽灵条目
      void scanFile(task.newPath)
      try {
        const oldItem = await findAudioByPath(task.oldPath)
        if (oldItem?.contentUri) void deleteDocument(oldItem.contentUri)
      } catch {}

      summary.renamed++
    } catch {
      summary.failed++
      summary.failures.push(buildReportLine(
        '重命名',
        cleanSongName(task.item.name, task.item.singer),
        task.item.singer,
        `改名失败：${task.oldName} → ${task.newName}`,
      ))
    }
    callbacks.onProgress({ done: i + 1, total })
  }

  return summary
}

export const buildRenameReport = (summary: RenameSummary): string[] => {
  const lines = [`重命名完成：成功 ${summary.renamed} 首，失败 ${summary.failed} 首，跳过 ${summary.skipped} 首`]
  if (summary.stopped) lines.push('（任务被中途停止，以上为已完成部分）')
  if (summary.failures.length) lines.push(...summary.failures)
  return lines
}
