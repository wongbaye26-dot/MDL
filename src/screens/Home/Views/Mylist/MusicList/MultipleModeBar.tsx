import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'

import BatchActionBar, { type BatchBarAction } from '@/components/common/BatchActionBar'

export type SelectMode = 'single' | 'range'

export interface MultipleModeBarProps {
  onSwitchMode: (mode: SelectMode) => void
  onSelectAll: (isAll: boolean) => void
  onExitSelectMode: () => void
}
export interface MultipleModeBarType {
  show: () => void
  setVisibleBar: (visible: boolean) => void
  setIsSelectAll: (isAll: boolean) => void
  setSwitchMode: (mode: SelectMode) => void
  exitSelectMode: () => void
}

/**
 * 我的列表多选条：统一为本地音乐同款底部 BatchActionBar。
 * 不再使用旧的顶部通栏（单选/区间/全选/取消）。
 */
export default forwardRef<MultipleModeBarType, MultipleModeBarProps>(({ onSelectAll, onSwitchMode, onExitSelectMode }, ref) => {
  const [visible, setVisible] = useState(false)
  const [selectMode, setSelectMode] = useState<SelectMode>('single')
  const [isSelectAll, setIsSelectAll] = useState(false)
  const [visibleBar, setVisibleBar] = useState(true)

  useImperativeHandle(ref, () => ({
    show() { setVisible(true) },
    setVisibleBar(visible) { setVisibleBar(visible) },
    setIsSelectAll(isAll) { setIsSelectAll(isAll) },
    setSwitchMode(mode) { setSelectMode(mode) },
    exitSelectMode() { setVisible(false); setIsSelectAll(false) },
  }))

  const actions = useMemo<BatchBarAction[]>(() => [
    {
      key: 'selectAll',
      label: isSelectAll ? '取消全选' : '全选',
      icon: isSelectAll ? 'checkbox-multiple-marked' : 'checkbox-multiple-blank-outline',
      onPress: () => {
        const next = !isSelectAll
        setIsSelectAll(next)
        onSelectAll(next)
      },
    },
    {
      key: 'mode',
      label: selectMode === 'single' ? '区间' : '单选',
      icon: 'selection-drag',
      onPress: () => { onSwitchMode(selectMode === 'single' ? 'range' : 'single') },
    },
  ], [isSelectAll, onSelectAll, onSwitchMode, selectMode])

  if (!visible || !visibleBar) return null
  return <BatchActionBar actions={actions} onExit={onExitSelectMode} />
})
