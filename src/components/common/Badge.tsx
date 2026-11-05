import { memo, useMemo } from 'react'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { setSpText } from '@/utils/pixelRatio'
import Text from './Text'
// const menuItemHeight = 42
// const menuItemWidth = 100

const styles = createStyle({
  text: {
    marginRight: 5,
    fontWeight: '400',
    alignSelf: 'center',
    // 和行内 11sp 文本同一基线：关掉字体额外 padding，行高压到和字号匹配，
    // 避免中英数混排时角标看起来比右侧文字低半像素
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: setSpText(11),
  },
})

export type BadgeType = 'normal' | 'secondary' | 'tertiary'

export default memo(({ type = 'normal', children }: {
  type?: BadgeType
  children: string
}) => {
  const theme = useTheme()
  // console.log(visible)
  const colors = useMemo(() => {
    const colors = { textColor: '' }
    switch (type) {
      case 'normal':
        // colors.bgColor = theme.primary
        colors.textColor = theme['c-badge-primary']
        break
      case 'secondary':
        // colors.bgColor = theme.primary
        colors.textColor = theme['c-badge-secondary']
        break
      case 'tertiary':
        // colors.bgColor = theme.primary
        colors.textColor = theme['c-badge-tertiary']
        break
    }
    return colors
  }, [type, theme])

  return <Text style={styles.text} size={9} color={colors.textColor}>{children}</Text>
})

