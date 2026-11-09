import { memo } from 'react'
import { TouchableOpacity } from 'react-native'

import Text from './Text'
import { Icon } from './Icon'
import { useTheme } from '@/store/theme/hook'
import { contrastOn } from '@/theme/solid'
import { Radius, Space, Type } from '@/theme/designTokens'

/** 全站统一的小胶囊按钮（图标 + 文字），用于「播放全部 / 新建」等工具行动作 */
export default memo(({
  icon,
  label,
  onPress,
  primary = true,
  disabled = false,
}: {
  icon: string
  label: string
  onPress: () => void
  primary?: boolean
  disabled?: boolean
}) => {
  const theme = useTheme()
  const bg = primary ? theme['c-primary'] : theme['c-primary-alpha-900']
  const fg = primary ? contrastOn(theme['c-primary']) : theme['c-450']
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole='button'
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 30,
        paddingLeft: Space.md,
        paddingRight: Space.md,
        borderRadius: Radius.full,
        backgroundColor: bg,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Icon name={icon} size={13} color={fg} />
      <Text size={Type.button.fontSize} color={fg} style={{ marginLeft: 4 }}>{label}</Text>
    </TouchableOpacity>
  )
})
