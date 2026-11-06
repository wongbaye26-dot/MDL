import { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Animated, TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'
import { useOverlayLock } from '@/utils/overlayLock'
import { resetSelectionBar, setSelectionBar, useHasSelectionSlot, useSelectionBarCount } from '@/utils/selectionBar'

export type SelectMode = 'single' | 'range'

export const MULTI_SELECT_BAR_HEIGHT = scaleSizeH(40)

export interface MultipleModeBarProps {
  onSwitchMode: (mode: SelectMode) => void
  onSelectAll: (isAll: boolean) => void
  onExitSelectMode: () => void
  /** 打开批量操作菜单（下一首播放/下载/添加到…） */
  onMore?: () => void
  /** 多选栏是否可见（无插槽页面用它给列表让出顶部高度） */
  onVisibleChange?: (visible: boolean) => void
}
export interface MultipleModeBarType {
  show: () => void
  setIsSelectAll: (isAll: boolean) => void
  setSwitchMode: (mode: SelectMode) => void
  exitSelectMode: () => void
}

export default forwardRef<MultipleModeBarType, MultipleModeBarProps>(({ onSelectAll, onSwitchMode, onExitSelectMode, onMore, onVisibleChange }, ref) => {
  // const isGetDetailFailedRef = useRef(false)
  /** 页面是否提供「标题右侧插槽」——有的话这里只同步状态，不再自己画 */
  const hasSlot = useHasSelectionSlot()
  const [visible, setVisible] = useState(false)
  const [animatePlayed, setAnimatPlayed] = useState(true)
  const animFade = useRef(new Animated.Value(0)).current
  const animTranslateY = useRef(new Animated.Value(0)).current
  const [selectMode, setSelectMode] = useState<SelectMode>('single')
  const [isSelectAll, setIsSelectAll] = useState(false)
  const selectedCount = useSelectionBarCount()
  const theme = useTheme()
  // 多选栏贴在屏幕最底部，会被悬浮的胶囊导航整个盖住（只露出半行字、点不到）。
  // 多选期间把导航锁掉，和整屏子页用同一套机制。
  useOverlayLock(visible)

  useImperativeHandle(ref, () => ({
    show() {
      handleShow()
    },
    setIsSelectAll(isAll) {
      setIsSelectAll(isAll)
    },
    setSwitchMode(mode: SelectMode) {
      setSelectMode(mode)
    },
    exitSelectMode() {
      handleHide()
    },
  }))

  const handleShow = useCallback(() => {
    // console.log('show List')
    setVisible(true)
    setAnimatPlayed(false)
    requestAnimationFrame(() => {
      animTranslateY.setValue(20)

      Animated.parallel([
        Animated.timing(animFade, {
          toValue: 0.92,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(animTranslateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setAnimatPlayed(true)
      })
    })
  }, [animFade, animTranslateY])

  const handleHide = useCallback(() => {
    setAnimatPlayed(false)
    Animated.parallel([
      Animated.timing(animFade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(animTranslateY, {
        toValue: 20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(finished => {
      if (!finished) return
      setVisible(false)
      setAnimatPlayed(true)
    })
  }, [animFade, animTranslateY])


  const animaStyle = useMemo(() => ({
    ...styles.container,
    height: MULTI_SELECT_BAR_HEIGHT,
    backgroundColor: theme['c-content-background'],
    borderBottomColor: theme['c-border-background'],
    opacity: animFade, // Bind opacity to animated value
    transform: [
      { translateY: animTranslateY },
    ],
  }), [animFade, animTranslateY, theme])

  const handleSelectAll = useCallback(() => {
    const selectAll = !isSelectAll
    setIsSelectAll(selectAll)
    onSelectAll(selectAll)
  }, [isSelectAll, onSelectAll])

  // 有插槽时把状态和回调同步给 PageModal 的标题右侧
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

  // 卸载时把插槽收掉，避免切页后标题右侧还挂着按钮
  useEffect(() => () => { if (hasSlot) resetSelectionBar() }, [hasSlot])

  // 没有标题栏插槽时（搜索页）多选栏是浮层，把可见性抛给列表让顶部高度
  useEffect(() => {
    onVisibleChange?.(hasSlot ? false : visible)
  }, [hasSlot, visible, onVisibleChange])

  const component = useMemo(() => {
    /*
      搜索页没有标题栏插槽，多选栏是浮层。
      旧版把「单选 / 区间」两个大按钮 + 全选 + 更多 + 取消平铺一行，搜索页顶栏很挤；
      这里收敛为：已选数量 + 一个「单选↔区间」模式切换 + 全选 + 更多 + 取消，
      并改成悬浮胶囊（圆角 + 阴影），不再是一条通栏色带。
    */
    const nextMode: SelectMode = selectMode === 'single' ? 'range' : 'single'
    return (
      <Animated.View style={animaStyle}>
        <Text size={11} color={theme['c-450']} style={styles.countText}>{`已选 ${selectedCount}`}</Text>
        <TouchableOpacity onPress={() => { onSwitchMode(nextMode) }} style={styles.btn}>
          <Text size={11} color={theme['c-button-font']}>{selectMode === 'single' ? '单选' : '区间'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSelectAll} style={styles.btn}>
          <Text size={11} color={theme['c-button-font']}>{global.i18n.t(isSelectAll ? 'list_select_unall' : 'list_select_all')}</Text>
        </TouchableOpacity>
        {
          onMore
            ? (
              <TouchableOpacity onPress={onMore} style={styles.btn}>
                <Text size={11} color={theme['c-button-font']}>更多</Text>
              </TouchableOpacity>
              )
            : null
        }
        <TouchableOpacity onPress={onExitSelectMode} style={styles.btn}>
          <Text size={11} color={theme['c-button-font']}>{global.i18n.t('list_select_cancel')}</Text>
        </TouchableOpacity>
      </Animated.View>
    )
  }, [animaStyle, selectMode, selectedCount, theme, handleSelectAll, isSelectAll, onExitSelectMode, onSwitchMode, onMore])

  // 有插槽时完全交给 PageModal 渲染，列表顶部不再被这条栏盖住
  if (hasSlot) return null
  return !visible && animatePlayed ? null : component
})

const styles = createStyle({
  container: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 2,
    borderWidth: 0.5,
    // 浮层：阴影把多选栏和列表分开，避免看起来像一条贴着列表的横条
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  countText: {
    marginRight: 6,
  },
  btn: {
    paddingLeft: 12,
    paddingRight: 12,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
