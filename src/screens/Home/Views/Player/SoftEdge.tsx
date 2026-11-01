import { memo, useMemo } from 'react'
import { View, Image as RNImage } from 'react-native'

/**
 * 单向 alpha 渐变的模糊图。
 *
 * RN 没有 mask / linear-gradient 依赖，所以用 N 条「从边缘往里、长度递增」的裁切带叠加：
 * 第 k 条覆盖 [0, k/n]，alpha = 1/k，叠加后第 j 片的累计 alpha 正好是 1-(j-1)/n，
 * 也就是一条线性渐变。分层带来的阶梯是 1/n，n=12 时约 8%，在模糊图上肉眼不可见。
 *
 * 关键点：每一条带里的 <Image> 布局尺寸都相同（boxW x boxH），
 * 这样 Fresco 只会解码/模糊一张位图，而不是每条带各算一张。
 */
export type SoftEdgeDir = 'up' | 'down' | 'left' | 'right'

/** 计算 n 层叠加后得到 from→to 线性渐变所需的每层 alpha */
export const layerAlphas = (from: number, to: number, n: number) => {
  const alphas: number[] = new Array(n)
  // R_j = 1 - 目标累计 alpha，R_{n+1} = 1
  let nextR = 1
  for (let j = n; j >= 1; j--) {
    const t = n > 1 ? from + (to - from) * ((j - 1) / (n - 1)) : from
    const R = 1 - Math.max(0, Math.min(1, t))
    const a = 1 - R / nextR
    alphas[j - 1] = Math.max(0, Math.min(1, a))
    nextR = R
  }
  return alphas
}

export default memo(({
  uri,
  blurRadius,
  dir,
  bandPx,
  boxW,
  boxH,
  from,
  to,
  steps = 12,
}: {
  uri: string
  blurRadius: number
  dir: SoftEdgeDir
  /** 渐变带的长度（dp），从 dir 指向的那条边开始量 */
  bandPx: number
  /** 图片本身的布局尺寸，所有分层必须一致，否则位图缓存会爆 */
  boxW: number
  boxH: number
  /** 边缘处的 alpha */
  from: number
  /** 带内侧末端的 alpha */
  to: number
  steps?: number
}) => {
  const alphas = useMemo(() => layerAlphas(from, to, steps), [from, to, steps])

  return (
    <>
      {
        alphas.map((alpha, i) => {
          if (alpha <= 0.001) return null
          const len = (bandPx * (i + 1)) / steps
          let box: any
          let img: any
          if (dir === 'up') {
            box = { position: 'absolute', left: 0, right: 0, top: 0, height: len }
            img = { position: 'absolute', left: 0, top: 0, width: boxW, height: boxH }
          } else if (dir === 'down') {
            box = { position: 'absolute', left: 0, right: 0, bottom: 0, height: len }
            img = { position: 'absolute', left: 0, top: -(boxH - len), width: boxW, height: boxH }
          } else if (dir === 'left') {
            box = { position: 'absolute', top: 0, bottom: 0, left: 0, width: len }
            img = { position: 'absolute', top: 0, left: 0, width: boxW, height: boxH }
          } else {
            box = { position: 'absolute', top: 0, bottom: 0, right: 0, width: len }
            img = { position: 'absolute', top: 0, left: -(boxW - len), width: boxW, height: boxH }
          }
          return (
            <View key={i} pointerEvents='none' style={[box, { overflow: 'hidden', opacity: alpha }]}>
              <RNImage source={{ uri }} blurRadius={blurRadius} resizeMode='cover' style={img} />
            </View>
          )
        })
      }
    </>
  )
})
