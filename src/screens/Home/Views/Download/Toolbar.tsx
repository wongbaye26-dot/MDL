import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import type { DownloadStats } from '@/store/download/hook'

export default memo(({
  stats,
  onStartAll,
  onPauseAll,
  onClearCompleted,
}: {
  stats: DownloadStats
  onStartAll: () => void
  onPauseAll: () => void
  onClearCompleted: () => void
}) => {
  const theme = useTheme()

  return (
    <View style={{ ...styles.container, borderBottomColor: theme['c-border-background'] }}>
      <View style={styles.summary}>
        <Text size={12} color={theme['c-500']} numberOfLines={1}>
          {`共 ${stats.total} 首 · 完成 ${stats.completed} · 下载中 ${stats.running} · 等待 ${stats.waiting}`}
        </Text>
      </View>
      <View style={styles.btns}>
        <TouchableOpacity style={styles.btn} onPress={onStartAll} disabled={stats.total === 0}>
          <Icon name="download-2" color={theme['c-450']} size={15} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={onPauseAll} disabled={stats.running === 0}>
          <Icon name="pause" color={theme['c-450']} size={15} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={onClearCompleted} disabled={stats.completed === 0}>
          <Icon name="eraser" color={theme['c-450']} size={15} />
        </TouchableOpacity>
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingLeft: 12,
    paddingRight: 4,
    borderBottomWidth: 0.5,
  },
  summary: {
    flexGrow: 1,
    flexShrink: 1,
  },
  btns: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btn: {
    paddingLeft: 12,
    paddingRight: 12,
    height: '100%',
    justifyContent: 'center',
  },
})
