import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'

import Source from './settings/Source'
import Basic from './settings/Basic'
import Player from './settings/Player'
import SearchList from './settings/SearchList'
import Download from './settings/Download'
import Other from './settings/Other'
import Tools from './settings/Tools'
import About from './settings/About'

export const SETTING_SCREENS = [
  'source',
  'basic',
  'player',
  'download',
  'searchlist',
  'tools',
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
      case 'source': return <Source />
      case 'player': return <Player />
      case 'download': return <Download />
      case 'searchlist': return <SearchList />
      case 'other': return <Other />
      case 'tools': return <Tools />
      case 'about': return <About />
      case 'basic':
      default: return <Basic />
    }
  }, [id])

  return component
})


export default Main
