import { memo } from 'react'
import Svg, { Path } from 'react-native-svg'

/** 「添加至歌单」图标（来自用户提供的 SVG），颜色/尺寸可控 */
export default memo(({ size = 24, color = '#FFFFFF' }: { size?: number, color?: string }) => (
  <Svg width={size} height={size} viewBox='0 0 1024 1024'>
    <Path
      fill={color}
      stroke={color}
      strokeWidth={20}
      strokeLinejoin='round'
      strokeLinecap='round'
      d='M512 942C274.9 942 82 749.1 82 512S274.9 82 512 82s430 192.9 430 430-192.9 430-430 430z m0-800c-204 0-370 166-370 370s166 370 370 370 370-166 370-370-166-370-370-370z m0 626.3c-16.6 0-30-13.4-30-30V285.8c0-16.6 13.4-30 30-30s30 13.4 30 30v452.5c0 16.6-13.4 30-30 30zM738.3 542H285.8c-16.6 0-30-13.4-30-30s13.4-30 30-30h452.5c16.6 0 30 13.4 30 30s-13.4 30-30 30z'
    />
  </Svg>
))
