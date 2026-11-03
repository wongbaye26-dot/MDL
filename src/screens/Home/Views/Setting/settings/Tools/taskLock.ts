/**
 * 补封面 / 刮削标签共用的「一次只跑一个批量任务」锁。
 *
 * 两个区块都会改写同一批音频文件，同时跑会互相覆盖、也让真机更卡；
 * 各自的 running state 只能管住自己，所以这里放一个模块级标记做互斥。
 * （UI 按钮不订阅这个标记，抢不到锁时用 toast 提示即可，不必为它增加渲染。）
 */
let busy = false

/** 尝试占用锁：已经有任务在跑返回 false */
export const acquireToolsBusy = () => {
  if (busy) return false
  busy = true
  return true
}

export const releaseToolsBusy = () => {
  busy = false
}
