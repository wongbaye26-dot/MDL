import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo, useIsPlay, useProgress } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useKeyboard } from '@/utils/hooks'
import { playNext, togglePlay } from '@/core/player/player'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import { createStyle } from '@/utils/tools'

export default memo(() => {
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const { progress } = useProgress()
  const autoHidePlayBar = useSettingValue('common.autoHidePlayBar')
  const { keyboardShown } = useKeyboard()

  if (autoHidePlayBar && keyboardShown) return null
  if (!musicInfo.name) return null

  const openDetail = () => {
    const componentId = commonState.componentIds.home
    if (componentId) navigations.pushPlayDetailScreen(componentId)
  }

  return (
    <View style={{ ...styles.wrap, backgroundColor: theme['c-content-background'] }}>
      <View style={{ ...styles.card, backgroundColor: theme['c-primary-alpha-900'], borderColor: theme['c-primary-alpha-700'] }}>
        <TouchableOpacity style={styles.infoArea} activeOpacity={0.75} onPress={openDetail}>
          <Image url={musicInfo.pic} style={styles.pic} />
          <View style={styles.textArea}>
            <Text size={13} numberOfLines={1} style={styles.name}>{musicInfo.name}</Text>
            <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.singer}>{musicInfo.singer}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} activeOpacity={0.6} onPress={() => { void togglePlay() }}>
          <Icon name={isPlay ? 'pause' : 'play'} color={theme['c-font']} size={22} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} activeOpacity={0.6} onPress={() => { void playNext() }}>
          <Icon name='nextMusic' color={theme['c-font']} size={19} />
        </TouchableOpacity>
        <View style={{ ...styles.progressTrack, backgroundColor: theme['c-primary-alpha-700'] }}>
          <View style={{ ...styles.progressBar, width: `${Math.max(0, Math.min(100, progress))}%`, backgroundColor: theme['c-primary'] }} />
        </View>
      </View>
    </View>
  )
})

const styles = createStyle({
  wrap: {
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 6,
    paddingBottom: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 0.5,
    paddingLeft: 8,
    paddingRight: 4,
    paddingTop: 7,
    paddingBottom: 7,
    elevation: 6,
    overflow: 'hidden',
  },
  infoArea: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pic: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  textArea: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 10,
    marginRight: 6,
  },
  name: {
    fontWeight: '600',
  },
  singer: {
    marginTop: 2,
  },
  btn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
  },
  progressBar: {
    height: '100%',
  },
})
