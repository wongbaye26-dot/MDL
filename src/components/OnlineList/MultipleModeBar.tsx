import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'

import BatchActionBar, { type BatchBarAction } from '@/components/common/BatchActionBar'
import { useOverlayLock } from '@/utils/overlayLock'
import { resetSelectionBar, setSelectionBar, useHasSelectionSlot, useSelectionBarCount } from '@/utils/selectionBar'

export type SelectMode = 'single' | 'range'

/** 旧版顶部多选栏已移除，列表不再需要顶部 inset */
export const MULTI_SELECT_BAR_HEIGHT = 0

export interface MultipleModeBarProps {
  onSwitchMode: (mode: SelectMode) => void
  onSelectAll: (isAll: boolean) => void
  onExitSelectMode: () => void
  /** 打开批量操作菜单（下一首播放/下载/添加到…） */
  onMore?: () => void
  onVisibleChange?: (visible: boolean) => void
}
export interface MultipleModeBarType {
  show: () => void
  setIsSelectAll: (isAll: boolean) => void
  setSwitchMode: (mode: SelectMode) => void
  exitSelectMode: () => void
}

/**
 * 排行榜/歌单详情/在线列表的批量操作条。
 *
 * 统一为「本地音乐」同款 BatchActionBar：底部悬浮胶囊 + 已选 N + 图标操作 + 关闭，
 * 不再使用旧的顶部通栏文字按钮。
 */
export default forwardRef<MultipleModeBarType, MultipleModeBarProps>(({ onSelectAll, onSwitchMode, onExitSelectMode, onMore, onVisibleChange }, ref) => {
  const hasSlot = useHasSelectionSlot()
  const [visible, setVisible] = useState(false)
  const [selectMode, setSelectMode] = useState<SelectMode>('single')
  const [isSelectAll, setIsSelectAll] = useState(false)
  const selectedCount = useSelectionBarCount()
  useOverlayLock(visible)

  useImperativeHandle(ref, () => ({
    show() { setVisible(true) },
    setIsSelectAll(isAll) { setIsSelectAll(isAll) },
    setSwitchMode(mode) { setSelectMode(mode) },
    exitSelectMode() {
      setVisible(false)
      setIsSelectAll(false)
    },
  }))

  const handleSelectAll = useCallback(() => {
    const next = !isSelectAll
    setIsSelectAll(next)
    onSelectAll(next)
  }, [isSelectAll, onSelectAll])

  // 有标题插槽的页面同步状态（标题右侧只放关闭）
  useEffect(() => {
    if (!hasSlot) return
    setSelectionBar({
      visible,
      isSelectAll,
      selectMode,
      onSelectAll: handleSelectAll,
      onExit: onExitSelectMode,
      onSwitchMode,
    })
  }, [hasSlot, visible, isSelectAll, selectMode, handleSelectAll, onExitSelectMode, onSwitchMode])

  useEffect(() => () => { if (hasSlot) resetSelectionBar() }, [hasSlot])

  useEffect(() => {
    onVisibleChange?.(visible)
  }, [visible, onVisibleChange])

  const actions = useMemo<BatchBarAction[]>(() => {
    const list: BatchBarAction[] = [
      {
        key: 'selectAll',
        label: isSelectAll ? '取消全选' : '全选',
        icon: isSelectAll ? 'checkbox-multiple-marked' : 'checkbox-multiple-blank-outline',
        onPress: handleSelectAll,
      },
      {
        key: 'mode',
        label: selectMode === 'single' ? '区间' : '单选',
        icon: 'selection-drag',
        onPress: () => { onSwitchMode(selectMode === 'single' ? 'range' : 'single') },
      },
    ]
    if (onMore) {
      list.push({ key: 'more', label: '更多', icon: 'dots-horizontal', onPress: onMore })
    }
    return list
  }, [handleSelectAll, isSelectAll, onMore, onSwitchMode, selectMode])

  if (!visible) return null
  return <BatchActionBar count={selectedCount} actions={actions} onExit={() => { setVisible(false); setIsSelectAll(false); onExitSelectMode() }} />
})
