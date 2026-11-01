import { memo, useEffect, useRef } from 'react'
import { Animated, Easing, TouchableOpacity, View } from 'react-native'

import { Icon } from './Icon'
import Image from './Image'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo, useProgress, useIsPlay } from '@/store/player/hook'

/** 专辑封面外的分段进度环（竖屏底部胶囊 / 横屏侧栏共用） */
const SEGMENTS = 36

export const ProgressRing = ({ ratio, size, activeColor, inactiveColor = 'rgba(255,255,255,0.26)' }: {
  ratio: number
  size: number
  activeColor: string
  inactiveColor?: string
}) => {
  const radius = size / 2 - 4
  const items = []
  for (let i = 0; i < SEGMENTS; i++) {
    items.push({
      key: i,
      angle: (360 / SEGMENTS) * i,
      active: i / SEGMENTS < ratio,
    })
  }

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {
        items.map(item => (
          <View
            key={item.key}
            style={{
              position: 'absolute',
              width: 2,
              height: 5,
              borderRadius: 1,
              backgroundColor: item.active ? activeColor : inactiveColor,
              transform: [{ rotate: `${item.angle}deg` }, { translateY: -radius }],
            }}
          />
        ))
      }
    </View>
  )
}

/** 圆盘里的专辑图：播放时缓慢自转 */
const Disc = ({ pic, size }: { pic?: string | null, size: number }) => {
  const isPlay = useIsPlay()
  const spin = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!isPlay) return
    const anim = Animated.loop(Animated.timing(spin, {
      toValue: 1,
      duration: 14000,
      easing: Easing.linear,
      useNativeDriver: true,
    }))
    anim.start()
    return () => { anim.stop() }
  }, [isPlay, spin])

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    >
      {
        pic
          ? <Image url={pic} style={{ width: size, height: size, borderRadius: size / 2 }} />
          : (
            <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' }}>
              <Icon name='music_time' size={Math.round(size * 0.37)} color='rgba(255,255,255,0.75)' />
            </View>
            )
      }
    </Animated.View>
  )
}

export default memo(({ size = 56, inactiveColor, onPress }: {
  size?: number
  inactiveColor?: string
  onPress: () => void
}) => {
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()
  const { progress } = useProgress()
  const discSize = size - 18

  return (
    <TouchableOpacity
      style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <ProgressRing ratio={progress} size={size} activeColor={theme['c-primary']} inactiveColor={inactiveColor} />
      <Disc pic={musicInfo.pic} size={discSize} />
    </TouchableOpacity>
  )
})
