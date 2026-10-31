import { memo } from 'react'
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useTextShadow, useTheme } from '@/store/theme/hook'

const ICON_MAP: Record<string, string> = {
  'add-music': 'playlist-plus',
  'add_folder': 'folder-plus',
  'album': 'album',
  'available_updates': 'update',
  'back-2': 'arrow-left',
  'checkbox-blank-outline': 'checkbox-blank-outline',
  'checkbox-marked': 'checkbox-marked',
  'chevron-left': 'chevron-left',
  'chevron-left-2': 'chevron-left',
  'chevron-right': 'chevron-right',
  'chevron-right-2': 'chevron-right',
  'close': 'close',
  'comment': 'comment-outline',
  'dots-vertical': 'dots-vertical',
  'download-2': 'download',
  'eraser': 'eraser',
  'exit': 'logout',
  'exit2': 'logout-variant',
  'full_stop': 'stop',
  'help': 'help-circle-outline',
  'home': 'home-variant',
  'leaderboard': 'chart-bar',
  'list-loop': 'repeat',
  'list-order': 'format-list-numbered',
  'list-random': 'shuffle-variant',
  'logo': 'music-circle',
  'love': 'heart',
  'lyric-off': 'comment-remove-outline',
  'lyric-on': 'comment-text-outline',
  'menu': 'menu',
  'minus-box': 'minus-box',
  'music_time': 'music-note',
  'nextMusic': 'skip-next',
  'pause': 'pause',
  'play': 'play',
  'play-outline': 'play-outline',
  'playback-rate': 'speedometer',
  'prevMusic': 'skip-previous',
  'remove': 'delete-outline',
  'sd-card': 'sd',
  'search-2': 'magnify',
  'setting': 'cog',
  'share': 'share-variant',
  'single': 'repeat-once',
  'single-loop': 'repeat-once',
  'slider': 'tune',
  'thumbs-up': 'thumb-up-outline',
  'volume-higt': 'volume-high',
  'volume-low': 'volume-low',
  'volume-medium': 'volume-medium',
  'volume-mute': 'volume-mute',
  'volume-off': 'volume-off'
}

interface IconProps {
  name: string
  size?: number
  color?: string
  style?: StyleProp<TextStyle>
  rawSize?: number
}

const Icon = memo(({ name, size = 15, rawSize, color, style }: IconProps) => {
  const theme = useTheme()
  const textShadow = useTextShadow()
  const finalStyle = textShadow
    ? StyleSheet.compose({
      textShadowColor: theme['c-primary-dark-300-alpha-800'],
      textShadowOffset: { width: 0.2, height: 0.2 },
      textShadowRadius: 2
    }, style)
    : style
  const iconName = ICON_MAP[name] ?? name
  return (
    <MaterialCommunityIcons
      name={iconName as any}
      size={rawSize ?? scaleSizeW(size)}
      color={color ?? theme['c-font']}
      style={finalStyle}
    />
  )
})

export { Icon }
