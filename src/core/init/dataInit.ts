// import { getPlayInfo } from '@/utils/data'
// import { log } from '@/utils/log'
import { init as musicSdkInit } from '@/utils/musicSdk'
import { getUserLists, setUserList, getListMusics, overwriteListMusics } from '@/core/list'
import { getLocalMusicList } from '@/core/localMusic'
import { setNavActiveId } from '../common'
import { getViewPrevState } from '@/utils/data'
import { bootLog } from '@/utils/bootLog'
import { getDislikeInfo, setDislikeInfo } from '@/core/dislikeList'
import { unlink } from '@/utils/fs'
import { TEMP_FILE_PATH } from '@/utils/tools'
// import { play, playList } from '../player/player'

// const initPrevPlayInfo = async(appSetting: LX.AppSetting) => {
//   const info = await getPlayInfo()
//   global.lx.restorePlayInfo = null
//   if (!info?.listId || info.index < 0) return
//   const list = await getListMusics(info.listId)
//   if (!list[info.index]) return
//   global.lx.restorePlayInfo = info
//   await playList(info.listId, info.index)

//   if (appSetting['player.startupAutoPlay']) setTimeout(play)
// }

export default async(appSetting: LX.AppSetting) => {
  // await Promise.all([
  //   initUserApi(), // 自定义API
  // ]).catch(err => log.error(err))
  void musicSdkInit() // 初始化音乐sdk
  bootLog('User list init...')
  const userLists = await getUserLists()
  setUserList(userLists) // 获取用户列表
  // 修复历史版本可能写入的损坏条目（缺 source/meta 的精简 MusicInfo）：
  // 能按 id 从本地曲库找回完整条目就替换，否则移除，避免歌单播放/收藏页崩溃。
  void (async() => {
    try {
      const local = await getLocalMusicList()
      const byId = new Map(local.map(item => [item.id, item]))
      const byPath = new Map(local.map(item => [item.meta?.filePath, item]).filter(([, item]) => !!item) as Array<[string, LX.Music.MusicInfoLocal]>)
      for (const list of userLists.slice(2)) {
        const musics = await getListMusics(list.id)
        let changed = false
        const next = musics.flatMap(item => {
          if (item.source && item.meta) return [item]
          changed = true
          const legacyPath = item.id.startsWith('local_') ? item.id.slice(6) : ''
          const full = byId.get(item.id) ?? byPath.get(legacyPath)
          return full ? [full] : []
        })
        if (changed) await overwriteListMusics(list.id, next)
      }
    } catch {}
  })()
  setDislikeInfo(await getDislikeInfo()) // 获取不喜欢列表
  bootLog('User list inited.')
  // 冷启动固定回首页，不再恢复上次停留的 tab
  await getViewPrevState().catch(() => null)
  setNavActiveId('nav_home')
  void unlink(TEMP_FILE_PATH)
  // await initPrevPlayInfo(appSetting).catch(err => log.error(err)) // 初始化上次的歌曲播放信息
}
