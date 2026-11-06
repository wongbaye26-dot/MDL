import { cpFile, existsFile, mkdir, privateStorageDirectoryPath, unlink, writeFile } from '@/utils/fs'
import { deleteLocalMusic } from '@/core/localMusic'
import { getData, saveData } from '@/plugins/storage'

/**
 * 本地歌曲回收站（D-19 补）。
 *
 * 批量「删文件」不再直接 unlink，而是把文件移动到应用私有目录
 * `<DocumentDir>/recycle/`，并记录原路径；用户可以在 音乐工具 → 回收站
 * 恢复或清空。只移动文件，不碰收藏/歌单引用（与「从曲库移除」分开）。
 *
 * 说明：content:// 曲目依赖原生 cp 对 document uri 的支持；失败时返回错误，
 * 不会执行 unlink，避免「记录删了文件还在」或「文件删了无法恢复」。
 */

const RECYCLE_KEY = 'local_music_recycle_v1'
const RECYCLE_DIR = `${privateStorageDirectoryPath}/recycle`

export interface RecycleItem {
  /** 原 MusicInfoLocal.id，用于去重 */
  id: string
  name: string
  singer: string
  originalPath: string
  recyclePath: string
  size: number
  deletedAt: number
}

let cache: RecycleItem[] | null = null

export const loadRecycleBin = async(): Promise<RecycleItem[]> => {
  if (cache) return cache
  try {
    const raw = await getData<RecycleItem[]>(RECYCLE_KEY)
    // eslint-disable-next-line require-atomic-updates -- 单例缓存，启动时只加载一次
    cache = Array.isArray(raw) ? raw : []
  } catch {
    // eslint-disable-next-line require-atomic-updates -- 单例缓存，启动时只加载一次
    cache = []
  }
  return cache
}

const persist = async(list: RecycleItem[]) => {
  cache = list
  await saveData(RECYCLE_KEY, list).catch(() => {})
}

const baseNameOf = (path: string) => path.replace(/\\/g, '/').split('/').pop() ?? path
const safeName = (name: string) => name.replace(/[\\/:*?"<>|]/g, '_')

export interface RecycleResult {
  ok: boolean
  error?: string
}

/** 把一首歌的文件移入回收目录，并从曲库移除记录 */
export const moveSongToRecycle = async(item: LX.Music.MusicInfoLocal): Promise<RecycleResult> => {
  const originalPath = item.meta.filePath
  if (!originalPath) return { ok: false, error: '没有文件路径' }
  try {
    await mkdir(RECYCLE_DIR).catch(() => {})
    const target = `${RECYCLE_DIR}/${Date.now()}_${safeName(baseNameOf(originalPath))}`
    await cpFile(originalPath, target)
    // 只有复制成功才删除原文件
    await unlink(originalPath)
    const list = await loadRecycleBin()
    const record: RecycleItem = {
      id: item.id,
      name: item.name,
      singer: item.singer ?? '',
      originalPath,
      recyclePath: target,
      size: (item.meta as { size?: number }).size ?? 0,
      deletedAt: Date.now(),
    }
    await persist([record, ...list.filter(existing => existing.id !== item.id)])
    await deleteLocalMusic(item, false)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '移动失败' }
  }
}

/** 恢复到原路径；如果原文件已存在则追加时间戳，避免覆盖 */
export const restoreRecycleItem = async(record: RecycleItem): Promise<RecycleResult> => {
  try {
    const exists = await existsFile(record.recyclePath).catch(() => false)
    if (!exists) return { ok: false, error: '回收文件已不存在' }
    let target = record.originalPath
    if (await existsFile(target).catch(() => false)) {
      target = `${target}.${Date.now()}.restored`
    }
    const parent = target.slice(0, target.lastIndexOf('/'))
    if (parent) await mkdir(parent).catch(() => {})
    await cpFile(record.recyclePath, target)
    await unlink(record.recyclePath).catch(() => {})
    const list = await loadRecycleBin()
    await persist(list.filter(item => item.id !== record.id))
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '恢复失败' }
  }
}

/** 清空回收站：删除所有缓存文件与索引 */
export const emptyRecycleBin = async(): Promise<number> => {
  const list = await loadRecycleBin()
  let removed = 0
  for (const item of list) {
    try {
      await unlink(item.recyclePath)
      removed += 1
    } catch {
      // 文件可能已被系统清理，仍从索引里移除
    }
  }
  await persist([])
  return removed
}

export const getRecycleStats = (list: RecycleItem[]) => ({
  count: list.length,
  size: list.reduce((sum, item) => sum + (item.size || 0), 0),
})

export interface RecycleSelfTestResult {
  ok: boolean
  steps: string[]
}

/**
 * 回收站自检：用临时文件走一遍「移入 → 恢复 → 清理」，不碰真实歌曲。
 * 仅用于 A-2/N1 真机验证入口。
 */
export const selfTestRecycle = async(): Promise<RecycleSelfTestResult> => {
  const steps: string[] = []
  const testPath = `${privateStorageDirectoryPath}/recycle_selftest_${Date.now()}.txt`
  let recycleRecord: RecycleItem | undefined
  try {
    await mkdir(privateStorageDirectoryPath).catch(() => {})
    await writeFile(testPath, 'emo recycle selftest')
    steps.push('创建临时文件')
    const fakeItem = {
      id: `selftest_recycle_${Date.now()}`,
      name: '回收站自检',
      singer: '',
      interval: '',
      meta: { filePath: testPath, ext: 'txt', size: 20, mtime: Date.now() },
    } as unknown as LX.Music.MusicInfoLocal
    const moved = await moveSongToRecycle(fakeItem)
    if (!moved.ok) throw new Error(moved.error ?? '移入失败')
    steps.push('移入回收站')
    const list = await loadRecycleBin()
    recycleRecord = list.find(item => item.originalPath === testPath)
    if (!recycleRecord) throw new Error('回收站索引未写入')
    if (await existsFile(testPath)) throw new Error('原文件仍存在')
    if (!await existsFile(recycleRecord.recyclePath)) throw new Error('回收文件不存在')
    steps.push('校验原文件已移除、回收文件存在')
    const restored = await restoreRecycleItem(recycleRecord)
    if (!restored.ok) throw new Error(restored.error ?? '恢复失败')
    if (!await existsFile(testPath)) throw new Error('恢复后原文件不存在')
    steps.push('恢复原路径')
    const after = await loadRecycleBin()
    if (after.some(item => item.originalPath === testPath)) throw new Error('恢复后索引未清理')
    steps.push('索引清理')
    await unlink(testPath).catch(() => {})
    return { ok: true, steps }
  } catch (error) {
    if (recycleRecord && await existsFile(recycleRecord.recyclePath).catch(() => false)) {
      await restoreRecycleItem(recycleRecord).catch(() => {})
    }
    await unlink(testPath).catch(() => {})
    return { ok: false, steps: [...steps, error instanceof Error ? error.message : '自检失败'] }
  }
}
