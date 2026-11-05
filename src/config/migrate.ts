import { compareVer, filterMusicList, toNewMusicInfo } from '@/utils'
import { LIST_IDS, storageDataPrefix, storageDataPrefixOld } from '@/config/constant'
import { getAllKeys, getData, getDataMultiple, removeData, saveData } from '@/plugins/storage'
import { allMusicList, listDataOverwrite, userLists } from '@/utils/listManage'
import { saveListMusics, saveUserList } from '@/utils/data'


/**
 * 设置项的一次性版本迁移（每次启动初始化时跑一次，靠 version 保证幂等）。
 *
 * 老用户存储里已经有旧的默认值，而 mergeSetting 会优先保留用户已存的值 ——
 * 只改 defaultSetting 对老用户不生效，所以这里按设置版本号做迁移。
 * 每段只负责自己那个版本区间的字段，其它设置项原样保留；迁移完 version 会写成
 * 当前 defaultSetting.version，下次启动不会再跑；用户之后手动改的值也不会被覆盖。
 *
 * v2.2：
 *  - 底部胶囊的默认进度样式从「胶囊描边(border)」改成「封面圆环(ring)」；
 *  - 歌词翻译默认开启（外文歌词下方显示中文翻译，源/补翻译有 tlyric 时生效）。
 *
 * v2.3：
 *  - 「胶囊描边」功能整体下线（用户要求去掉），设置里只留「封面圆环 / 关闭」；
 *    version < 2.3 的存量设置里如果是 'border'（包括 v2.2 时手动改回 border 的）
 *    统一归到 'ring'；用户自己选的 'none' 保留，不动。
 */
export const migrateSettingValues = <T extends Partial<LX.AppSetting> | null>(setting: T): T => {
  if (!setting) return setting
  const version = setting.version ?? '0'

  // v2.2：歌词翻译默认开启
  // （v2.2 引入的 border→ring 迁移合并到下面的 2.3 段，覆盖所有 <2.3 的旧版本，避免重复判断）
  if (compareVer(version, '2.2') < 0) {
    setting['player.isShowLyricTranslation'] = true
  }

  // v2.2/v2.3：「胶囊描边」从默认值变成下线功能，存量 border 一律回封面圆环
  // （version < 2.2 也小于 2.3，所以这里同时覆盖 v2.2 的 border→ring，不会漏）
  // 类型里已收窄为 ring/none，但存量数据里可能是已下线的旧值 'border'，判等时放宽成 string
  const storedProgressStyle: string | undefined = setting['common.navProgressStyle']
  if (compareVer(version, '2.3') < 0 && storedProgressStyle === 'border') {
    setting['common.navProgressStyle'] = 'ring'
  }

  return setting
}

interface OldUserListInfo {
  name: string
  id: string
  source?: LX.OnlineSource
  sourceListId?: string
  locationUpdateTime?: number
  list: any[]
}


/* export const migrateListData = async() => {
  let playList = await parseDataFile<{ defaultList?: { list: any[] }, loveList?: { list: any[] }, tempList?: { list: any[] }, userList?: OldUserListInfo[] }>('playList.json')
  let listDataAll: LX.List.ListDataFull = {
    defaultList: [],
    loveList: [],
    userList: [],
    tempList: [],
  }
  let isRequiredSave = false
  if (playList) {
    if (playList.defaultList) listDataAll.defaultList = filterMusicList(playList.defaultList.list.map(m => toNewMusicInfo(m)))
    if (playList.loveList) listDataAll.loveList = filterMusicList(playList.loveList.list.map(m => toNewMusicInfo(m)))
    if (playList.tempList) listDataAll.tempList = filterMusicList(playList.tempList.list.map(m => toNewMusicInfo(m)))
    if (playList.userList) {
      listDataAll.userList = playList.userList.map(l => {
        return {
          ...l,
          locationUpdateTime: l.locationUpdateTime ?? null,
          list: filterMusicList(l.list.map(m => toNewMusicInfo(m))),
        }
      })
    }
    isRequiredSave = true
  } else {
    const config = await parseDataFile<{ list?: { defaultList?: any[], loveList?: any[] } }>('config.json')
    if (config?.list) {
      const list = config.list
      if (list.defaultList) listDataAll.defaultList = filterMusicList(list.defaultList.map(m => toNewMusicInfo(m)))
      if (list.loveList) listDataAll.loveList = filterMusicList(list.loveList.map(m => toNewMusicInfo(m)))
      isRequiredSave = true
    }
  }
  if (isRequiredSave) await global.lx.worker.dbService.listDataOverwrite(listDataAll)

  const lyricData = await parseDataFile<Record<string, LX.Music.LyricInfo>>('lyrics_edited.json')
  if (lyricData) {
    for await (const [id, info] of Object.entries(lyricData)) {
      await global.lx.worker.dbService.editedLyricAdd(id, info)
    }
  }
}
 */
