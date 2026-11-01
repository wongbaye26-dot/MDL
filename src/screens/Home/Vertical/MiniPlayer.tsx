import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import Glass from '@/components/common/Glass'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo, useIsPlay, useProgress } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useKeyboard } from '@/utils/hooks'
import { playNext, togglePlay } from '@/core/player/player'
import { setNavActiveId } from '@/core/common'
import { getPlayerPalette } from '@/theme/playerPalette'
import PlayGlyph from '../Views/Player/PlayGlyph'
import { createStyle } from '@/utils/tools'

/**
 * 横屏内容区底部的迷你播放器。
 *
 * 之前点它走的是 LX 老路由（pushPlayDetailScreen），会跳到旧版横屏播放页；
 * 现在和竖屏胶囊里的圆盘一样，直接切 nav_player（我们自己的播放器页）。
 * 视觉也换成和胶囊同一层玻璃 + 主题强调色。
 */
export default memo(() => {
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const { progress } = useProgress()
  const autoHidePlayBar = useSettingValue('common.autoHidePlayBar')
  const { keyboardShown } = useKeyboard()
  const palette = getPlayerPalette(theme)
  const isDark = theme.isDark

  if (autoHidePlayBar && keyboardShown) return null
  if (!musicInfo.name) return null

  const openPlayer = () => { setNavActiveId('nav_player') }

  return (
    <View style={styles.wrap} pointerEvents='box-none'>
      <View
        style={{
          ...styles.card,
          backgroundColor: isDark ? 'rgba(24,18,34,0.20)' : 'rgba(255,255,255,0.12)',
          borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.72)',
          shadowColor: isDark ? '#000000' : '#6E6285',
        }}
      >
        <Glass
          blurRadius={22}
          tint={isDark ? 'rgba(20,15,30,0.30)' : 'rgba(255,255,255,0.20)'}
          radius={22}
        />

        <TouchableOpacity
          style={styles.infoArea}
          activeOpacity={0.75}
          onPress={openPlayer}
        >
          <Image url={musicInfo.pic} style={styles.pic} />
          <View style={styles.textArea}>
            <Text size={13} numberOfLines={1} style={styles.name}>{musicInfo.name}</Text>
            <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.singer}>{musicInfo.singer}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.playBtn}
          activeOpacity={0.8}
          onPress={togglePlay}
        >
          <View style={{ ...styles.playCircle, backgroundColor: palette.accent }}>
            <PlayGlyph playing={isPlay} box={14} color={palette.onAccent} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} activeOpacity={0.6} onPress={() => { void playNext() }}>
          <Icon name='nextMusic' color={palette.accent} size={18} />
        </TouchableOpacity>

        <View style={{ ...styles.progressTrack, backgroundColor: palette.track }}>
          <View style={{ ...styles.progressBar, width: `${Math.max(0, Math.min(100, progress))}%`, backgroundColor: palette.accent }} />
        </View>
      </View>
    </View>
  )
})

const styles = createStyle({
  wrap: {
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 4,
    paddingBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 0.5,
    paddingLeft: 8,
    paddingRight: 6,
    paddingTop: 6,
    paddingBottom: 6,
    elevation: 10,
    shadowOpacity: 0.26,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    overflow: 'hidden',
  },
  infoArea: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pic: {
    width: 38,
    height: 38,
    borderRadius: 11,
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
  playBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btn: {
    width: 38,
    height: 40,
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
