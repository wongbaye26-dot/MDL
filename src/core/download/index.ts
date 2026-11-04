import settingState from '@/store/setting/state'
import { action as downloadAction, state as downloadState } from '@/store/download'
import { getDownloadList, saveDownloadList } from '@/utils/data'
import { getMusicUrl as getOnlineMusicUrl } from '@/core/music/online'
import {
  onDownloadEvent,
  startTask as nativeStartTask,
  pauseTask as nativePauseTask,
  removeTask as nativeRemoveTask,
  pauseAll as nativePauseAll,
  type DownloadEventPayload,
} from '@/utils/nativeModules/download'
import { existsFile, mkdir, moveFile, readDir, stat, unlink, writeFile } from '@/utils/fs'
import { copyFileToTree } from '@/utils/directoryPicker'
import { writeTaskExtras } from './extras'
import {
  buildFileName,
  buildTaskId,
  formatSpeed,
  getDefaultSavePath,
  getExt,
  getFallbackSavePath,
  getMusicType,
  getTempDownloadPath,
  isSafPath,
  joinPath,
} from './utils'
import { log } from '@/utils/log'
import { toast } from '@/utils/tools'
import { isExternalStorageManager } from '@/utils/nativeModules/utils'

/** 正在下载的任务 id */
const runningIds = new Set<string>()
/** 需要在下次开始时强制刷新下载地址的任务 id */
const refreshingIds = new Set<string>()

let inited = false
let unsubscribeEvent: (() => void) | null = null
let unsubscribeAutoSave: (() => void) | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
/** 目录探测的单飞 Promise（见 getSavePath） */
let savePathPromise: Promise<string> | null = null

const getTask = (id: string) => downloadAction.getTaskById(id)

/**
 * 校验下载结果：文件存在且大小与预期相符。
 * 校验本身失败（如 SAF 目录读不到 stat）时放行，避免误判。
 */
const verifyDownloadedFile = async(path: string, expected: number): Promise<boolean> => {
  try {
    const info = await stat(path)
    const size = Number(info?.size ?? 0)
    if (size <= 0) return false
    // 服务端返回的总大小可能略有出入，留 1KB 容差
    if (expected > 0 && size + 1024 < expected) return false
    return true
  } catch (err) {
    return true
  }
}

/**
 * 延迟保存下载列表，避免频繁写存储
 */
const scheduleSave = () => {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    void saveNow()
  }, 1500)
}

export const saveNow = async() => {
  const list = downloadState.list.map((task): LX.Download.ListItem => ({
    ...task,
    speed: '',
    statusText: '',
    // 运行中的任务下次启动时视为暂停
    status: task.isComplate ? 'completed' : (task.status === 'run' ? 'pause' : task.status),
  }))
  await saveDownloadList(list)
}

const normalizeTask = (task: LX.Download.ListItem): LX.Download.ListItem => {
  if (task.isComplate || task.status === 'completed') {
    return { ...task, status: 'completed', isComplate: true, progress: 100, speed: '', statusText: '' }
  }
  return {
    ...task,
    status: 'pause',
    speed: '',
    statusText: '',
    progress: task.total ? Math.min(99, Math.floor(task.downloaded / task.total * 100)) : 0,
  }
}

/**
 * 初始化下载模块，恢复上次未完成的下载列表
 */
export const init = async() => {
  if (inited) return
  inited = true
  const list = await getDownloadList()
  downloadAction.setList(list.map(normalizeTask))
  downloadAction.setInit()
  unsubscribeEvent = onDownloadEvent(handleNativeEvent)
  // 清掉可能残留的临时文件标记
  savePathPromise = null
  initAutoSave()
  // 如果用户之前授予过「所有文件访问权限」，把早期落到私有目录的下载迁回默认目录
  void migrateFallbackDownloads()
}

/** 边听边存：播放的在线歌曲自动加入下载队列 */
const handleAutoSave = async(playMusicInfo: LX.Player.PlayMusicInfo) => {
  if (!settingState.setting['download.autoSaveWhilePlaying']) return
  const musicInfo = playMusicInfo.musicInfo
  // 本地歌曲、下载任务不需要再存
  if ('metadata' in musicInfo) return
  if (musicInfo.source == null) return

  // 去重：检查下载列表中是否已有该歌曲（任意音质）
  const musicId = musicInfo.id
  const exists = downloadState.list.some(task =>
    task.metadata.musicInfo.id === musicId,
  )
  if (exists) return

  // 去重：检查本地音乐中是否已有该歌曲文件
  try {
    const { getLocalMusicList } = await import('@/core/localMusic')
    const localList = await getLocalMusicList()
    const localExists = localList.some(item =>
      item.name === musicInfo.name && item.singer === musicInfo.singer,
    )
    if (localExists) return
  } catch {}

  addTasks([musicInfo as LX.Music.MusicInfoOnline], { listId: playMusicInfo.listId })
}

