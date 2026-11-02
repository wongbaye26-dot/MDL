import { memo } from 'react'
import { StyleSheet, View } from 'react-native'

import Text from './Text'
import { useTheme } from '@/store/theme/hook'

/**
 * 小标签：一行文字 + 浅色圆角底。
 *
 * 注意两点（都是踩过的坑）：
 * 1. **必须用 View 包 Text**：`flexShrink` 在 RN 的 Text 上不起作用，
 *    直接给 Text 加背景时，放在 flex row 里会被压成「Material...」。
 * 2. 外层 View 一定要 `flexShrink: 0`，否则它自己也会被压缩，
 *    宽度算成很小、文字被裁。
 */
export default memo(({ text, color, bg }: {
  text: string
  color?: string
  bg?: string
}) => {
  const theme = useTheme()
  return (
    <View style={[styles.tag, { backgroundColor: bg ?? theme['c-primary-alpha-900'] }]}>
      <Text size={10} color={color ?? theme['c-450']} numberOfLines={1}>{text}</Text>
    </View>
  )
})

const styles = StyleSheet.create({
  tag: {
    flexShrink: 0,
    flexGrow: 0,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 2,
    paddingBottom: 2,
    borderRadius: 5,
    marginRight: 5,
  },
})
