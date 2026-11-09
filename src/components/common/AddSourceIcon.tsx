import { memo } from 'react'
import Svg, { Path } from 'react-native-svg'

/** 「添加音源」图标（来自用户提供的 SVG），颜色/尺寸可控 */
export default memo(({ size = 24, color = '#FFFFFF' }: { size?: number, color?: string }) => (
  <Svg width={size} height={size} viewBox='0 0 1024 1024'>
    <Path
      fill={color}
      d='M549.888 113.664v365.056h365.056v80.896l-365.056-0.512v365.056H468.992v-365.056l-365.056 0.512V478.72h365.056V113.664z'
    />
  </Svg>
))
