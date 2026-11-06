import { memo } from 'react'
import { View } from 'react-native'

import Section from '../../components/Section'
import ChoiceItem from '../../components/ChoiceItem'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'

/**
 * 底部胶囊 / 迷你播放器的玻璃效果。
 *
 * 对标 Lyrico「外观 → 悬浮导航栏 → 悬浮导航栏效果」的三档：
 *  - 液态玻璃：模糊 + 缓慢流动高光 + 边缘光（默认）；
 *  - 毛玻璃：只保留高斯模糊，低端机更省电；
 *  - 关闭：不模糊，用半透明纯色底。
 */
const STYLES = [
  { value: 'liquid', label: '液态玻璃', desc: '默认：真高斯模糊 + 缓慢横扫的玻璃高光 + 顶部边缘光，最接近 Miuix 悬浮栏' },
  { value: 'frosted', label: '毛玻璃', desc: '只保留高斯模糊与静态反光；低端机或省电模式推荐' },
  { value: 'none', label: '关闭', desc: '不做模糊，胶囊/播放条使用半透明纯色底' },
] as const

export default memo(() => {
  const current = useSettingValue('common.navGlassStyle') ?? 'liquid'

  return (
    <Section title='悬浮栏玻璃效果' icon='blur'>
      <View style={styles.list}>
        {
          STYLES.map(item => (
            <ChoiceItem
              key={item.value}
              label={item.label}
              desc={item.desc}
              active={current === item.value}
              onPress={() => { updateSetting({ 'common.navGlassStyle': item.value }) }}
            />
          ))
        }
      </View>
    </Section>
  )
})

const styles = createStyle({
  list: {
    paddingTop: 2,
    paddingBottom: 2,
  },
})
