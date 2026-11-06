import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

export interface ChoiceItemProps {
  label: string
  desc?: string
  active: boolean
  onPress: () => void
  children?: React.ReactNode
}

/** 单选行：左侧标题（可带描述/自定义内容），右侧选中标记 */
export default memo(({ label, desc, active, onPress, children }: ChoiceItemProps) => {
  const theme = useTheme()

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.info}>
        <Text size={14.5} color={active ? theme['c-primary-light-200'] : theme['c-font']}>{label}</Text>
        {desc ? <Text size={11} color={theme['c-450']} style={styles.desc}>{desc}</Text> : null}
        {children}
      </View>
      {
        active
          ? <Icon name='check-circle' size={18} color={theme['c-primary']} />
          : <View style={{ ...styles.radio, borderColor: theme['c-primary-alpha-500'] }} />
      }
    </TouchableOpacity>
  )
})

const styles = createStyle({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 10,
  },
  desc: {
    marginTop: 3,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.2,
  },
})
