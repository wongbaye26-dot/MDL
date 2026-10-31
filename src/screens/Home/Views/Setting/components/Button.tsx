import { memo } from 'react'

import Button, { type BtnProps } from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

type ButtonProps = BtnProps

export default memo(({ disabled, onPress, children }: ButtonProps) => {
  const theme = useTheme()

  return (
    <Button
      style={{
        ...styles.button,
        backgroundColor: disabled ? theme['c-primary-alpha-800'] : theme['c-primary-alpha-700'],
      }}
      onPress={onPress}
      disabled={disabled}
    >
      <Text size={12} color={disabled ? theme['c-400'] : theme['c-primary-light-200']}>{children}</Text>
    </Button>
  )
})

const styles = createStyle({
  button: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 7,
    paddingBottom: 7,
    borderRadius: 12,
    marginRight: 10,
    marginTop: 2,
  },
})
