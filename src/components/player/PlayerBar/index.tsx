import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { Navigation } from 'react-native-navigation'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo, useIsPlay, useProgress } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useKeyboard } from '@/utils/hooks'
import { togglePlay } from '@/core/player/player'
import { setNavActiveId } from '@/core/common'
import commonState from '@/store/common/state'
import { createStyle } from '@/utils/tools'

/** 回到首页并切到内置播放器页签 */
const openPlayerTab = () => {
  const homeId = commonState.componentIds.home
  if (homeId) {
    try {
      // 弹掉栈上的详情页，回到首页后再切页签
      void Navigation.popTo(homeId).catch(() => {})
    } catch {}
  }
  setTimeout(() => { setNavActiveId('nav_player') }, homeId ? 140 : 0)
}

export default memo(({ isHome = false }: { isHome?: boolean }) => {
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const { progress } = useProgress()
  const autoHidePlayBar = useSettingValue('common.autoHidePlayBar')
  const { keyboardShown } = useKeyboard()

  if (autoHidePlayBar && keyboardShown) return null
  if (!musicInfo.name) return null

  const ratio = Math.max(0, Math.min(1, progress))
  void isHome

  return (
    <View style={{ ...styles.wrap, backgroundColor: theme['c-content-background'] }}>
      <View style={{
        ...styles.card,
        backgroundColor: theme['c-primary-alpha-900'],
        borderColor: theme['c-primary-alpha-700'],
      }}>
        <TouchableOpacity style={styles.infoArea} activeOpacity={0.75} onPress={openPlayerTab}>
          <View style={styles.picWrap}>
            <Image url={musicInfo.pic} style={styles.pic} />
          </View>
          <View style={styles.textArea}>
            <Text size={14} numberOfLines={1} style={styles.name}>{musicInfo.name}</Text>
            <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.singer}>{musicInfo.singer}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} activeOpacity={0.6} onPress={togglePlay}>
          <Icon name={isPlay ? 'pause' : 'play'} color={theme['c-font']} size={24} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} activeOpacity={0.6} onPress={openPlayerTab}>
          <Icon name='playlist-music' color={theme['c-font']} size={22} />
        </TouchableOpacity>

        {/* 底部细进度条 */}
        <View style={{ ...styles.progressTrack, backgroundColor: theme['c-primary-alpha-700'] }}>
          <View style={{ ...styles.progressBar, width: `${ratio * 100}%`, backgroundColor: theme['c-primary'] }} />
        </View>
      </View>
    </View>
  )
})

const styles = createStyle({
  wrap: {
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 6,
    paddingBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 26,
    borderWidth: 0.5,
    paddingLeft: 7,
    paddingRight: 4,
    paddingTop: 6,
    paddingBottom: 6,
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    overflow: 'hidden',
  },
  infoArea: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  picWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    overflow: 'hidden',
  },
  pic: {
    width: 42,
    height: 42,
    borderRadius: 13,
  },
  textArea: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 11,
    marginRight: 6,
  },
  name: {
    fontWeight: '600',
  },
  singer: {
    marginTop: 3,
  },
  btn: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressTrack: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 0,
    height: 2,
    borderRadius: 1,
  },
  progressBar: {
    height: '100%',
    borderRadius: 1,
  },
})