export const initAutoSave = () => {
  if (unsubscribeAutoSave) return
  global.state_event.on('playMusicInfoChanged', handleAutoSave)
  unsubscribeAutoSave = () => {
    global.state_event.off('playMusicInfoChanged', handleAutoSave)
  }
}

export const dispose = () => {
  unsubscribeEvent?.()
  unsubscribeEvent = null
  unsubscribeAutoSave?.()
  unsubscribeAutoSave = null
  try {
    nativePauseAll()
  } catch (err) {
    log.error(err)
  }
  runningIds.clear()
  refreshingIds.clear()
}

const handleNativeEvent = (event: DownloadEventPayload) => {
  switch (event.action) {
    case 'start':
      downloadAction.updateTask(event.id, {
        status: 'run',
        statusText: '',
        downloaded: event.downloaded,
        total: event.total,
      })
      break
    case 'progress': {
      const progress = event.total > 0 ? Math.min(100, event.downloaded / event.total * 100) : 0
      downloadAction.updateTask(event.id, {
        downloaded: event.downloaded,
        total: event.total,
        progress,
        speed: formatSpeed(event.speed),
      })
      break
    }
    case 'pause':
      runningIds.delete(event.id)
      downloadAction.updateTask(event.id, {
        status: 'pause',
        speed: '',
        downloaded: event.downloaded,
        total: event.total,
      })
      scheduleSave()
      pump()
      break
    case 'complete':
      runningIds.delete(event.id)
      void handleComplete(event.id, event.total)
      break
    case 'error':
      runningIds.delete(event.id)
      void handleError(event.id, event.code, event.message)
      break
  }
}

const handleComplete = async(id: string, total: number) => {
  const task = getTask(id)
  if (!task) return

  // 原生层报告完成后先校验文件，避免服务端提前断开时「文件没写完却显示已完成」
  const expected = total || task.total
  const filePath = task.metadata.filePath
  if (filePath && !await verifyDownloadedFile(filePath, expected)) {
    const retryCount = (task.retryCount ?? 0) + 1
    if (retryCount <= 2) {
      // 删掉不完整的文件，否则原生层会认为「文件已存在」而直接再次报完成
      await unlink(filePath).catch(() => {})
      await unlink(`${filePath}.part`).catch(() => {})
      downloadAction.updateTask(id, {
        status: 'waiting',
        isComplate: false,
        progress: 0,
        downloaded: 0,
        total: 0,
        speed: '',
        statusText: '',
        retryCount,
        errorMessage: '文件不完整，正在重试',
      })
      setTimeout(() => { void startTask(id) }, 1200)
    } else {
      downloadAction.updateTask(id, {
        status: 'error',
        isComplate: false,
        speed: '',
        statusText: '',
        errorMessage: '文件下载不完整，请重试',
      })
      scheduleSave()
      pump()
    }
    return
  }

  downloadAction.updateTask(id, {
    status: 'completed',
    isComplate: true,
    progress: 100,
    speed: '',
    statusText: '',
    errorMessage: '',
    retryCount: 0,
    downloaded: total || task.downloaded,
    total: total || task.total,
  })

  // SAF 目录：先把缓存目录里的文件复制到用户选择的目录
  try {
    const savePath = await getSavePath()
    if (isSafPath(savePath)) {
      const tempPath = task.metadata.filePath
      // react-native-fs 的 copyFile 不认 content://，必须走原生的 DocumentsContract 写入
      const targetUri = await copyFileToTree(savePath, task.metadata.fileName, tempPath)
      if (!targetUri) throw new Error('目标目录不可写，请重新选择保存目录')
      await unlink(tempPath).catch(() => {})
      downloadAction.updateTask(id, { metadata: { filePath: targetUri } })
    }
  } catch (err: any) {
    log.error(err)
    downloadAction.updateTask(id, {
      status: 'error',
      isComplate: false,
      errorMessage: `保存文件失败：${err?.message ?? err}`,
    })
    scheduleSave()
    pump()
    return
  }

  const latest = getTask(id)
  if (latest) {
    await writeTaskExtras(latest)
    // 下完立刻收进本地曲库（动态 import：localMusic 也引了这个模块，静态引会成环）
    void import('@/core/localMusic').then(async({ addLocalMusicFile }) => addLocalMusicFile({
      filePath: latest.metadata.filePath,
      name: latest.metadata.fileName,
      singer: latest.metadata.musicInfo.singer,
      size: latest.total,
    })).catch(() => {})
  }
  scheduleSave()
  pump()
}

