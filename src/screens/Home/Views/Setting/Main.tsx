import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Animated, Easing } from 'react-native'

import Playback from './settings/Refactored/Playback'
import Lyric from './settings/Refactored/Lyric'
import Appearance from './settings/Refactored/Appearance'
import Library from './settings/Refactored/Library'
import SourceSearch from './settings/Refactored/SourceSearch'
import DownloadStorage from './settings/Refactored/DownloadStorage'
import System from './settings/Refactored/System'
import Misc from './settings/Refactored/Misc'
import { useReducedMotion } from '@/utils/hooks'

/**
 * 设置分类顺序（按使用频率重排）：播放 → 下载 → 音源 → 搜索与列表 → 工具 → 基本 → 其他 → 关于。
 * id 保持不变，`global.lx.settingActiveId` 里的旧值仍能定位到同一个页面。
 */
export const SETTING_SCREENS = [
  'playback',
  'lyric',
  'appearance',
  'library',
  'sourcesearch',
  'download',
  'system',
  'misc',
] as const

export type SettingScreenIds = typeof SETTING_SCREENS[number]

// 旧版本里「搜索」「列表」是两个独立分组，现在合并为「搜索与列表」，
// 内存里可能还残留旧 id（例如热重载/从旧导航状态恢复），这里统一迁移掉
const LEGACY_SCREEN_IDS: Record<string, SettingScreenIds> = {
  player: 'playback',
  search: 'sourcesearch',
  searchlist: 'sourcesearch',
  list: 'library',
  tools: 'library',
  basic: 'appearance',
  source: 'sourcesearch',
  other: 'misc',
  about: 'misc',
}
/** 把旧版本残留的 search / list 归一成 searchlist，非法值回退到 basic */
export const normalizeSettingScreenId = (id: string | null | undefined): SettingScreenIds => {
  if ((SETTING_SCREENS as readonly string[]).includes(id ?? '')) return id as SettingScreenIds
  const migrated = LEGACY_SCREEN_IDS[id ?? ''] ?? 'basic'
  global.lx.settingActiveId = migrated
  return migrated
}

// interface MainProps {
//   onUpdateActiveId: (id: string) => void
// }
export interface MainType {
  setActiveId: (id: SettingScreenIds) => void
}

const Main = forwardRef<MainType, {}>((props, ref) => {
  const [id, setId] = useState(() => normalizeSettingScreenId(global.lx.settingActiveId))
  const reduced = useReducedMotion()
  /** 设置分类切换的轻量入场：200ms 淡入 + 6dp 上浮，避免整块内容硬切 */
  const enter = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (reduced) {
      enter.setValue(1)
      return
    }
    enter.setValue(0)
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    animation.start()
    return () => { animation.stop() }
  }, [id, reduced, enter])

  useImperativeHandle(ref, () => ({
    setActiveId(id) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setId(id)
        })
      })
    },
  }))

  const component = useMemo(() => {
    switch (id) {
      case 'playback': return <Playback />
      case 'lyric': return <Lyric />
      case 'appearance': return <Appearance />
      case 'library': return <Library />
      case 'sourcesearch': return <SourceSearch />
      case 'download': return <DownloadStorage />
      case 'system': return <System />
      case 'misc':
      default: return <Misc />
    }
  }, [id])

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
      }}
    >
      {component}
    </Animated.View>
  )
})


export default Main
