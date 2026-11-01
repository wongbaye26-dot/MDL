import { memo } from 'react'
import { View } from 'react-native'

/**
 * 播放 / 暂停图形。
 *
 * 不用图标字体：MaterialCommunityIcons 的 play/pause 字形墨迹在 em 框里是偏的
 * （实测暂停两条在 50dp 圆里整体右偏 1.5dp、下偏 1.9dp，而且高度占到圆的 58%），
 * 圆底 + 字形的组合一眼就能看出没对齐。这里直接用 View 画，几何是精确的。
 */
export default memo(({
  playing,
  /** 图形高度（dp），三角形和两条竖条都按它换算 */
  box,
  color,
}: {
  playing: boolean
  box: number
  color: string
}) => {
  if (playing) {
    // 暂停：两条竖条，条宽和间距都是 0.28 倍，整体正好居中
    const barW = box * 0.28
    return (
      <View style={{ height: box, flexDirection: 'row', alignItems: 'stretch' }}>
        <View style={{ width: barW, borderRadius: barW * 0.22, backgroundColor: color }} />
        <View style={{ width: barW, marginLeft: barW, borderRadius: barW * 0.22, backgroundColor: color }} />
      </View>
    )
  }
  // 播放：三角形。视觉重心在 1/3 处，往右挪一点点才是「看起来居中」
  const w = box * 0.86
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderTopWidth: box / 2,
        borderBottomWidth: box / 2,
        borderLeftWidth: w,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: color,
        marginLeft: w * 0.12,
      }}
    />
  )
})
