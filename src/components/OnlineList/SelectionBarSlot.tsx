import { memo, useEffect, useReducer } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { getSelectionBar, subscribeSelectionBar } from '@/utils/selectionBar'

/**
 * 整屏子页标题右侧的多选操作条。
 *
 * 原来多选栏是绝对定位在列表顶部，会盖住第一行；现在挪到标题右侧那块空白里，
 * 只留三个图标按钮（模式 / 全选 / 取消），不占列表空间。
 */
export default memo(() => {
  const theme = useTheme()
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)
  const state = getSelectionBar()

  useEffect(() => subscribeSelectionBar(forceUpdate), [])

  if (!state.visible) return null

  const isRange = state.selectMode === 'range'

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={{ ...styles.btn, backgroundColor: theme['c-primary-alpha-900'] }}
        activeOpacity={0.75}
        onPress={() => { state.onSwitchMode?.(isRange ? 'single' : 'range') }}
      >
        <Icon
          name={isRange ? 'selection-drag' : 'cursor-default-click-outline'}
          size={17}
          color={theme['c-primary']}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={{ ...styles.btn, backgroundColor: theme['c-primary-alpha-900'] }}
        activeOpacity={0.75}
        onPress={() => { state.onSelectAll?.() }}
      >
        <Icon
          name={state.isSelectAll ? 'checkbox-multiple-marked' : 'checkbox-multiple-blank-outline'}
          size={17}
          color={theme['c-primary']}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={{ ...styles.btn, backgroundColor: theme['c-primary-alpha-900'] }}
        activeOpacity={0.75}
        onPress={() => { state.onExit?.() }}
      >
        <Icon name='close' size={17} color={theme['c-font']} />
      </TouchableOpacity>
    </View>
  )
})

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