export const getAllListData = async(): Promise<{
  defaultList?: { list: any[] }
  loveList?: { list: any[] }
  tempList?: { list: any[] }
  userList?: OldUserListInfo[]
}> => {
  const defaultListKey = storageDataPrefixOld.list + 'default'
  const loveListKey = storageDataPrefixOld.list + 'love'
  let defaultList
  let loveList
  let userList = []
  let keys = await getAllKeys()
  const listKeys: string[] = []
  for (const key of keys) {
    if (key.startsWith(storageDataPrefixOld.list)) {
      listKeys.push(key)
    }
  }
  const listData = await getDataMultiple(listKeys) as Array<[string, any]>
  for (const [key, value] of listData) {
    switch (key) {
      case defaultListKey:
        defaultList = value
        break
      case loveListKey:
        loveList = value
        break
      default:
        userList.push(value)
        break
    }
  }

  const listSort: Record<string, number> = await getData(storageDataPrefixOld.listSort) ?? {}

  userList.sort((a, b) => {
    if (listSort[a.id] == null) return listSort[b.id] == null ? -1 : 1
    return listSort[b.id] == null ? 1 : listSort[a.id] - listSort[b.id]
  })
  userList.forEach((list, index) => {
    if (listSort[list.id] == null) {
      listSort[list.id] = index
      delete list.location
    }
  })

  return {
    defaultList,
    loveList,
    userList,
  }
}

/**
 * 迁移 v1.0.0 之前的 list data
 * @returns
 */
export const migrateListData = async() => {
  const playList = await getAllListData()
  let listDataAll: LX.List.ListDataFull = {
    defaultList: [],
    loveList: [],
    userList: [],
    tempList: [],
  }
  if (playList.defaultList) listDataAll.defaultList = filterMusicList(playList.defaultList.list.map(m => toNewMusicInfo(m)))
  if (playList.loveList) listDataAll.loveList = filterMusicList(playList.loveList.list.map(m => toNewMusicInfo(m)))
  if (playList.userList) {
    listDataAll.userList = playList.userList.map(l => {
      return {
        ...l,
        locationUpdateTime: l.locationUpdateTime ?? null,
        list: filterMusicList(l.list.map(m => toNewMusicInfo(m))),
      }
    })
  }
  listDataOverwrite(listDataAll)
  await saveUserList(userLists)
  const allListIds = [LIST_IDS.DEFAULT, LIST_IDS.LOVE, ...userLists.map(l => l.id)]
  await saveListMusics([...allListIds.map(id => ({ id, musics: allMusicList.get(id) as LX.List.ListMusics }))])
  await removeData(storageDataPrefixOld.listSort)

  const listPosition = await getData(storageDataPrefixOld.listPosition)
  if (listPosition != null) {
    await saveData(storageDataPrefix.listScrollPosition, listPosition)
    await removeData(storageDataPrefixOld.listPosition)
  }
}

const timeStr2Intv = (timeStr: string) => {
  let intvArr = timeStr.split(':')
  let intv = 0
  let unit = 1
  while (intvArr.length) {
    intv += parseInt(intvArr.pop()!) * unit
    unit *= 60
  }
  return intv
}
const migratePlayInfo = async() => {
  const playInfo = await getData<any>(storageDataPrefixOld.playInfo)
  if (playInfo == null) return
  if (playInfo.list !== undefined) delete playInfo.list
  if (playInfo.maxTime) playInfo.maxTime = timeStr2Intv(playInfo.maxTime as string)
  await saveData(storageDataPrefix.playInfo, playInfo)
}
/**
 * 迁移 v1.0.0 之前的 meta 数据
 * @returns
 */
export const migrateMetaData = async() => {
  await migratePlayInfo()
  // const [playInfo] = await getDataMultiple([
  //   storageDataPrefixOld.listPosition,
  //   storageDataPrefixOld.playInfo,
  // ])

  // await saveDataMultiple([
  //   // [storageDataPrefix.listScrollPosition, listPosition[1]],
  //   [storageDataPrefix.playInfo, migratePlayInfo(playInfo[1])],
  // ])
  // await removeDataMultiple([
  //   storageDataPrefix.listScrollPosition,
  // ])
}

