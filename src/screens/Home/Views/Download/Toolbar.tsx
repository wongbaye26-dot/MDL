import { memo } from 'react'
import { View, TouchableOpacity, Image, ImageBackground } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import type { DownloadStats } from '@/store/download/hook'

const emoHeaderBg = require('@/resources/images/emo-header.png')
const emoLogo = require('@/resources/images/emo-logo.png')

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
    <ImageBackground source={emoHeaderBg} style={styles.header} imageStyle={styles.headerImage}>
      <View style={styles.topRow}>
        <Image source={emoLogo} style={styles.logo} />
        <View style={styles.titleBlock}>
          <Text size={22} color='#FFFFFF' style={styles.title}>下载中心</Text>
          <Text size={11} color='rgba(255, 255, 255, 0.62)' style={styles.subtitle}>
            {`共 ${stats.total} 首 · 已完成 ${stats.completed} · 下载中 ${stats.running}`}
          </Text>
        </View>
        {
          stats.completed > 0
            ? (
                <TouchableOpacity onPress={onClearCompleted} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text size={11} color='rgba(255, 255, 255, 0.55)'>清空已完成</Text>
                </TouchableOpacity>
              )
            : null
        }
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={{ ...styles.pill, backgroundColor: theme['c-primary'], opacity: stats.total === 0 ? 0.4 : 1 }}
          onPress={onStartAll}
          disabled={stats.total === 0}
        >
          <Icon name="download-2" color='#FFFFFF' size={13} />
          <Text size={12} color='#FFFFFF' style={styles.pillText}>全部开始</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ ...styles.pillGhost, opacity: stats.running === 0 ? 0.4 : 1 }}
          onPress={onPauseAll}
          disabled={stats.running === 0}
        >
          <Icon name="pause" color='rgba(255, 255, 255, 0.9)' size={13} />
          <Text size={12} color='rgba(255, 255, 255, 0.9)' style={styles.pillText}>全部暂停</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  )
})

const styles = createStyle({
  header: {
    paddingTop: 18,
    paddingBottom: 16,
    paddingLeft: 16,
    paddingRight: 16,
    marginBottom: 4,
  },
  headerImage: {
    resizeMode: 'cover',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 13,
    marginRight: 12,
  },
  titleBlock: {
    flexGrow: 1,
    flexShrink: 1,
  },
  title: {
    fontWeight: '700',
    letterSpacing: 1,
  },
  subtitle: {
    marginTop: 3,
    letterSpacing: 0.4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 9,
    paddingBottom: 9,
    borderRadius: 20,
    marginRight: 10,
  },
  pillGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 9,
    paddingBottom: 9,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  pillText: {
    marginLeft: 5,
  },
})
