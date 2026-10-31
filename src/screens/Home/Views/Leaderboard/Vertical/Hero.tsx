import { View, TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

export interface HeroProps {
  name: string
  meta: string
  onPlayAll: () => void
  onDownloadAll: () => void
}

export default ({ name, meta, onPlayAll, onDownloadAll }: HeroProps) => {
  const theme = useTheme()

  return (
    <View style={{
      ...styles.hero,
      backgroundColor: theme['c-primary-alpha-900'],
      borderColor: theme['c-primary-alpha-700'],
    }}>
      <View style={styles.watermark} pointerEvents='none'>
        <Icon name='leaderboard' size={76} color={theme['c-primary-alpha-800']} />
      </View>
      <View style={styles.info}>
        <Text size={18} numberOfLines={1} style={styles.name}>{name || '加载中…'}</Text>
        <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.meta}>{meta}</Text>
      </View>
      <TouchableOpacity
        style={{ ...styles.playBtn, backgroundColor: theme['c-primary'] }}
        activeOpacity={0.85}
        onPress={onPlayAll}
      >
        <Icon name='play' size={12} color='#FFFFFF' />
        <Text size={11} color='#FFFFFF' style={styles.playText}>播放全部</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{ ...styles.dlBtn, borderColor: theme['c-primary-alpha-600'] }}
        activeOpacity={0.7}
        onPress={onDownloadAll}
      >
        <Icon name='download-2' size={15} color={theme['c-primary-light-200']} />
      </TouchableOpacity>
    </View>
  )
}

const styles = createStyle({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    marginRight: 16,
    marginTop: 12,
    paddingLeft: 14,
    paddingRight: 10,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: 18,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    right: 6,
    bottom: -10,
    opacity: 0.7,
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 8,
  },
  name: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  meta: {
    marginTop: 4,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    paddingLeft: 11,
    paddingRight: 12,
    borderRadius: 15,
  },
  playText: {
    marginLeft: 5,
    fontWeight: '600',
  },
  dlBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 0.8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
})
