import Clipboard from '@react-native-clipboard/clipboard'

import { temporaryDirectoryPath, writeFile } from '@/utils/fs'
import { toast } from '@/utils/tools'

/**
 * 音乐工具结果导出：复制到剪贴板 / 写成日志文件。
 *
 * 批量操作（补封面、刮削、补歌词、重命名、清理重复）跑完后用户常想知道
 * 「具体哪几首失败了、失败原因是什么」，界面里只显示汇总数字是不够的，
 * 这里统一提供一份可复制的文本清单。
 */

/** 复制文本到剪贴板（成功返回 true） */
export const copyReport = (text: string): boolean => {
  if (!text.trim()) {
    toast('没有可复制的内容')
    return false
  }
  try {
    Clipboard.setString(text)
    toast('已复制到剪贴板')
    return true
  } catch {
    toast('复制失败，请重试')
    return false
  }
}

/**
 * 把结果写成 txt 日志文件（缓存目录，可在文件管理器里找到），返回文件路径。
 * 失败返回 ''。
 */
export const exportReport = async(title: string, lines: string[]): Promise<string> => {
  const path = `${temporaryDirectoryPath}/tools_${Date.now()}.txt`
  const header = [
    `# ${title}`,
    `# ${new Date().toLocaleString()}`,
    '',
  ]
  try {
    // 带 BOM：用 Windows 记事本 / 部分文件管理器打开中文不乱码
    await writeFile(path, `\ufeff${[...header, ...lines].join('\n')}`, 'utf8')
    toast(`已导出日志文件：${path}`, 'long')
    return path
  } catch {
    toast('导出日志失败，请检查存储空间')
    return ''
  }
}

/** 生成标准的结果清单行：类别｜歌名 - 歌手｜说明 */
export const buildReportLine = (category: string, name: string | null | undefined, singer: string | null | undefined, detail: string) => {
  const title = (name ?? '').trim() || '未知歌曲'
  const artist = (singer ?? '').trim() || '未知歌手'
  return `${category}｜${title} - ${artist}｜${detail}`
}
