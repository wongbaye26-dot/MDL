/**
 * 播放器 / 歌词页的 Material You 色板。
 *
 * 为什么不能直接用 `c-primary`：
 *  - 播放器底色永远是深色（封面糊底），而 M3 在深色表面上用的是 **tone 80** 的 primary
 *    （浅而高彩度的柔和色），直接拿 c-primary（tone 60 左右）压上去会发闷、发脏；
 *  - 封面本身自带一套高饱和色（比如暖橙封面 + 赤红种子），两套色相互相打架，
 *    所以背景要往种子色相上「靠」一层，强调色才立得住。
 *
 * 这里按种子色的 H/S 重新算一组「播放器专用」的 M3 角色色，
 * 换种子色时整页氛围（背景染色 + 进度条 + 播放键 + 当前歌词）会一起变。
 */

interface HSL {
  h: number
  s: number
  l: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const parseRgb = (color: string): [number, number, number] | null => {
  if (typeof color !== 'string') return null
  const value = color.trim()
  if (value[0] === '#') {
    const hex = value.slice(1)
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ]
    }
    if (hex.length >= 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ]
    }
    return null
  }
  const matched = /^rgba?\(([^)]+)\)$/i.exec(value)
  if (!matched) return null
  const parts = matched[1].split(/[,/\s]+/).filter(Boolean)
  if (parts.length < 3) return null
  return [
    Math.round(clamp(Number.parseFloat(parts[0]), 0, 255)),
    Math.round(clamp(Number.parseFloat(parts[1]), 0, 255)),
    Math.round(clamp(Number.parseFloat(parts[2]), 0, 255)),
  ]
}

const rgbToHsl = ([r, g, b]: [number, number, number]): HSL => {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return { h: h * 360, s, l }
}

const hslToRgb = ({ h, s, l }: HSL): [number, number, number] => {
  const hue = (((h % 360) + 360) % 360) / 360
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  return [
    Math.round(channel(hue + 1 / 3) * 255),
    Math.round(channel(hue) * 255),
    Math.round(channel(hue - 1 / 3) * 255),
  ]
}

const rgbCss = (hsl: HSL) => {
  const [r, g, b] = hslToRgb(hsl)
  return `rgb(${r},${g},${b})`
}

const rgbaCss = (hsl: HSL, alpha: number) => {
  const [r, g, b] = hslToRgb(hsl)
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`
}

export interface PlayerPalette {
  /** 强调色：进度条填充 / 播放键 / 当前歌词行（M3 深色表面上的 tone 80 primary） */
  accent: string
  /** accent 上的图标色（深色种子，保证白底粉底上都够对比） */
  onAccent: string
  /** accent 的低透明度版本：播放键底圈、选中态 */
  accentWash: string
  /** 进度条未播放段：带种子的半透明，和填充同色相 */
  track: string
  /**
   * 页面压暗色。注意**彩度要低**：M3 的表面是「带一点点种子色相的中性深色」，
   * 如果压暗色也用高彩度的深红，背景和强调色就是同一个色相，强调色反而糊掉。
   */
  scrim: string
  /** 压暗层用的半透明版本（渐变遮罩要逐段给 alpha） */
  scrimAt: (alpha: number) => string
  /** 整页的底色压暗（叠在封面糊底上，压彩度用） */
  dim: string
  /** 次要文字（暖白，比纯白更贴主题） */
  textSecondary: string
  /** 更弱的说明文字 */
  textTertiary: string
}

const cache = new Map<string, PlayerPalette>()

/**
 * 从主题里取播放器色板。主题的 `c-primary` 是种子色本身（亮色主题保留原亮度），
 * 只取它的色相/饱和度，亮度全部重新定，所以亮/暗主题下播放器看起来是一致的。
 */
export const getPlayerPalette = (theme: LX.ActiveTheme): PlayerPalette => {
  const key = theme['c-primary'] ?? ''
  const cached = cache.get(key)
  if (cached) return cached

  const seed = parseRgb(key) ?? [255, 255, 255]
  const { h, s } = rgbToHsl(seed)
  // 灰色种子（极简灰）保持中性，不要硬加彩度
  const chroma = s < 0.12 ? s : clamp(s, 0.55, 0.92)

  const accentHsl: HSL = { h, s: chroma, l: 0.79 }
  // 表面色：种子色相 + 很低的彩度（0.30 倍）+ 很低亮度
  const surfaceHsl: HSL = { h, s: chroma * 0.30, l: 0.10 }

  const palette: PlayerPalette = {
    accent: rgbCss(accentHsl),
    onAccent: rgbCss({ h, s: Math.min(chroma, 0.52), l: 0.16 }),
    accentWash: rgbaCss(accentHsl, 0.18),
    // 0.38 的强调色叠在深底上 = 偏粉的灰，比纯白半透明「米黄」干净，也比 0.26 更看得见
    track: rgbaCss(accentHsl, 0.38),
    scrim: rgbCss(surfaceHsl),
    scrimAt: (alpha: number) => rgbaCss(surfaceHsl, alpha),
    dim: rgbaCss(surfaceHsl, 0.26),
    textSecondary: rgbaCss({ h, s: 0.22, l: 0.94 }, 0.74),
    textTertiary: rgbaCss({ h, s: 0.18, l: 0.92 }, 0.54),
  }

  if (cache.size > 24) cache.clear()
  cache.set(key, palette)
  return palette
}
