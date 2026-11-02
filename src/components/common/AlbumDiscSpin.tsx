import { memo, useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { usePlayerMusicInfo, useIsPlay } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'

/**
 * 会转的圆形专辑封面 + 外圈进度光环。
 *
 * 和底部胶囊里的圆盘是同一套做法（旋转 14s 一圈、进度环四层柔光叠加），
 * 抽出来给迷你播放器复用，省得两处各写一遍、慢慢跑偏。
 */

const RING_STROKE = 2

/** 外圈进度：四层同心圆环（宽→窄、淡→亮）叠出「发光」的观感 */
const ProgressRing = ({ size, ratio, color, inactiveColor }: {
  size: number
  ratio: number
  color: string
  inactiveColor: string
}) => {
  const center = size / 2
  const r = center - 1
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, ratio))

  const arc = (width: number, opacity: number) => (
    <Circle
      cx={center}
      cy={center}
      r={r}
      fill='none'
      stroke={color}
      strokeWidth={width}
      strokeOpacity={opacity}
      strokeLinecap='round'
      strokeDasharray={[c * clamped, c]}
      transform={`rotate(-90 ${center} ${center})`}
    />
  )

  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents='none'>
      <Circle cx={center} cy={center} r={r} fill='none' stroke={inactiveColor} strokeWidth={RING_STROKE} />
      {
        clamped > 0.002
          ? (
            <>
              {arc(6.5, 0.05)}
              {arc(4, 0.10)}
              {arc(2.2, 0.22)}
              {arc(1.1, 0.42)}
            </>
            )
          : null
      }
    </Svg>
  )
}

export default memo(({
  discSize = 40,
  ringSize = 54,
  progress = 0,
  showRing = true,
  dark = false,
}: {
  /** 封面直径 */
  discSize?: number
  /** 外圈直径（含进度环） */
  ringSize?: number
  /** 0~1 */
  progress?: number
  showRing?: boolean
  dark?: boolean
}) => {
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const theme = useTheme()
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
    <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
      {
        showRing
          ? (
            <ProgressRing
              size={ringSize}
              ratio={progress}
              color={theme['c-primary']}
              inactiveColor={dark ? 'rgba(255,255,255,0.22)' : 'rgba(30,24,40,0.14)'}
            />
            )
          : null
      }
      <Animated.View
        style={{
          width: discSize,
          height: discSize,
          borderRadius: discSize / 2,
          overflow: 'hidden',
          transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
        }}
      >
        {
          musicInfo.pic
            ? <Image url={musicInfo.pic} style={{ width: discSize, height: discSize }} />
            : (
              <View style={{
                width: discSize,
                height: discSize,
                backgroundColor: dark ? 'rgba(255,255,255,0.14)' : theme['c-primary-alpha-800'],
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon name='music_time' rawSize={16} color={theme['c-primary']} />
              </View>
              )
        }
      </Animated.View>
    </View>
  )
})
