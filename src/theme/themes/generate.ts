/**
 * Material You 主题生成器
 * 从一个种子色动态派生完整色阶，适配亮色/暗色两套语义。
 *
 * 语义说明（与 LX Music 主题结构一致）：
 *  - 亮色主题：`dark-N` 向黑递进，`light-N` 向白递进（light-1000 为纯白）
 *  - 暗色主题：`dark-N` 向白递进（dark-1000 接近白），`light-N` 向黑递进（light-1000 为深底色）
 */

interface HSL {
  h: number
  s: number
  l: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const hexToHsl = (hex: string): HSL => {
  let value = hex.replace('#', '').trim()
  if (value.length === 3) value = value.split('').map(c => c + c).join('')
  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      default: h = ((r - g) / d + 4) / 6
    }
  }
  return { h: h * 360, s, l }
}

const hslToRgb = ({ h, s, l }: HSL): [number, number, number] => {
  const hue = ((h % 360) + 360) % 360 / 360
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

const rgb = (hsl: HSL) => {
  const [r, g, b] = hslToRgb(hsl)
  return `rgb(${r},${g},${b})`
}

const rgba = (hsl: HSL, alpha: number) => {
  const [r, g, b] = hslToRgb(hsl)
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`
}

const STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] as const
const ALPHAS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const

/** 生成主题色阶对象 */
const buildPrimaryScales = (seed: HSL, isDark: boolean) => {
  const colors: Record<string, string> = {}
  const base = { h: seed.h, s: seed.s, l: seed.l }

  // 主色本身：暗色模式下适当提亮保证可读
  const primaryL = isDark ? clamp(seed.l < 0.55 ? seed.l + 0.2 : seed.l, 0.5, 0.78) : seed.l
  const primary: HSL = { ...base, l: primaryL }
  colors['c-primary'] = rgb(primary)

  for (const step of STEPS) {
    const ratio = step / 1000
    let darkL: number
    let lightL: number
    if (isDark) {
      // 暗色：dark 系列向白递进，light 系列向深底递进
      darkL = primaryL + (0.96 - primaryL) * ratio
      lightL = primaryL * (1 - ratio) + 0.13 * ratio
    } else {
      // 亮色：dark 系列向黑递进，light 系列向白递进
      darkL = primaryL * (1 - ratio * 0.86)
      lightL = primaryL + (1 - primaryL) * ratio
    }
    const darkHsl: HSL = { ...base, l: clamp(darkL, 0.04, 0.98) }
    const lightHsl: HSL = { ...base, l: clamp(lightL, 0.04, 1) }

    colors[`c-primary-dark-${step}`] = rgb(darkHsl)
    colors[`c-primary-light-${step}`] = rgb(lightHsl)
    for (const a of ALPHAS) {
      const alpha = 1 - a / 1000
      colors[`c-primary-dark-${step}-alpha-${a}`] = rgba(darkHsl, alpha)
      colors[`c-primary-light-${step}-alpha-${a}`] = rgba(lightHsl, alpha)
    }
  }

  for (const a of ALPHAS) {
    colors[`c-primary-alpha-${a}`] = rgba(primary, 1 - a / 1000)
  }

  colors['c-theme'] = colors['c-primary']
  return colors
}

/** 灰度色板：亮色由白到黑，暗色由深灰到近白 */
const buildGreyScale = (isDark: boolean) => {
  const colors: Record<string, string> = {}
  const writeGrey = (step: number) => {
    const ratio = step / 1000
    const l = isDark ? 0.34 + ratio * 0.6 : 1 - ratio * 0.87
    const v = Math.round(clamp(l, 0, 1) * 255)
    colors[`c-${String(step).padStart(3, '0')}`] = `rgb(${v},${v},${v})`
  }
  for (const step of STEPS) writeGrey(step)
  for (const step of [0, 50, 150, 250, 350, 450, 550, 650, 750, 850, 950] as const) writeGrey(step)
  return colors
}

/**
 * 从种子色生成完整主题
 * @param seedHex 种子色，如 `#6C5CE7`
 * @param isDark 是否暗色
 */
export const generateThemeFromSeed = (seedHex: string, isDark: boolean): LX.ActiveTheme => {
  const seed = hexToHsl(seedHex)
  const scales = buildPrimaryScales(seed, isDark)
  const greys = buildGreyScale(isDark)

  const themeColors = { ...greys, ...scales }

  const get = (key: string) => themeColors[key] ?? '#888888'

  const extInfo = isDark
    ? {
        'c-app-background': 'rgba(0, 0, 0, 0)',
        // 页面底色必须不透明：半透明会让下层页面透上来（亮色主题尤其明显）
        'c-main-background': 'rgb(18, 18, 20)',
        'c-badge-primary': get('c-primary-light-100'),
        'c-badge-secondary': 'rgb(236, 72, 153)',
        'c-badge-tertiary': get('c-primary-dark-200'),
        'bg-image-position': 'center',
        'bg-image-size': 'cover',
      }
    : {
        'c-app-background': get('c-primary-light-600-alpha-600'),
        'c-main-background': 'rgb(255, 255, 255)',
        'c-badge-primary': get('c-primary'),
        'c-badge-secondary': '#4baed5',
        'c-badge-tertiary': '#e7aa36',
        'bg-image-position': 'center',
        'bg-image-size': 'cover',
      }

  const active = {
    id: 'seed',
    name: isDark ? 'Material You 暗色' : 'Material You 亮色',
    isDark,
    ...themeColors,
    ...extInfo,
    'c-font': get('c-850'),
    'c-font-label': get('c-450'),
    'c-primary-font': get('c-primary'),
    'c-primary-font-hover': get('c-primary-alpha-300'),
    'c-primary-font-active': get('c-primary-dark-100-alpha-200'),
    'c-primary-background': get('c-primary-light-400-alpha-700'),
    'c-primary-background-hover': get('c-primary-light-300-alpha-800'),
    'c-primary-background-active': get('c-primary-light-100-alpha-800'),
    'c-primary-input-background': get('c-primary-light-400-alpha-700'),
    'c-button-font': get('c-primary-alpha-100'),
    'c-button-font-selected': get('c-primary-dark-100-alpha-100'),
    'c-button-background': get('c-primary-light-400-alpha-700'),
    'c-button-background-selected': get('c-primary-alpha-600'),
    'c-button-background-hover': get('c-primary-light-300-alpha-600'),
    'c-button-background-active': get('c-primary-light-100-alpha-600'),
    'c-list-header-border-bottom': get('c-primary-alpha-900'),
    'c-content-background': isDark ? get('c-primary-light-1000') : get('c-primary-light-1000'),
    'c-border-background': get('c-primary-light-100-alpha-700'),
    'bg-image': undefined,
  }

  return active as unknown as LX.ActiveTheme
}

/** 预设种子色（Material You 风格调色板） */
export const SEED_COLORS = [
  { hex: '#6C5CE7', name: '星紫' },
  { hex: '#4DAF7C', name: '翠绿' },
  { hex: '#3B82F6', name: '湛蓝' },
  { hex: '#A855F7', name: '魅紫' },
  { hex: '#EC4899', name: '樱粉' },
  { hex: '#F59E0B', name: '暖橙' },
  { hex: '#EF4444', name: '赤红' },
  { hex: '#14B8A6', name: '青碧' },
  { hex: '#6B7280', name: '极简灰' },
] as const
