import { memo } from 'react'
import { Switch, TouchableOpacity, View } from 'react-native'

import { type CheckBoxProps } from '@/components/common/CheckBox'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle, tipDialog } from '@/utils/tools'


export default memo(({ check, label, children, onChange, helpTitle, helpDesc, disabled = false }: CheckBoxProps) => {
  const theme = useTheme()

  const handlePress = () => {
    if (disabled) return
    onChange(!check)
  }
  const handleShowHelp = () => {
    void tipDialog({
      title: helpTitle ?? label ?? '',
      message: helpDesc,
      btnText: global.i18n.t('understand'),
    })
  }

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      disabled={disabled}
      onPress={handlePress}
    >
      <View style={styles.info}>
        <Text size={14} color={disabled ? theme['c-450'] : theme['c-font']}>{label}</Text>
        {children ? <View style={styles.child}>{children}</View> : null}
      </View>
      {
        helpDesc
          ? (
            <TouchableOpacity
              style={styles.help}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={handleShowHelp}
            >
              <Icon name='help' size={14} color={theme['c-350']} />
            </TouchableOpacity>
            )
          : null
      }
      <Switch
        value={check}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: theme['c-primary-alpha-700'], true: theme['c-primary'] }}
        thumbColor='#FFFFFF'
        style={styles.switch}
      />
    </TouchableOpacity>
  )
})

const styles = createStyle({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 10,
    paddingTop: 11,
    paddingBottom: 11,
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 8,
  },
  child: {
    marginTop: 4,
  },
  help: {
    marginRight: 6,
  },
  switch: {
    transform: [{ scale: 0.82 }],
  },
})
