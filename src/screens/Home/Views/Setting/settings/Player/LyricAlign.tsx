import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'

const OPTIONS = [
  { value: 'auto', label: '自动' },
  { value: 'center', label: '居中' },
  { value: 'left', label: '左对齐' },
] as const

/**
 * 歌词对齐方式。
 *
 * 默认「自动」= 竖屏居中、横屏/外文歌词左对齐（保持原有行为）；
 * 手动选择后覆盖自动判断。
 */
export default memo(() => {
  const theme = useTheme()
  const align = useSettingValue('player.lyricAlign')

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text size={14.5} color={theme['c-font']}>歌词对齐</Text>
        <Text size={11} color={theme['c-450']}>自动＝竖屏居中、横屏左对齐</Text>
      </View>
      <View style={styles.row}>
        {
          OPTIONS.map(option => {
            const active = option.value === align
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.chip, { backgroundColor: active ? theme['c-primary'] : theme['c-primary-alpha-800'] }]}
                activeOpacity={0.7}
                accessibilityRole='button'
                accessibilityState={{ selected: active }}
                accessibilityLabel={`歌词对齐${option.label}`}
                onPress={() => { updateSetting({ 'player.lyricAlign': option.value }) }}
              >
                <Text size={12} color={active ? '#FFFFFF' : theme['c-450']}>{option.label}</Text>
              </TouchableOpacity>
            )
          })
        }
      </View>
    </View>
  )
})

const styles = createStyle({
  wrap: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
  },
  chip: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
