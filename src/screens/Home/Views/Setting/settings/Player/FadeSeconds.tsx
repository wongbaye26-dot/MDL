import { memo } from 'react'
import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Chip from '@/components/common/Chip'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

/** 切歌淡入淡出（W4 / D-14）：值为每秒的总时长，每侧 = 值 / 2 */
const OPTIONS = [0, 2, 4, 6, 8, 12] as const

export default memo(() => {
  const theme = useTheme()
  const seconds = useSettingValue('player.fadeSeconds')

  return (
    <SubTitle title='切歌淡入淡出'>
      <View style={styles.list}>
        {
          OPTIONS.map(value => (
            <View key={value} style={styles.chipWrap}>
              <Chip
                label={value === 0 ? '关闭' : `${value} 秒`}
                active={seconds === value}
                onPress={() => { updateSetting({ 'player.fadeSeconds': value }) }}
              />
            </View>
          ))
        }
      </View>
      <View style={{ ...styles.tip, backgroundColor: theme['c-primary-alpha-900'] }}>
        <Text size={11} color={theme['c-450']} style={styles.tipText}>
          切歌时先淡出、再淡入，避免爆音；可选 0～12 秒（每侧为一半）。
        </Text>
      </View>
    </SubTitle>
  )
})

const styles = createStyle({
  list: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
  chipWrap: { marginBottom: 8 },
  tip: { marginTop: 2, borderRadius: 10, paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8 },
  tipText: { lineHeight: 16 },
})
