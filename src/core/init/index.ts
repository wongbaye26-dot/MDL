import { initSetting } from '@/core/common'
import registerPlaybackService from '@/plugins/player/service'
import initTheme from './theme'
import initI18n from './i18n'
import initUserApi from './userApi'
import initPlayer from './player'
import dataInit from './dataInit'
import initCommonState from './common'
import { initDeeplink } from './deeplink'
import { setApiSource } from '@/core/apiSource'
import { init as initDownload } from '@/core/download'
import commonActions from '@/store/common/action'
import { bootLog } from '@/utils/bootLog'
import { getLocalMusicList } from '@/core/localMusic'
import { initLocalMusicAutoSync } from '@/core/localMusic/autoSync'

let isFirstPush = true
const handlePushedHomeScreen = async() => {
  // 下载器定位：不再展示首次启动的协议与提示弹窗
  if (isFirstPush) {
    isFirstPush = false
    void initDeeplink()
  }
}

let isInited = false
export default async() => {
  if (isInited) return handlePushedHomeScreen
  bootLog('Initing...')
  commonActions.setFontSize(global.lx.fontSize)
  bootLog('Font size changed.')
  const setting = await initSetting()
  bootLog('Setting inited.')
  // console.log(setting)

  await initTheme(setting)
  bootLog('Theme inited.')
  await initI18n(setting)
  bootLog('I18n inited.')

  await initUserApi(setting)
  bootLog('User Api inited.')

  setApiSource(setting['common.apiSource'])
  bootLog('Api inited.')

  registerPlaybackService()
  bootLog('Playback Service Registered.')
  await initPlayer(setting)
  bootLog('Player inited.')
  await dataInit(setting)
  bootLog('Data inited.')
  // 首页启动期间后台预加载曲库，用户点开本地音乐时直接命中内存，不再等 DB
  void getLocalMusicList().catch(() => {})
  await initDownload()
  bootLog('Download inited.')
  // 本地曲库后台自动同步：MediaStore 变化 / 下载完成 / 回到前台都会增量扫描
  initLocalMusicAutoSync()
  bootLog('Local music auto sync inited.')
  await initCommonState(setting)
  bootLog('Common State inited.')


  // syncSetting()

  isInited ||= true

  return handlePushedHomeScreen
}
