import { memo } from 'react'
import { TouchableOpacity } from 'react-native'

import { Icon } from './Icon'
import { useTheme } from '@/store/theme/hook'
import { Radius } from '@/theme/designTokens'
import { contrastOn } from '@/theme/solid'

/**
 * 全站统一的「小胶囊图标按钮」：列表页/详情页头部与工具行共用。
 * 38dp 正圆 + 主色淡底（选中态主色实心），图标 19dp，按压反馈统一。
 */
export default memo(({
  icon,
  onPress,
  label,
  active = false,
  size = 38,
  iconSize = 19,
  color,
}: {
  icon: string
  onPress?: () => void
  label: string
  active?: boolean
  size?: number
  iconSize?: number
  color?: string
}) => {
  const theme = useTheme()
  const activeColor = active ? contrastOn(theme['c-primary']) : (color ?? theme['c-font'])
  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        marginLeft: 6,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: active ? theme['c-primary'] : theme['c-primary-alpha-900'],
      }}
    >
      <Icon name={icon} size={iconSize} color={activeColor} />
    </TouchableOpacity>
  )
})

export const CAPSULE_RADIUS = Radius.full
