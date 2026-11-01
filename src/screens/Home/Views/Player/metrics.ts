import { scaleSizeH } from '@/utils/pixelRatio'

/**
 * 本 App 的 createStyle / Icon / Text 都会按「375x667 设计稿」放大样式数值
 * （scale = min(屏宽px/375, 屏高px/667, 3.1) / pixelRatio），本机约 1.097。
 *
 * 飞牛那边的实测值是真 dp，所以要反算回去才能真正 1:1 对齐：
 *   - 布局：直接用普通对象样式（不经过 createStyle），数值就是真 dp
 *   - 字号/图标：传 u(v)，抵消 setSpText / scaleSizeW 的放大
 */
export const K = scaleSizeH(1000) / 1000

/** 真 dp → 需要传给 Text/Icon 的 size
 *  setSpText 内部是 floor(size * K)，直接除会掉 1sp，这里补 0.4 抵掉取整误差 */
export const u = (v: number) => (v + 0.4) / K
