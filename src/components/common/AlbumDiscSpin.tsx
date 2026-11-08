import { memo, useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import LinearGradient from 'react-native-linear-gradient'

import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { usePlayerMusicInfo, useIsPlay } from '@/store/player/hook'
import { useReducedMotion } from '@/utils/hooks'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'

/**
 * 专辑圆盘：底部胶囊 / 横竖屏迷你播放器 / 子页迷你播放条**唯一**的封面实现。
 *
 * 用户要求「横竖屏迷你播放器的专辑封面样式完全对齐胶囊任务栏的圆盘」，
 * 所以尺寸、圆角、描边、自转、进度环、阴影、高光、间距全部在这里定义，
 * 任何一处要调，三处同时生效，不会再各写一套慢慢跑偏。
 *
 * 结构（由外到内）：
 *   1. 进度环（DISC_RING_SIZE=54）：常显的淡色轨道 + 四层柔光进度弧（progress=0 时只剩轨道，
 *      所以默认也能看到一圈完整的圆环底），整体做 1.9s 呼吸；
 *   2. 阴影：父级都是 overflow:hidden 的玻璃条，elevation 会被裁掉，改用一圈半透明深色
 *      兜出圆盘的厚度（和胶囊里圆盘压在玻璃上的观感一致）；
 *   3. 封面（DISC_SIZE=48）：正圆 + 裁切，播放时 14s 自转一圈（native driver）；
 *   4. 描边 + 高光：固定不转，白色高光始终从左上打下来 —— 像玻璃盖在唱片上，
 *      转动的是封面，反光不动，这才是「实体圆盘」而不是「转起来的贴图」。
 *
 * 性能：自转 / 呼吸都是 useNativeDriver 的 transform、opacity，不占 JS 线程，
 * 胶囊和迷你播放器可以同时挂几个而不掉帧。
 */

/** 封面直径（和胶囊右侧圆盘同尺寸） */
export const DISC_SIZE = 48
/** 外圈进度环直径：比封面大 6dp，四周各留 3dp 的间隙 */
export const DISC_RING_SIZE = 54
/** 自转一圈的时间，三处保持一致 */
const SPIN_DURATION = 14000
/** 进度环轨道线宽 */
const RING_TRACK_WIDTH = 2
/** 呼吸节奏：和胶囊边缘的进度光 / 跑马灯同一套慢呼吸 */
const BREATHE_DURATION = 1900
const BREATHE_MIN = 0.62
const BREATHE_MAX = 1

/**
 * 外圈进度环。
 *
 * 轨道**常显**（progress=0 也有可见圆环底），进度弧从 -90°（正上方）起顺时针叠加；
 * 四层「外晕 → 中光 → 细芯」由宽到窄、由淡到亮，和胶囊边缘的进度光是同一套语言，
 * 所以弧和轨道叠在一起时是自然过渡，不会出现一条生硬的线。
 */
const ProgressRing = ({ size, ratio, color, trackColor, breathe }: {
  size: number
  ratio: number
  color: string
  trackColor: string
  breathe: Animated.Value
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
    <Animated.View
      pointerEvents='none'
      style={{ ...StyleSheet.absoluteFillObject, opacity: clamped > 0.002 ? breathe : 1 }}
    >
      <Svg width={size} height={size}>
        {/* 轨道：一直可见，让用户知道这里会显示播放进度 */}
        <Circle cx={center} cy={center} r={r} fill='none' stroke={trackColor} strokeWidth={RING_TRACK_WIDTH} />
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
    </Animated.View>
  )
}

export default memo(({
  discSize = DISC_SIZE,
  ringSize = DISC_RING_SIZE,
  progress = 0,
  showRing = true,
  dark = false,
}: {
  /** 封面直径，默认就是胶囊圆盘的尺寸 */
  discSize?: number
  /** 外圈直径（含进度环），默认 54 */
  ringSize?: number
  /** 0~1 */
  progress?: number
  /** 是否显示外圈进度环（进度样式设为「关闭」时连轨道也不画） */
  showRing?: boolean
  /** 深色底（播放器页 / 深色主题） */
  dark?: boolean
}) => {
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const theme = useTheme()
  const spin = useRef(new Animated.Value(0)).current
  const breathe = useRef(new Animated.Value(BREATHE_MIN)).current
  const reduced = useReducedMotion()
  const coverRotation = useSettingValue('common.coverRotation')

  useEffect(() => {
    if (!isPlay || reduced || !coverRotation) {
      spin.setValue(0)
      return
    }
    const anim = Animated.loop(Animated.timing(spin, {
      toValue: 1,
      duration: SPIN_DURATION,
      easing: Easing.linear,
      useNativeDriver: true,
    }))
    anim.start()
    return () => { anim.stop() }
  }, [isPlay, spin, reduced, coverRotation])

  useEffect(() => {
    // 进度样式设为「关闭」时不画圆环，这圈呼吸也没意义，别让动画空转；
    // 暂停时也停掉呼吸（之前即使暂停也在 60fps 空转）
    if (!showRing || reduced || !isPlay) {
      breathe.setValue(BREATHE_MIN)
      return
    }
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: BREATHE_MAX, duration: BREATHE_DURATION, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: BREATHE_MIN, duration: BREATHE_DURATION, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]))
    anim.start()
    return () => { anim.stop() }
  }, [breathe, showRing, reduced, isPlay])

  const radius = discSize / 2
  const ratio = Math.max(0, Math.min(1, progress))
  const shadowSize = discSize + 4
  // 深色玻璃上高光要更亮一点才看得出来；亮色玻璃本来就是白的，用更强的白边
  const glossColors = dark
    ? ['rgba(255,255,255,0.24)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']
    : ['rgba(255,255,255,0.40)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']

  return (
    <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
      {/* 阴影：半透明深色兜一圈，父级裁切后仍然能看出圆盘是「浮」在玻璃上的 */}
      <View
        pointerEvents='none'
        style={{
          position: 'absolute',
          width: shadowSize,
          height: shadowSize,
          borderRadius: shadowSize / 2,
          backgroundColor: dark ? 'rgba(0,0,0,0.40)' : 'rgba(110,98,133,0.22)',
          opacity: 0.7,
        }}
      />

      {
        showRing
          ? (
            <ProgressRing
              size={ringSize}
              ratio={ratio}
              color={theme['c-primary']}
              trackColor={dark ? 'rgba(255,255,255,0.26)' : 'rgba(30,24,40,0.16)'}
              breathe={breathe}
            />
            )
          : null
      }

      <Animated.View
        style={{
          width: discSize,
          height: discSize,
          borderRadius: radius,
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
                <Icon name='music_time' rawSize={Math.round(discSize * 0.34)} color={theme['c-primary']} />
              </View>
              )
        }
      </Animated.View>

      {/* 描边：不跟着转，像玻璃盖在封面上的边 */}
      <View
        pointerEvents='none'
        style={{
          position: 'absolute',
          width: discSize,
          height: discSize,
          borderRadius: radius,
          borderWidth: 0.5,
          borderColor: dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.72)',
        }}
      />

      {/* 高光：固定不转，光从左上打下来（和胶囊玻璃反光同一个方向） */}
      <View
        pointerEvents='none'
        style={{
          position: 'absolute',
          width: discSize,
          height: discSize,
          borderRadius: radius,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={glossColors}
          locations={[0, 0.52, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '62%' }}
        />
        <View
          style={{
            position: 'absolute',
            left: discSize * 0.14,
            top: discSize * 0.10,
            width: discSize * 0.46,
            height: discSize * 0.14,
            borderRadius: discSize * 0.07,
            backgroundColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.24)',
            transform: [{ rotate: '-28deg' }],
          }}
        />
      </View>
    </View>
  )
})
