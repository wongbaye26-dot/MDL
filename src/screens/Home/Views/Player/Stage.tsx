import { memo } from 'react'
import { View, Image as RNImage, StyleSheet } from 'react-native'

import SoftEdge from './SoftEdge'

/**
 * 飞牛实测（1080x2340 @420dpi → dp）：
 *   上倒影 0..96.8 / 封面 96.8..556.2（高 459.4）/ 下倒影 556.2..891.4
 *   封面顶部柔化带 91.8（20%）、底部柔化带 120（26%）、左右各 5%
 * 倒影是封面的镜像 + 强高斯模糊，直接铺到屏幕顶/底，所以看不到边框。
 */
export const COVER_TOP_RATIO = 0.1086
export const COVER_H_RATIO = 0.5153

const TOP_SOFT = 0.2
const BOTTOM_SOFT = 0.26
const SIDE_SOFT = 0.05

export default memo(({ pic, width, height, hidden }: {
  pic?: string
  width: number
  height: number
  hidden?: boolean
}) => {
  const coverH = height * COVER_H_RATIO
  const coverTop = height * COVER_TOP_RATIO
  const refBottomH = height - coverTop - coverH
  const coverW = width

  if (!pic) {
    return (
      <View pointerEvents='none' style={[StyleSheet.absoluteFill, { opacity: hidden ? 0 : 1 }]}>
        <View style={{ marginTop: coverTop, height: coverH, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: coverW, height: coverH, backgroundColor: 'rgba(255,255,255,0.04)' }} />
        </View>
      </View>
    )
  }

  return (
    <View pointerEvents='none' style={[StyleSheet.absoluteFill, { opacity: hidden ? 0 : 1 }]}>
      {/* ── 上倒影：封面镜像，向屏幕顶部淡出 ── */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: coverTop, overflow: 'hidden' }}>
        <View style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: coverH,
          transform: [{ scaleY: -1 }],
        }}>
          <SoftEdge
            uri={pic}
            blurRadius={26}
            dir='up'
            bandPx={coverTop}
            boxW={coverW}
            boxH={coverH}
            from={1}
            to={0.34}
            steps={8}
          />
        </View>
      </View>

      {/* ── 封面 + 四边柔化 ── */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: coverTop, height: coverH, overflow: 'hidden' }}>
        <RNImage source={{ uri: pic }} resizeMode='cover' style={{ width: coverW, height: coverH }} />
        {/* 上/下强柔化：边缘 100% 糊，往内线性衰减到 0 */}
        <SoftEdge
          uri={pic}
          blurRadius={26}
          dir='up'
          bandPx={coverH * TOP_SOFT}
          boxW={coverW}
          boxH={coverH}
          from={1}
          to={0}
          steps={12}
        />
        <SoftEdge
          uri={pic}
          blurRadius={26}
          dir='down'
          bandPx={coverH * BOTTOM_SOFT}
          boxW={coverW}
          boxH={coverH}
          from={1}
          to={0}
          steps={12}
        />
        {/* 左右弱柔化 */}
        <SoftEdge
          uri={pic}
          blurRadius={26}
          dir='left'
          bandPx={coverW * SIDE_SOFT}
          boxW={coverW}
          boxH={coverH}
          from={0.5}
          to={0}
          steps={6}
        />
        <SoftEdge
          uri={pic}
          blurRadius={26}
          dir='right'
          bandPx={coverW * SIDE_SOFT}
          boxW={coverW}
          boxH={coverH}
          from={0.5}
          to={0}
          steps={6}
        />
      </View>

      {/* ── 下倒影：封面镜像，向屏幕底部淡出 ── */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: coverTop + coverH, height: refBottomH, overflow: 'hidden' }}>
        <View style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: coverH,
          transform: [{ scaleY: -1 }],
        }}>
          <SoftEdge
            uri={pic}
            blurRadius={26}
            dir='down'
            bandPx={refBottomH}
            boxW={coverW}
            boxH={coverH}
            from={1}
            to={0.3}
            steps={8}
          />
        </View>
      </View>
    </View>
  )
})
