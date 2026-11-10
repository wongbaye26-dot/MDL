/* eslint-disable require-atomic-updates -- 引导弹窗是模块级单例开关，跨 await 后赋值只用于防止重复弹出 */
import { getData, saveData } from '@/plugins/storage'
import { isAppDialogAvailable, showAppDialog } from '@/components/common/AppDialog/service'
import { isExternalStorageManager, openAllFilesAccessSettings } from '@/utils/nativeModules/utils'
import { pickDirectory, treeUriToDisplayPath } from '@/utils/directoryPicker'
import { clearSavePathCache, ensureDir, getSavePath } from '@/core/download'
import { openSettingPage, updateSetting } from '@/core/common'
import { state as userApiState } from '@/store/userApi/state'
import { isSafPath } from '@/core/download/utils'
import { toast } from '@/utils/tools'

/** 新手引导是否已完成（'1' = 不再自动弹出；设置里可手动重看） */
const GUIDE_DONE_KEY = 'beginner_guide_done_v1'

let showing = false

const settingDescription = async() => {
  let saveDir = ''
  try {
    const path = await getSavePath()
    saveDir = isSafPath(path) ? treeUriToDisplayPath(path) : path
  } catch {}
  const allFiles = await isExternalStorageManager().catch(() => false)
  return { saveDir, allFiles }
}

/** 选择下载目录：能按路径写就只存路径，否则退回 SAF 授权 */
const chooseDownloadDir = async(close: () => void) => {
  try {
    const picked = await pickDirectory()
    if (!picked) return
    const writable = await ensureDir(picked.path).catch(() => false)
    if (writable) {
      updateSetting({ 'download.savePath': picked.path })
      clearSavePathCache()
      toast(`下载目录已设为「${picked.name}」`)
    } else if (picked.treeUri) {
      updateSetting({ 'download.savePath': picked.treeUri })
      clearSavePathCache()
      toast(`已授权下载目录「${picked.name}」`)
    } else {
      toast('这个目录不可写，换一个试试')
      return
    }
    close()
    const allFiles = await isExternalStorageManager().catch(() => false)
    if (!allFiles) {
      showAppDialog({
        title: '再开一个权限就万无一失',
        message: '开启「所有文件访问权限」后，下载和扫描都直接按路径读写，不会再出现「需要重新授权」。现在去开吗？',
        actions: [
          {
            text: '去开启',
            style: 'primary',
            onPress: () => { void openAllFilesAccessSettings() },
          },
          { text: '以后再说', style: 'cancel' },
        ],
      })
    }
  } catch {}
}

/** 下载目录这一步：显示当前目录 + 全盘访问状态 */
const showDownloadStep = async() => {
  const { saveDir, allFiles } = await settingDescription()
  const lines = [
    saveDir ? `当前保存位置：${saveDir}` : '还没有设置保存位置',
    allFiles ? '已开启「所有文件访问权限」，目录可以直接读写' : '建议开启「所有文件访问权限」，否则授权会反复失效',
    '',
    '设置好之后：下载的歌会出现在本地音乐里，重扫也不会再提示授权失败。',
  ]
  showAppDialog({
    title: '第二步：设置下载目录',
    message: lines.join('\n'),
    bgClose: false,
    actions: [
      {
        text: '选择目录',
        style: 'primary',
        onPress: () => { chooseDownloadDir(() => { void finishGuide() }).catch(() => {}) },
      },
      {
        text: allFiles ? '重新检查' : '开启全盘访问',
        onPress: () => {
          openAllFilesAccessSettings().then(() => { void showDownloadStep() }).catch(() => {})
        },
      },
      { text: '完成', style: 'cancel', onPress: () => { void finishGuide() } },
    ],
  })
}

/** 音源这一步：内置音源已可用，自定义音源可选 */
const showSourceStep = (withDownload: boolean) => {
  const imported = userApiState.list.length
  const message = [
    '内置音源（酷我 / 酷狗 / QQ / 网易 / 咪咕）装好就能用，排行榜、歌单广场可以直接播放。',
    imported > 0 ? `已导入 ${imported} 个自定义音源脚本。` : '想要更多搜索来源或更高音质，可以导入自定义音源脚本（.js）。',
    '',
    withDownload
      ? '确认音源后，下一步再设置下载目录。'
      : '到这里就可以在线听歌了，随时能在 设置 → 音源管理 里补充音源。',
  ].join('\n')
  showAppDialog({
    title: '第一步：确认音源',
    message,
    bgClose: false,
    actions: [
      {
        text: '去音源管理',
        style: 'primary',
        onPress: () => {
          openSettingPage('sourcesearch')
          void finishGuide()
        },
      },
      {
        text: withDownload ? '下一步' : '知道了',
        onPress: () => { withDownload ? showDownloadStep().catch(() => {}) : finishGuide().catch(() => {}) },
      },
    ],
  })
}

const finishGuide = async() => {
  await saveData(GUIDE_DONE_KEY, '1')
  showing = false
}

/**
 * 新手引导：首次启动（或手动重看）时，按「只用在线听 / 在线听 + 下载」
 * 两种使用方式给出对应提示，避免新用户直接撞上「音源没配 / 下载目录没授权」。
 */
export const showBeginnerGuide = async(force = false) => {
  if (showing) return
  if (!isAppDialogAvailable()) return
  showing = true
  if (!force) {
    const done = await getData(GUIDE_DONE_KEY).catch(() => null)
    if (done) {
      showing = false
      return
    }
  }
  showAppDialog({
    title: '欢迎使用 Emo音乐',
    message: [
      '先选一下你的使用方式，我们只提示你需要的一步：',
      '',
      '· 在线听歌  → 确认音源可用',
      '· 在线听歌 + 下载  → 再设置一个下载目录',
    ].join('\n'),
    bgClose: false,
    actions: [
      {
        text: '只在线听歌',
        style: 'primary',
        onPress: () => { showSourceStep(false) },
      },
      {
        text: '听歌 + 下载',
        onPress: () => { showSourceStep(true) },
      },
      {
        text: '稍后再说',
        style: 'cancel',
        onPress: () => { finishGuide().catch(() => {}) },
      },
    ],
  })
}
