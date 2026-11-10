import { exitApp as utilExitApp } from '@/utils/nativeModules/utils'
import { destroy as destroyPlayer } from '@/plugins/player/utils'
import { initSetting as initAppSetting } from '@/config/setting'
import { setLanguage as applyLanguage } from '@/lang/i18n'

import settingActions from '@/store/setting/action'
import settingState from '@/store/setting/state'
import commonActions from '@/store/common/action'
import commonState, { type InitState as CommonStateType } from '@/store/common/state'

import { storageDataPrefix } from '@/config/constant'
import { saveData } from '@/plugins/storage'
import { throttle } from '@/utils/common'
import { getSelectedManagedFolder, saveFontSize, saveViewPrevState, setSelectedManagedFolder } from '@/utils/data'
import { showPactModal as handleShowPactModal } from '@/navigation'
import { getPersistedUriList, selectManagedFolder } from '@/utils/fs'


const throttleSaveSetting = throttle(() => {
  void saveData(storageDataPrefix.setting, settingState.setting)
})

/**
 * 初始化设置
 */
export const initSetting = async() => {
  const setting = (await initAppSetting()).setting
  settingActions.updateSetting(setting)
  return setting
}

/**
 * 更新设置
 * @param setting 新设置
 */
export const updateSetting = (setting: Partial<LX.AppSetting>) => {
  settingActions.updateSetting(setting)
  throttleSaveSetting()
}

/** 设置里支持从外部直达的深页 */
export type SettingDeepPage = 'sourcesearch' | 'library' | 'download'

/** 待打开的设置深页（音源管理 / 下载管理…）：设置页挂载后消费一次 */
let pendingSettingPage: SettingDeepPage | null = null

/**
 * 从任意页面跳到设置里的某个深页（新手引导等用）。
 *
 * 设置页是 Tab 内页面，深页状态保存在它自己的组件里，所以这里同时做两件事：
 * 1. 广播已有的 `settingsDeepScreenRequested` 事件（设置页已挂载时立即生效）；
 * 2. 记一个待打开请求，设置页首次挂载时消费（还没进过设置时的事件会丢）。
 */
export const openSettingPage = (id: SettingDeepPage) => {
  pendingSettingPage = id
  setNavActiveId('nav_mine')
  global.state_event.settingsDeepScreenRequested(id)
}

/** 设置页消费待打开深页（只生效一次） */
export const consumePendingSettingPage = () => {
  const id = pendingSettingPage
  pendingSettingPage = null
  return id
}

export const setLanguage = (locale: Parameters<typeof applyLanguage>[0]) => {
  updateSetting({ 'common.langId': locale })
  global.state_event.languageChanged(locale)
  requestAnimationFrame(() => {
    applyLanguage(locale)
  })
}


let isDestroying = false
export const exitApp = (reason: string) => {
  if (isDestroying) return
  isDestroying = true
  void Promise.all([
    destroyPlayer(),
  ]).finally(() => {
    isDestroying = false
    utilExitApp()
  })
}

export const setFontSize = (size: number) => {
  // 先更新全局缩放，再广播事件：Text/Icon 重新渲染时才能拿到新字号
  global.lx.fontSize = size
  commonActions.setFontSize(size)
  void saveFontSize(size)
}

export const setStatusbarHeight = (size: number) => {
  commonActions.setStatusbarHeight(size)
}

export const setComponentId = (name: keyof CommonStateType['componentIds'], id: string) => {
  commonActions.setComponentId(name, id)
}
export const removeComponentId = (name: string) => {
  commonActions.removeComponentId(name)
}

export const setNavActiveId = (id: Parameters<typeof commonActions.setNavActiveId>['0']) => {
  if (id == commonState.navActiveId) return
  commonActions.setNavActiveId(id)
  if (id != 'nav_mine') {
    commonActions.setLastNavActiveId(id)
    saveViewPrevState({ id })
  }
}

export const showPactModal = () => {
  handleShowPactModal()
}

export const checkStoragePermissions = async() => {
  const selectedManagedFolder = await getSelectedManagedFolder()
  if (selectedManagedFolder) return (await getPersistedUriList()).some(uri => selectedManagedFolder.startsWith(uri))
  return false
}

export const requestStoragePermission = async() => {
  const isGranted = await checkStoragePermissions()
  if (isGranted) return isGranted

  const uri = await selectManagedFolder()
  if (!uri.isDirectory) return false
  await setSelectedManagedFolder(uri.path)
  return true
}

export const setBgPic = (pic: string | null) => {
  commonActions.setBgPic(pic)
}