const handleError = async(id: string, code: number, message: string) => {
  const task = getTask(id)
  if (!task) return

  const retryCount = task.retryCount ?? 0
  if (retryCount < 2) {
    // 链接失效、文件不完整时强制刷新下载地址后重试
    if ([401, 403, 404, 410, 416].includes(code)) refreshingIds.add(id)
    downloadAction.updateTask(id, {
      status: 'waiting',
      statusText: '',
      speed: '',
      retryCount: retryCount + 1,
      errorMessage: message || `下载失败(${code})`,
    })
    setTimeout(() => {
      void startTask(id)
    }, 1500)
    return
  }

  downloadAction.updateTask(id, {
    status: 'error',
    statusText: '',
    speed: '',
    errorMessage: message || `下载失败(${code})`,
  })
  scheduleSave()
  pump()
}

/**
 * 解析歌曲的下载地址，失败时会自动切换其他音源（可在设置中关闭）
 */
const resolveUrl = async(task: LX.Download.ListItem, isRefresh: boolean) => {
  return getOnlineMusicUrl({
    musicInfo: task.metadata.musicInfo,
    quality: task.metadata.quality,
    isRefresh,
    allowToggleSource: settingState.setting['download.isUseOtherSource'],
    onToggleSource: (musicInfo) => {
      if (!musicInfo) return
      downloadAction.updateTask(task.id, { metadata: { musicInfo } })
    },
  })
}

export const ensureDir = async(path: string) => {
  try {
    if (!await existsFile(path)) await mkdir(path)
    if (!await existsFile(path)) return false
    const probe = joinPath(path, '.lx_write_probe')
    await writeFile(probe, '1', 'utf8')
    await unlink(probe).catch(() => {})
    return true
  } catch (err) {
    return false
  }
}

/**
 * 获取实际可用的下载目录
 *
 * 用「单飞 Promise」缓存而不是「先查缓存变量再赋值」：
 * 原来的写法里，多个下载任务同时启动时会各自跑一遍目录探测，
 * 每个都在 await 之后往同一个变量赋值，谁最后写谁生效 ——
 * 并发任务可能拿到不同的目录，文件就分散到两个地方了。
 * 现在第一个调用负责探测，其余调用共享同一个 Promise，结果必然一致。
 */
export const getSavePath = async() => {
  if (!savePathPromise) {
    savePathPromise = resolveSavePath().catch(err => {
      // 探测失败就把缓存清掉，下次重新来，避免把失败结果永久钉住
      savePathPromise = null
      throw err
    })
  }
  return savePathPromise
}

/**
 * 把所有文件访问权限授予之前下载到私有兜底目录的文件迁回默认音乐目录。
 * 需要用户在系统设置里授予「所有文件访问权限」；未授权时直接跳过。
 * 返回实际移动的文件数。
 */
export const migrateFallbackDownloads = async(): Promise<number> => {
  try {
    if (!(await isExternalStorageManager())) return 0
    const fallback = getFallbackSavePath()
    const target = getDefaultSavePath()
    if (!await existsFile(fallback)) return 0
    if (!await ensureDir(target)) return 0
    const entries = await readDir(fallback) as Array<{ name: string, path: string, isDirectory?: boolean }>
    let moved = 0
    for (const entry of entries) {
      if (entry.isDirectory) continue
      try {
        await moveFile(entry.path, joinPath(target, entry.name))
        moved++
      } catch (err) {
        log.error(err)
      }
    }
    return moved
  } catch (err) {
    log.error(err)
    return 0
  }
}

let didWarnFallback = false

const resolveSavePath = async(): Promise<string> => {
  const configured = settingState.setting['download.savePath']
  if (configured) {
    if (isSafPath(configured)) return configured
    if (await ensureDir(configured)) return configured
  }
  const defaultPath = getDefaultSavePath()
  if (await ensureDir(defaultPath)) return defaultPath
  const fallbackPath = getFallbackSavePath()
  await ensureDir(fallbackPath)
  if (!didWarnFallback) {
    didWarnFallback = true
    toast('未授予「所有文件访问权限」，歌曲会先保存到应用专属目录；到 设置→下载设置 授权后可自动迁回默认音乐目录', 'long')
  }
  return fallbackPath
}

export const clearSavePathCache = () => {
  savePathPromise = null
}

/**
 * 开始一个下载任务
 */
export const startTask = async(id: string) => {
  if (runningIds.has(id)) return
  const task = getTask(id)
  if (!task || task.isComplate) return

  runningIds.add(id)
  downloadAction.updateTask(id, { status: 'run', statusText: '获取下载地址中...', errorMessage: '' })

  try {
    const savePath = await getSavePath()
    const filePath = isSafPath(savePath)
      ? joinPath(getTempDownloadPath(), task.metadata.fileName)
      : joinPath(savePath, task.metadata.fileName)
    downloadAction.updateTask(id, { metadata: { filePath } })

    const isRefresh = refreshingIds.has(id)
    refreshingIds.delete(id)
    const url = await resolveUrl(task, isRefresh)
    downloadAction.updateTask(id, { metadata: { url }, statusText: '' })
    nativeStartTask({ id, url, path: filePath })
  } catch (err: any) {
    runningIds.delete(id)
    log.error(err)
    void handleError(id, -1, String(err?.message ?? err))
  }
}

