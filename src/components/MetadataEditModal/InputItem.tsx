import { memo } from 'react'

import { StyleSheet, View } from 'react-native'
import type { InputProps } from '@/components/common/Input'
import Input from '@/components/common/Input'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'


export interface InputItemProps extends InputProps {
  value: string
  label: string
  onChanged: (text: string) => void
}

export default memo(({ value, label, onChanged, ...props }: InputItemProps) => {
  const theme = useTheme()
  return (
    <View style={styles.container}>
      <Text style={styles.label} size={12} color={theme['c-450']}>{label}</Text>
      <Input
        value={value}
        onChangeText={onChanged}
        style={{ ...styles.input, backgroundColor: theme['c-primary-alpha-900'], borderColor: theme['c-primary-alpha-700'] }}
        {...props}
       />
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    marginBottom: 4,
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 0.5,
    paddingLeft: 12,
    paddingRight: 12,
    // borderRadius: 4,
    // paddingTop: 3,
    // paddingBottom: 3,
    // maxWidth: 300,
  },
})
