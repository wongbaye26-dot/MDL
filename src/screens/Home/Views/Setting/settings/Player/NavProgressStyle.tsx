import { memo } from 'react'
import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import ChoiceItem from '../../components/ChoiceItem'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'

const STYLES = [
  { value: 'ring', label: '封面圆环', desc: '默认：进度是封面外圈的细圆环，围着专辑封面转；没进度时也保留一圈淡色轨道' },
  { value: 'border', label: '胶囊描边', desc: '进度贴着胶囊边缘发光，播到哪儿亮到哪儿' },
  { value: 'none', label: '关闭', desc: '只在播放器页显示进度，底部胶囊不显示' },
] as const

/** 底部胶囊的播放进度样式 */
export default memo(() => {
  const current = useSettingValue('common.navProgressStyle') ?? 'ring'

  return (
    <SubTitle title='底部胶囊进度条'>
      <View style={styles.list}>
        {
          STYLES.map(item => (
            <ChoiceItem
              key={item.value}
              label={item.label}
              desc={item.desc}
              active={current === item.value}
              onPress={() => { updateSetting({ 'common.navProgressStyle': item.value }) }}
            />
          ))
        }
      </View>
    </SubTitle>
  )
})

const styles = createStyle({
  list: {
    marginLeft: -14,
    marginRight: -14,
  },
})
