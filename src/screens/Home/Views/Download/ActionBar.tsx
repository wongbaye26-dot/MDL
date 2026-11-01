import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { contrastOn } from '@/theme/solid'

/**
 * 下载中心的操作条。和首页/设置一样的语言：主按钮用主题色实心胶囊，
 * 次按钮用「主题色淡底 + 细描边」的幽灵胶囊，不再用图片头上的白色药丸。
 */
export default memo(({
  canStart,
  canPause,
  canClear,
  onStartAll,
  onPauseAll,
  onClearCompleted,
}: {
  canStart: boolean
  canPause: boolean
  canClear: boolean
  onStartAll: () => void
  onPauseAll: () => void
  onClearCompleted: () => void
}) => {
  const theme = useTheme()
  // 主色实心胶囊上的字：按主色亮度自动取黑/白，浅色主题下不会糊成一片
  const onPrimary = contrastOn(theme['c-primary'])

  return (
    <View style={styles.row}>
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={!canStart}
        onPress={onStartAll}
        style={{
          ...styles.pill,
          backgroundColor: theme['c-primary'],
          opacity: canStart ? 1 : 0.4,
        }}
      >
        <Icon name='download-2' size={14} color={onPrimary} />
        <Text size={12} color={onPrimary} style={styles.pillText}>全部开始</Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.8}
        disabled={!canPause}
        onPress={onPauseAll}
        style={{
          ...styles.pill,
          backgroundColor: theme['c-primary-alpha-900'],
          borderWidth: 0.5,
          borderColor: theme['c-primary-alpha-700'],
          opacity: canPause ? 1 : 0.4,
        }}
      >
        <Icon name='pause' size={14} color={theme['c-font']} />
        <Text size={12} style={styles.pillText}>全部暂停</Text>
      </TouchableOpacity>

      <View style={styles.spacer} />

      {
        canClear
          ? (
            <TouchableOpacity activeOpacity={0.7} onPress={onClearCompleted} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text size={12} color={theme['c-450']}>清空已完成</Text>
            </TouchableOpacity>
            )
          : null
      }
    </View>
  )
})

const styles = createStyle({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    paddingLeft: 14,
    paddingRight: 14,
    borderRadius: 17,
    marginRight: 8,
  },
  pillText: {
    marginLeft: 5,
  },
  spacer: {
    flexGrow: 1,
  },
})
