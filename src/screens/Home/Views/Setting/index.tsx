import { useHorizontalMode } from '@/utils/hooks'
import Vertical from './Vertical'
import Horizontal from './Horizontal'

export type { SettingScreenIds } from './Main'

export default () => {
  const isHorizontalMode = useHorizontalMode()

  /*
    设置首页不再拦截系统返回：交给 Android 默认行为把应用退到后台。
    （之前这里会 setNavActiveId(lastNavActiveId)，表现就是按返回回到上一个 Tab。）
    深页的返回由 Vertical/Main 自己的 BackHandler 处理。
  */
  return isHorizontalMode
    ? <Horizontal />
    : <Vertical />
}
