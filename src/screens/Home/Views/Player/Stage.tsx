import { memo } from 'react'
import { View, Image as RNImage, StyleSheet } from 'react-native'

import FadeMask from './FadeMask'
import CoverPlaceholder from '@/components/common/CoverPlaceholder'

/**
 * 飞牛实测（1080x2340 @420dpi → dp）：
 *   上倒影 0..96.8 / 封面 96.8..556.2（高 459.4）/ 下倒影 556.2..891.4
 *   封面顶部柔化带 91.8（20%）、底部柔化带 120（26%）、左右各 5%
 * 倒影是封面的镜像 + 高斯模糊，直接铺到屏幕顶/底，所以看不到边框。
 */
export const COVER_TOP_RATIO = 0.1086
export const COVER_H_RATIO = 0.5153

const TOP_SOFT = 0.2
const BOTTOM_SOFT = 0.26
const SIDE_SOFT = 0.05
/** 柔化带和倒影用同一个模糊半径，接缝处才不会出现清晰度跳变 */
const BLUR = 26

export default memo(({ pic, name, width, height, hidden }: {
  pic?: string
  /** 无封面时用歌名首字做占位 */
  name?: string
  width: number
  height: number
  hidden?: boolean
}) => {
  const coverW = width
  const coverH = height * COVER_H_RATIO
  const coverTop = height * COVER_TOP_RATIO
  const refBottomH = height - coverTop - coverH

  const topBandH = coverH * TOP_SOFT
  const bottomBandH = coverH * BOTTOM_SOFT
  const sideBandW = coverW * SIDE_SOFT

  if (!pic) {
    return (
      <View pointerEvents='none' style={[StyleSheet.absoluteFill, { opacity: hidden ? 0 : 1 }]}>
        <View style={{ marginTop: coverTop, height: coverH }}>
          <CoverPlaceholder name={name} width={coverW} height={coverH} radius={0} />
        </View>
      </View>
    )
  }

  const blurred = (style?: any) => (
    <RNImage source={{ uri: pic }} blurRadius={BLUR} resizeMode='cover' style={[{ width: coverW, height: coverH }, style]} />
  )

  return (
    <View pointerEvents='none' style={[StyleSheet.absoluteFill, { opacity: hidden ? 0 : 1 }]}>
      {/* ── 上倒影：封面镜像，屏幕顶 34% → 接缝 100% ── */}
      <FadeMask width={coverW} height={coverTop} from={0.34} to={1} style={{ left: 0, top: 0 }}>
        <View style={{ position: 'absolute', left: 0, bottom: 0, width: coverW, height: coverH, transform: [{ scaleY: -1 }] }}>
          {blurred()}
        </View>
      </FadeMask>

      {/* ── 封面 + 四边柔化 ── */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: coverTop, height: coverH, overflow: 'hidden' }}>
        <RNImage source={{ uri: pic }} resizeMode='cover' style={{ width: coverW, height: coverH }} />

        {/* 上边：边缘 100% 糊 → 往内 0 */}
        <FadeMask width={coverW} height={topBandH} from={1} to={0} style={{ left: 0, top: 0 }}>
          {blurred()}
        </FadeMask>

        {/* 下边 */}
        <FadeMask width={coverW} height={bottomBandH} from={0} to={1} style={{ left: 0, bottom: 0 }}>
          {blurred({ position: 'absolute', left: 0, top: -(coverH - bottomBandH) })}
        </FadeMask>

        {/* 左右弱柔化（飞牛更弱，峰值只给 50%） */}
        <FadeMask width={sideBandW} height={coverH} from={0.5} to={0} dir='h' style={{ left: 0, top: 0 }}>
          {blurred()}
        </FadeMask>
        <FadeMask width={sideBandW} height={coverH} from={0} to={0.5} dir='h' style={{ right: 0, top: 0 }}>
          {blurred({ position: 'absolute', top: 0, left: -(coverW - sideBandW) })}
        </FadeMask>
      </View>

      {/* ── 下倒影：接缝 100% → 屏幕底 34% ── */}
      <FadeMask width={coverW} height={refBottomH} from={1} to={0.34} style={{ left: 0, top: coverTop + coverH }}>
        <View style={{ position: 'absolute', left: 0, top: 0, width: coverW, height: coverH, transform: [{ scaleY: -1 }] }}>
          {blurred()}
        </View>
      </FadeMask>
    </View>
  )
})
