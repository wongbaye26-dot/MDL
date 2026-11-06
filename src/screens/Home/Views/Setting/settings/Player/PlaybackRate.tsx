import { memo } from 'react'
import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Chip from '@/components/common/Chip'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useTheme } from '@/store/theme/hook'
import { setPlaybackRate } from '@/plugins/player'
import { createStyle } from '@/utils/tools'

/** 播放倍速（W4 / D-13）：0.5×～2.0×，立即生效并持久化 */
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const

export default memo(() => {
  const theme = useTheme()
  const rate = useSettingValue('player.playbackRate')

  return (
    <SubTitle title='播放倍速'>
      <View style={styles.list}>
        {
          RATES.map(value => (
            <View key={value} style={styles.chipWrap}>
              <Chip
                label={`${value.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')}×`}
                active={Math.abs(rate - value) < 0.01}
                onPress={() => {
                  updateSetting({ 'player.playbackRate': value })
                  void setPlaybackRate(value)
                }}
              />
            </View>
          ))
        }
      </View>
      <View style={{ ...styles.tip, backgroundColor: theme['c-primary-alpha-900'] }}>
        <Text size={11} color={theme['c-450']} style={styles.tipText}>
          {`当前 ${rate}×；切歌/重启后保持，蓝牙与通知控制不受影响`}
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