/**
 * 按并发数启动等待中的任务
 */
export const pump = () => {
  if (!inited) return
  const max = Math.max(1, settingState.setting['download.maxDownloadNum'] || 3)
  let available = max - runningIds.size
  if (available <= 0) return
  for (const task of downloadState.list) {
    if (available <= 0) break
    if (task.isComplate || runningIds.has(task.id)) continue
    if (task.status !== 'waiting') continue
    available--
    void startTask(task.id)
  }
}

export const pauseTask = (id: string) => {
  const task = getTask(id)
  if (!task) return
  runningIds.delete(id)
  try {
    nativePauseTask(id)
  } catch (err) {
    log.error(err)
  }
  downloadAction.updateTask(id, { status: 'pause', speed: '', statusText: '' })
  scheduleSave()
  pump()
}

export const removeTask = (id: string, isRemoveFile = true) => {
  const task = getTask(id)
  if (!task) return
  const isActive = task.status === 'run' || task.status === 'waiting'
  runningIds.delete(id)
  refreshingIds.delete(id)
  if (isActive) {
    try {
      nativeRemoveTask(id)
    } catch (err) {
      log.error(err)
    }
  }
  if (isRemoveFile && task.metadata.filePath) {
    void unlink(task.metadata.filePath).catch(() => {})
  }
  downloadAction.removeTasks([id])
  scheduleSave()
  pump()
}

export const retryTask = async(id: string) => {
  const task = getTask(id)
  if (!task) return
  refreshingIds.add(id)
  // 重新下载前先删掉旧文件，否则会被当作已完成
  if (task.isComplate && task.metadata.filePath) {
    await unlink(task.metadata.filePath).catch(() => {})
  }
  downloadAction.updateTask(id, {
    status: 'waiting',
    isComplate: false,
    retryCount: 0,
    errorMessage: '',
    speed: '',
    statusText: '',
    progress: 0,
    downloaded: 0,
    total: 0,
  })
  pump()
}

export const startAll = () => {
  for (const task of downloadState.list) {
    if (task.isComplate) continue
    if (task.status === 'run') continue
    downloadAction.updateTask(task.id, { status: 'waiting', retryCount: 0, errorMessage: '' })
  }
  pump()
}

export const pauseAll = () => {
  for (const id of [...runningIds]) {
    try {
      nativePauseTask(id)
    } catch (err) {
      log.error(err)
    }
  }
  runningIds.clear()
  for (const task of downloadState.list) {
    if (task.isComplate) continue
    if (task.status !== 'run' && task.status !== 'waiting') continue
    downloadAction.updateTask(task.id, { status: 'pause', speed: '', statusText: '' })
  }
  scheduleSave()
}

export const clearCompleted = () => {
  downloadAction.clearCompleted()
  scheduleSave()
}

export const removeAll = () => {
  for (const task of [...downloadState.list]) {
    removeTask(task.id)
  }
}

export interface AddTasksOptions {
  quality?: LX.Quality
  listId?: string | null
  autoStart?: boolean
}

/**
 * 添加下载任务
 * @returns 实际添加的任务数量（已存在或无法下载的歌曲会被跳过）
 */
export const addTasks = (musicInfos: LX.Music.MusicInfoOnline[], options: AddTasksOptions = {}) => {
  const setting = settingState.setting
  const targetQuality = options.quality ?? setting['download.quality']
  const existIds = new Set(downloadState.list.map(task => task.id))
  const tasks: LX.Download.ListItem[] = []
  const now = Date.now()

  for (const musicInfo of musicInfos) {
    if (!musicInfo) continue
    const quality = getMusicType(musicInfo, targetQuality, global.lx.qualityList)
    const ext = getExt(quality)
    const id = buildTaskId(musicInfo, quality, ext)
    if (existIds.has(id)) continue
    existIds.add(id)
    tasks.push({
      id,
      isComplate: false,
      status: 'waiting',
      statusText: '',
      downloaded: 0,
      total: 0,
      progress: 0,
      speed: '',
      retryCount: 0,
      createdAt: now,
      metadata: {
        musicInfo,
        url: null,
        quality,
        ext,
        fileName: buildFileName(musicInfo, ext, setting['download.fileName']),
        filePath: '',
        listId: options.listId ?? null,
      },
    })
  }

  if (!tasks.length) return 0
  downloadAction.addTasks(tasks)
  scheduleSave()
  if (options.autoStart !== false) pump()
  return tasks.length
}

export const getRunningCount = () => runningIds.size

export const isInited = () => inited
