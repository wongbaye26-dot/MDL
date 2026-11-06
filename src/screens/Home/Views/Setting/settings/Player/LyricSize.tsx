import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'

/** 歌词字号档位（与播放器 LYRIC_SIZES 一一对应） */
export const LYRIC_SIZE_LABELS = ['小', '标准', '大', '超大'] as const

/**
 * 歌词字号设置。
 *
 * 之前播放器里的字号是组件内 useState，切歌/退出播放器就丢；这里改成
 * `player.lyricSizeIndex` 持久化设置，播放器歌词页与设置页共用。
 */
export default memo(() => {
  const theme = useTheme()
  const sizeIndex = useSettingValue('player.lyricSizeIndex')

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text size={14.5} color={theme['c-font']}>歌词字号</Text>
        <Text size={11} color={theme['c-450']}>播放器歌词页立即生效</Text>
      </View>
      <View style={styles.row}>
        {
          LYRIC_SIZE_LABELS.map((label, index) => {
            const active = index === sizeIndex
            return (
              <TouchableOpacity
                key={label}
                style={[styles.chip, { backgroundColor: active ? theme['c-primary'] : theme['c-primary-alpha-800'] }]}
                activeOpacity={0.7}
                accessibilityRole='button'
                accessibilityState={{ selected: active }}
                accessibilityLabel={`歌词字号${label}`}
                onPress={() => { updateSetting({ 'player.lyricSizeIndex': index }) }}
              >
                <Text size={12} color={active ? '#FFFFFF' : theme['c-450']}>{label}</Text>
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
