import { memo } from 'react'

import Tag from './Tag'
import { useTheme } from '@/store/theme/hook'

/**
 * 小标签：一行文字 + 浅色圆角底。
 *
 * 对齐和尺寸统一走 `Tag`（固定高度 + 垂直居中 + 关掉 Android 字体额外 padding），
 * 这里只保留旧 API（text / color / bg）兼容各页面调用方。
 */
export default memo(({ text, color, bg }: {
  text: string
  color?: string
  bg?: string
}) => {
  const theme = useTheme()
  return (
    <Tag
      label={text}
      size='sm'
      bg={bg ?? theme['c-primary-alpha-900']}
      color={color ?? theme['c-450']}
      style={{ marginRight: 5 }}
    />
  )
})
