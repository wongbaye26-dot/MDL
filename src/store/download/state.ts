
interface InitState {
  list: LX.Download.ListItem[]
  /** 已初始化完成 */
  isInit: boolean
}

const state: InitState = {
  list: [],
  isInit: false,
}

export { state }
