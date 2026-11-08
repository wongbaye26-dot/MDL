import { useCallback, useEffect } from 'react'
import { AppState, View } from 'react-native'
import { useHorizontalMode } from '@/utils/hooks'
import { useNavActiveId } from '@/store/common/hook'
import { rememberActiveTab } from '@/utils/playerTransition'
import PageContent from '@/components/PageContent'
import CutoutCompensator from '@/components/common/CutoutCompensator'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import Vertical from './Vertical'
import Horizontal from './Horizontal'
import PlayerTransition from './Vertical/PlayerTransition'
import AppDialogHost from '@/components/common/AppDialog'
import { requestStartupPermissions } from '@/core/permissions'


interface Props {
  componentId: string
}


export default ({ componentId }: Props) => {
  const isHorizontalMode = useHorizontalMode()
  const navActiveId = useNavActiveId()

  /** 用户交互时间戳：首页装饰动效空闲时暂停，触摸立刻恢复 */
  const notifyActivity = useCallback(() => {
    global.lx.lastUserActivityAt = Date.now()
  }, [])
  useEffect(() => {
    notifyActivity()
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') notifyActivity()
    })
    return () => { subscription.remove() }
  }, [navActiveId, notifyActivity])

  // 记住进入播放器前停在哪个 Tab：横屏导航等直接切 nav_player 的入口关闭时要回到它
  useEffect(() => {
    rememberActiveTab(navActiveId)
  }, [navActiveId])

  useEffect(() => {
    // 首次启动申请一次「音乐和音频 / 通知」权限
    void requestStartupPermissions()
  }, [])

  useEffect(() => {
    setComponentId(COMPONENT_IDS.home, componentId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <CutoutCompensator>
      <PageContent>
        <View style={{ flex: 1 }} onTouchStart={notifyActivity}>
        {
          isHorizontalMode
            ? <Horizontal />
            : <Vertical />
        }
        {/*
          共享元素转场层必须放在 PagerView **外面**：
          竖屏各页是 PagerView 的子页，切到播放器时整个 Home 页会被平移出屏幕，
          转场层如果挂在里面会跟着一起飞走（实测飞行封面会跑到屏幕外）。
          横屏也挂载：横屏播放器是左半屏满出血封面，几何见 playerOpen.getPlayerCoverGeometry。
        */}
        <PlayerTransition />
        {/* 全局 Material You 弹窗宿主：Home 常驻，一个实例覆盖所有页面（RN Modal 是 Activity 级 Dialog） */}
        <AppDialogHost />
        </View>
      </PageContent>
    </CutoutCompensator>
  )
}
