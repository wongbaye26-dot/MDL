import { View } from 'react-native'
import Slider from '@/components/common/Slider'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'

export default () => {
  const theme = useTheme()
  const volume = useSettingValue('player.volume')

  return (
    <View style={styles.container}>
      <Icon name='volume-low' size={14} color={theme['c-450']} />
      <View style={styles.sliderWrap}>
        <Slider
          value={Math.round(volume * 100)}
          minimumValue={0}
          maximumValue={100}
          onSlidingComplete={value => { updateSetting({ 'player.volume': value / 100 }) }}
        />
      </View>
      <Icon name='volume-higt' size={14} color={theme['c-450']} />
    </View>
  )
}

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 24,
    marginTop: 2,
  },
  sliderWrap: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 4,
    marginRight: 4,
  },
})
