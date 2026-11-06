import { getPlayInfo } from '@/utils/data'
import { existsFile } from '@/utils/fs'
import { getListMusics } from '@/core/list'
import { playList, play } from '@/core/player/player'


export default async(setting: LX.AppSetting) => {
  const info = await getPlayInfo()
  global.lx.restorePlayInfo = null
  if (!info?.listId || info.index < 0) return

  const list = await getListMusics(info.listId)
  if (!list[info.index]) return

  /*
    队列恢复（D-15）：本地文件可能在退出期间被删除/移走，直接播会报错。
    从保存位置往后找第一首「本地文件还在」的歌；全部失效就放弃恢复，
    避免启动时弹一个播放失败。
  */
  let index = info.index
  const isLocalFileMissing = async(item: typeof list[number]) => {
    if (!item || !('source' in item) || item.source !== 'local') return false
    const filePath = item.meta.filePath
    if (!filePath || filePath.startsWith('content://')) return false
    return !(await existsFile(filePath).catch(() => false))
  }
  while (index < list.length && await isLocalFileMissing(list[index])) index += 1
  if (index >= list.length) {
    global.lx.restorePlayInfo = null
    return
  }
  info.index = index
  global.lx.restorePlayInfo = info

  await playList(info.listId, index)

  if (setting['player.startupAutoPlay']) setTimeout(play)


  // if (!info.list || !info.list[info.index]) {
  //   const info2 = { ...info }
  //   if (info2.list) {
  //     info2.music = info2.list[info2.index]?.name
  //     info2.list = info2.list.length
  //   }
  //   toast('恢复播放数据失败，请去错误日志查看', 'long')
  //   log.warn('Restore Play Info failed: ', JSON.stringify(info2, null, 2))

  //   return
  // }

  // let setting = store.getState().common.setting
  // global.restorePlayInfo = {
  //   info,
  //   startupAutoPlay: setting.startupAutoPlay,
  // }

  // store.dispatch(playerAction.setList({
  //   list: {
  //     list: info.list,
  //     id: info.listId,
  //   },
  //   index: info.index,
  // }))
}
