import { memo } from 'react'
import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Chip from '@/components/common/Chip'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

/** 歌词时间轴偏移（W5 / D-18）：负值=歌词延后，正值=歌词提前 */
const OPTIONS = [-500, -100, 0, 100, 500] as const

export default memo(() => {
  const theme = useTheme()
  const offset = useSettingValue('player.lyricOffsetMs')

  return (
    <SubTitle title='歌词偏移'>
      <View style={styles.list}>
        {
          OPTIONS.map(value => (
            <View key={value} style={styles.chipWrap}>
              <Chip
                label={value === 0 ? '无偏移' : `${value > 0 ? '+' : ''}${(value / 1000).toFixed(1)}s`}
                active={offset === value}
                onPress={() => { updateSetting({ 'player.lyricOffsetMs': value }) }}
              />
            </View>
          ))
        }
      </View>
      <View style={{ ...styles.tip, backgroundColor: theme['c-primary-alpha-900'] }}>
        <Text size={11} color={theme['c-450']} style={styles.tipText}>正数让歌词提前显示，负数让歌词延后；立即生效并持久化。</Text>
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
