import settingState from '@/store/setting/state'
import { action as downloadAction, state as downloadState } from '@/store/download'
import { getDownloadList, saveDownloadList } from '@/utils/data'
import { resolveMusicUrl } from '@/core/music/online'
import { getSourceName } from '@/core/music/utils'
import {
  onDownloadEvent,
  scanFile as scanMediaFile,
  startTask as nativeStartTask,
  pauseTask as nativePauseTask,
  removeTask as nativeRemoveTask,
  pauseAll as nativePauseAll,
  type DownloadEventPayload,
} from '@/utils/nativeModules/download'
import { existsFile, mkdir, moveFile, readDir, stat, unlink, writeFile } from '@/utils/fs'
import { copyFileToTree, deleteDocument, documentUriToRealPath, findAudioByPath } from '@/utils/directoryPicker'
import { writeTaskExtras } from './extras'
import { detectAudioContainer, type DetectedAudioFormat } from './format'
import {
  buildFileName,
  buildTaskId,
  clipFileName,
  filterFileName,
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
import RNFS from 'react-native-fs'

/** 正在下载的任务 id */
const runningIds = new Set<string>()
/** 需要在下次开始时强制刷新下载地址的任务 id */
const refreshingIds = new Set<string>()
/** 下一次解析下载地址时强制跳过当前音源（内容与声称音质不符时优先换源重试） */
const forceToggleIds = new Set<string>()
/** 「文件实际格式不对」类问题最多重试几次（沿用 retryCount，避免死循环） */
const MAX_MEDIA_RETRY = 2

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

  // 去重：检查下载列表中是否已有该歌曲（任意音质）。
  // 换源后任务里的 musicInfo 可能已经变成别的音源（id 不同），所以还要按歌名+歌手兜一层，
  // 否则同一首歌会被反复加入下载队列
  const musicId = musicInfo.id
  const exists = downloadState.list.some(task =>
    task.metadata.musicInfo.id === musicId ||
    (task.metadata.musicInfo.name === musicInfo.name && task.metadata.musicInfo.singer === musicInfo.singer),
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
  forceToggleIds.clear()
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

/** 只读文件头 16 字节：足够覆盖 format.ts 里所有魔数 */
const AUDIO_HEADER_LENGTH = 16

/**
 * 读文件头并嗅探真实容器格式。
 *
 * @returns DetectedAudioFormat / 'invalid' / null（读不到或认不出，调用方保持原逻辑）
 */
const detectAudioFileFormat = async(filePath: string): Promise<DetectedAudioFormat | 'invalid' | null> => {
  // content:// 文档 uri（SAF 目录成品）没法直接按路径读；SAF 下载在复制前是普通临时路径，仍可嗅探
  if (!filePath || isSafPath(filePath)) return null
  let header: Buffer
  try {
    // RNFS.read 用 base64 取二进制：'ID3' / 0xFF 这类字节在 utf8 下会失真
    const base64 = await RNFS.read(filePath, AUDIO_HEADER_LENGTH, 0, 'base64')
    if (!base64) return null
    header = Buffer.from(base64, 'base64')
  } catch {
    return null
  }
  return detectAudioContainer(header)
}

/**
 * 丢弃一个内容有问题的文件并退回等待队列重下。
 *
 * 用于两种「URL 请求成功、但文件不能用」的情况：
 *   - 下载到的是 HTML 错误页 / 非音频内容（invalid）；
 *   - 源脚本声称 flac、实际给的是 mp3（格式与音质不符）。
 * 会清掉坏文件和 .part、强制刷新地址；`forceToggle` 为 true 时下次直接换源
 * （音源给的内容本身错了，继续重试同一个音源没有意义）。
 */
const requeueBadFile = async(
  id: string,
  task: LX.Download.ListItem,
  errorMessage: string,
  options: { forceToggle?: boolean, retryCount?: number, finalErrorMessage?: string } = {},
) => {
  const filePath = task.metadata.filePath
  if (filePath) {
    await unlink(filePath).catch(() => {})
    await unlink(`${filePath}.part`).catch(() => {})
  }
  const retryCount = options.retryCount ?? (task.retryCount ?? 0) + 1
  // 重试上限沿用 retryCount：重下几次都还是坏内容就停下来报错，避免无限循环
  if (retryCount > MAX_MEDIA_RETRY) {
    downloadAction.updateTask(id, {
      status: 'error',
      isComplate: false,
      speed: '',
      statusText: '',
      errorMessage: options.finalErrorMessage ?? errorMessage,
    })
    scheduleSave()
    pump()
    return
  }
  if (options.forceToggle) forceToggleIds.add(id)
  refreshingIds.add(id)
  downloadAction.updateTask(id, {
    status: 'waiting',
    isComplate: false,
    progress: 0,
    downloaded: 0,
    total: 0,
    speed: '',
    statusText: '',
    retryCount,
    errorMessage,
  })
  setTimeout(() => { void startTask(id) }, 1200)
}

/**
 * 下载完成后校正「源脚本声称的音质」与「文件真实容器」不一致的问题。
 *
 * 线上实际案例：音源声称 flac，落盘却是 ID3（MP3）——
 * 写标签/封面的原生模块按扩展名选解析器，直接报 `FlacHeader not found`，
 * 标签和封面全丢；本地曲库还把 MP3 标成 FLAC。
 *
 * 处理策略：
 *   1. 真实格式与计划扩展名一致 → 什么都不做；
 *   2. 不一致 → 先按设置换源/刷新地址重下一次（retryCount ≤ 2）；
 *   3. 重试后仍不一致（或达到重试上限）→ 以真实格式为准改扩展名/文件名/路径 +
 *      同步 metadata.quality，保证标签能写、曲库标对；
 *   4. 明显不是音频（HTML 错误页）→ 一律按失败处理：删文件、重试/换源，绝不入库。
 *
 * @returns 'stop' 表示已经安排重试或已置为失败，调用方直接返回；'ok' 继续后续流程
 */
const reconcileDownloadedFormat = async(id: string, task: LX.Download.ListItem): Promise<'ok' | 'stop'> => {
  const filePath = task.metadata.filePath
  // 空路径 / SAF 文档 uri 读不了文件头：保留原逻辑，不做回归
  if (!filePath || isSafPath(filePath)) return 'ok'
  const detected = await detectAudioFileFormat(filePath).catch(() => null)
  // 识别不出来（未知容器 / 读失败）：宁可不动，也不要误删正常文件
  if (!detected) return 'ok'

  if (detected === 'invalid') {
    log.warn(`downloaded content is not audio, retry with refreshed url: ${filePath}`)
    await requeueBadFile(id, task, '下载到的内容不是音频文件，正在重试', {
      forceToggle: settingState.setting['download.isUseOtherSource'],
      finalErrorMessage: '下载到的内容不是音频文件，请换源或稍后重试',
    })
    return 'stop'
  }

  const plannedExt = task.metadata.ext
  if (detected.ext === plannedExt) return 'ok'

  log.warn(
    `source lied about quality: planned ${plannedExt}/${task.metadata.quality}, ` +
    `actual ${detected.container}(${detected.ext}), file=${filePath}`,
  )

  // 先按设置「换源 / 刷新地址」重下一次：也许只是某个 CDN 或缓存节点给了错误内容
  if ((task.retryCount ?? 0) < MAX_MEDIA_RETRY) {
    await requeueBadFile(id, task, `文件实际格式为 ${detected.ext.toUpperCase()}，与所选音质不符，正在重试`, {
      forceToggle: settingState.setting['download.isUseOtherSource'],
    })
    return 'stop'
  }

  // 重试后仍不符：以真实格式为准改名，让写标签 / 封面 / 播放都能正确识别
  const lastSlash = filePath.lastIndexOf('/')
  const dir = lastSlash > 0 ? filePath.slice(0, lastSlash) : ''
  const currentName = task.metadata.fileName || filePath.slice(lastSlash + 1)
  const baseName = currentName.replace(/\.[^.]+$/, '')
  const newFileName = clipFileName(filterFileName(`${baseName}.${detected.ext}`))
  const newFilePath = joinPath(dir, newFileName)

  let finalFileName = currentName
  let finalFilePath = filePath
  if (newFilePath !== filePath) {
    try {
      // 改名到真实扩展名：同目录 rename，目标已存在先删掉（避免 move 失败）
      await unlink(newFilePath).catch(() => {})
      await moveFile(filePath, newFilePath)
      finalFileName = newFileName
      finalFilePath = newFilePath
    } catch (err) {
      // 改名失败也不阻断：至少把曲库音质标记改对，写标签失败会留日志
      log.error(`rename downloaded file to actual format failed: ${filePath} -> ${newFilePath}`, err)
    }
  }

  downloadAction.updateTask(id, {
    metadata: {
      // 容器可能是 m4a/ogg/aac（超出 FileExt 枚举），运行时以下载文件真实扩展名为准
      ext: detected.ext as LX.Download.FileExt,
      fileName: finalFileName,
      filePath: finalFilePath,
      quality: detected.quality,
    },
  })
  log.warn(`downloaded file format corrected to ${detected.container}, quality=${detected.quality}`)

  if (finalFilePath !== filePath) {
    // 旧扩展名的文件已经不在那个路径了：把媒体库里的旧记录清掉、再把新路径扫进去，
    // 否则重新扫描本地音乐时会同时看到一个指向不存在文件的旧条目
    const removeStaleMediaEntry = async() => {
      try {
        const oldItem = await findAudioByPath(filePath)
        if (oldItem?.contentUri) void deleteDocument(oldItem.contentUri)
      } catch {}
    }
    void removeStaleMediaEntry()
    // MediaScanner 是异步的：改名时旧路径的索引可能还没建出来，
    // 稍后再补删一次，避免留下「有记录、没文件」的幽灵条目
    setTimeout(() => { void removeStaleMediaEntry() }, 2500)
    void scanMediaFile(finalFilePath)
  }
  return 'ok'
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

  // 嗅探真实容器格式并校正：源脚本可能「声称 flac、实际给 mp3」，
  // 不修正会导致写标签失败、曲库音质标错（见 reconcileDownloadedFormat）
  const formatStatus = await reconcileDownloadedFormat(id, task)
  if (formatStatus === 'stop') return
  // 上面可能改了 metadata（扩展名 / 文件名 / 路径 / 音质），后续一律用最新任务对象
  const current = getTask(id) ?? task

  downloadAction.updateTask(id, {
    status: 'completed',
    isComplate: true,
    progress: 100,
    speed: '',
    statusText: '',
    errorMessage: '',
    retryCount: 0,
    downloaded: total || current.downloaded,
    total: total || current.total,
  })

  // SAF 目录：先把缓存目录里的文件复制到用户选择的目录
  try {
    const savePath = await getSavePath()
    if (isSafPath(savePath)) {
      const tempPath = current.metadata.filePath
      // react-native-fs 的 copyFile 不认 content://，必须走原生的 DocumentsContract 写入
      const targetUri = await copyFileToTree(savePath, current.metadata.fileName, tempPath)
      if (!targetUri) throw new Error('目标目录不可写，请重新选择保存目录')
      await unlink(tempPath).catch(() => {})
      downloadAction.updateTask(id, { metadata: { filePath: targetUri } })
      // 复制进 SAF 目录的文件不走原生下载模块，没人触发索引；
      // 能还原出真实路径就补一次 MediaStore 扫描，否则靠 SAF 枚举也能扫到
      const realPath = documentUriToRealPath(targetUri)
      if (realPath) void scanMediaFile(realPath)
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

  // 先把队列推进起来：写标签 / 封面要联网，可能等好几秒，
  // 不能让后面的等待任务跟着一起卡住
  scheduleSave()
  pump()

  const latest = getTask(id)
  if (latest) {
    // 写标签 / 封面：失败只记日志，不能阻断入库 ——
    // 以前这里没包 try，一旦原生写标签抛错后面「加入曲库」就整段不执行了
    try {
      await writeTaskExtras(latest)
    } catch (err) {
      log.error('write download extras failed', err)
    }
    // 下完立刻收进本地曲库（动态 import：localMusic 也引了这个模块，静态引会成环）
    void addDownloadedToLibrary(latest)
  }
}

/**
 * 下载完成后把单个文件收进本地曲库。
 *
 * 以前是 `import(...).then(addLocalMusicFile).catch(() => {})`：
 * 出任何错都被静默吞掉，用户看到的就是「下载完成但本地音乐里没有」。
 * 现在失败会记日志并重试两次（动态 import 本身也不会失败，主要是入库过程中的存储错误）。
 */
const addDownloadedToLibrary = async(task: LX.Download.ListItem, attempt = 0): Promise<void> => {
  try {
    const { addLocalMusicFile } = await import('@/core/localMusic')
    await addLocalMusicFile({
      filePath: task.metadata.filePath,
      name: task.metadata.fileName,
      singer: task.metadata.musicInfo.singer,
      size: task.total || undefined,
      // 下载任务本来就知道封面地址，传给入库流程优先使用（省得再联网搜一次）
      picUrl: task.metadata.musicInfo.meta.picUrl ?? undefined,
    })
  } catch (err) {
    log.error(`add downloaded music to local library failed (attempt ${attempt + 1})`, err)
    if (attempt < 2) {
      setTimeout(() => { void addDownloadedToLibrary(task, attempt + 1) }, 2000)
    }
  }
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
 *
 * 注意：这里不能提前改任务 metadata。备选音源可能最终也拿不到地址，
 * 一旦把 candidate 写进 metadata，失败后重试就会从错误的音源 / 文件名开始。
 * 真正的落定在 startTask 拿到解析结果之后。
 */
const resolveUrl = async(task: LX.Download.ListItem, isRefresh: boolean) => {
  // 文件内容与声称音质不符时，上一次已经标记「下一次换源」：跳过当前音源直接找备选
  const forceToggleSource = forceToggleIds.has(task.id)
  forceToggleIds.delete(task.id)
  return resolveMusicUrl({
    musicInfo: task.metadata.musicInfo,
    quality: task.metadata.quality,
    isRefresh,
    allowToggleSource: settingState.setting['download.isUseOtherSource'],
    forceToggleSource,
    onToggleSource: (musicInfo) => {
      if (!musicInfo) return
      downloadAction.updateTask(task.id, {
        statusText: `正在切换音源：${getSourceName(musicInfo.source)}`,
      })
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
        const targetPath = joinPath(target, entry.name)
        await moveFile(entry.path, targetPath)
        // 迁移到公共目录后系统同样不会自动索引，补一次扫描
        void scanMediaFile(targetPath)
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
 *
 * 顺序很重要：**先解析地址，再按实际音质定文件名/扩展名**。
 * 换源后实际音质可能低于请求音质（例如请求 flac、备选音源只有 320k），
 * 如果沿用最初规划的文件名，就会下出一个「.flac 后缀、内容是 mp3」的文件，
 * 本地扫描按扩展名入库后播放器打不开。
 */
export const startTask = async(id: string) => {
  if (runningIds.has(id)) return
  const task = getTask(id)
  if (!task || task.isComplate) return

  runningIds.add(id)
  downloadAction.updateTask(id, { status: 'run', statusText: '获取下载地址中...', errorMessage: '' })

  try {
    const isRefresh = refreshingIds.has(id)
    refreshingIds.delete(id)
    const savePath = await getSavePath()
    const resolved = await resolveUrl(task, isRefresh)
    const latest = getTask(id)
    // 解析地址期间任务可能被删除 / 已完成
    if (!latest) {
      runningIds.delete(id)
      return
    }

    const isSaf = isSafPath(savePath)
    // 以解析结果为准：换源 / 音质降级会改变扩展名，文件名与目标路径要跟着变
    const quality = resolved.quality
    const ext = getExt(quality)
    const musicInfo = resolved.musicInfo
    const fileName = buildFileName(musicInfo, ext, settingState.setting['download.fileName'])
    const filePath = isSaf
      ? joinPath(getTempDownloadPath(), fileName)
      : joinPath(savePath, fileName)

    const oldPath = latest.metadata.filePath
    if (oldPath && oldPath !== filePath) {
      // 目标文件变了（换源降级 / 歌手名带进文件名）：旧的正式文件和断点残留都作废，
      // 否则原生层会认为「文件已存在」直接报完成，或者把两个文件的内容拼到一起
      await unlink(oldPath).catch(() => {})
      await unlink(`${oldPath}.part`).catch(() => {})
    } else if (isRefresh) {
      // 刷新下载地址（链接过期 / 换源）：不同 CDN 的分片不保证一致，必须从头下
      await unlink(filePath).catch(() => {})
      await unlink(`${filePath}.part`).catch(() => {})
    }

    const qualityChanged = quality !== latest.metadata.quality ||
      ext !== latest.metadata.ext ||
      fileName !== latest.metadata.fileName
    downloadAction.updateTask(id, {
      metadata: {
        // 换源后实际音源信息、音质、扩展名、文件名、路径一起落定
        ...(musicInfo !== latest.metadata.musicInfo ? { musicInfo } : {}),
        ...(qualityChanged ? { quality, ext, fileName } : {}),
        filePath,
        url: resolved.url,
      },
      statusText: '',
    })
    nativeStartTask({ id, url: resolved.url, path: filePath })
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
  forceToggleIds.delete(id)
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
    // 残留的 .part 会和新的下载内容拼错，必须一起清
    await unlink(`${task.metadata.filePath}.part`).catch(() => {})
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
