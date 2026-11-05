import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'

import Player from './settings/Player'
import Download from './settings/Download'
import Source from './settings/Source'
import SearchList from './settings/SearchList'
import Tools from './settings/Tools'
import Basic from './settings/Basic'
import Other from './settings/Other'
import About from './settings/About'

/**
 * 设置分类顺序（按使用频率重排）：播放 → 下载 → 音源 → 搜索与列表 → 工具 → 基本 → 其他 → 关于。
 * id 保持不变，`global.lx.settingActiveId` 里的旧值仍能定位到同一个页面。
 */
export const SETTING_SCREENS = [
  'player',
  'download',
  'source',
  'searchlist',
  'tools',
  'basic',
  'other',
  'about',
] as const

export type SettingScreenIds = typeof SETTING_SCREENS[number]

// 旧版本里「搜索」「列表」是两个独立分组，现在合并为「搜索与列表」，
// 内存里可能还残留旧 id（例如热重载/从旧导航状态恢复），这里统一迁移掉
const LEGACY_SCREEN_IDS: Record<string, SettingScreenIds> = {
  search: 'searchlist',
  list: 'searchlist',
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
      case 'player': return <Player />
      case 'download': return <Download />
      case 'source': return <Source />
      case 'searchlist': return <SearchList />
      case 'tools': return <Tools />
      case 'other': return <Other />
      case 'about': return <About />
      case 'basic':
      default: return <Basic />
    }
  }, [id])

  return component
})


export default Main
