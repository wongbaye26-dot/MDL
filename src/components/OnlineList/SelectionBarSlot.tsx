import { memo, useEffect, useReducer } from 'react'
import { View } from 'react-native'

import CapsuleIconButton from '@/components/common/CapsuleIconButton'
import { getSelectionBar, subscribeSelectionBar } from '@/utils/selectionBar'
import { createStyle } from '@/utils/tools'

/** 标题右侧只保留「退出多选」一个按钮；全选/更多统一在底部 BatchActionBar */
export default memo(() => {
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)
  const state = getSelectionBar()

  useEffect(() => subscribeSelectionBar(forceUpdate), [])

  if (!state.visible) return null

  return (
    <View style={styles.row}>
      <CapsuleIconButton icon='close' label='退出多选' onPress={() => { state.onExit?.() }} />
    </View>
  )
})

const styles = createStyle({
  row: { flexDirection: 'row', alignItems: 'center' },
})
