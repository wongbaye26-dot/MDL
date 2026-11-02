import { memo } from 'react'

import Text from './Text'
import { useTheme } from '@/store/theme/hook'

/**
 * 小标签：一行文字 + 浅色圆角底。
 *
 * 用来放「187 首」「FLAC」「44.1k」这种短信息 —— 比 `·` 分隔的纯文字更好读，
 * 也不会像长文本那样被截断成省略号。
 *
 * 注意：**直接画在 Text 上**，不套一层 View。
 * 套 View 时外层是 shrink-wrap、内层 Text 又按可用宽度算，RN 会算出一个很小的宽度，
 * 结果每个标签都被压成「05:...」。
 */
export default memo(({ text, color, bg }: {
  text: string
  color?: string
  bg?: string
}) => {
  const theme = useTheme()
  return (
    <Text
      size={10}
      color={color ?? theme['c-450']}
      style={{
        backgroundColor: bg ?? theme['c-primary-alpha-900'],
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 2,
        paddingBottom: 2,
        borderRadius: 5,
        marginRight: 5,
        overflow: 'hidden',
      }}
    >
      {text}
    </Text>
  )
})
