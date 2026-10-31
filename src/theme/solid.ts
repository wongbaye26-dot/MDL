/**
 * 颜色工具：把带透明度的颜色「压平」成不透明色。
 *
 * 主题里的 c-main-background 有一部分是半透明的（为了让背景图透出来），
 * 但页面/弹层一旦叠在另一个页面之上，半透明就会让下层内容透上来（用户看到的
 * 「排行榜页面半透明、有鬼影」）。这里统一在构建主题时把它压到不透明底上。
 */

type RGBA = [number, number, number, number]

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const parseColor = (color: string): RGBA | null => {
  if (typeof color !== 'string') return null
  const value = color.trim()

  if (value[0] === '#') {
    const hex = value.slice(1)
    if (hex.length === 3) {
      const [r, g, b] = hex.split('')
      return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16), 1]
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        1,
      ]
    }
    if (hex.length === 8) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        parseInt(hex.slice(6, 8), 16) / 255,
      ]
    }
    return null
  }

  const matched = /^rgba?\(([^)]+)\)$/i.exec(value)
  if (!matched) return null
  const parts = matched[1].split(/[,/\s]+/).filter(Boolean)
  if (parts.length < 3) return null
  const channel = (raw: string) => {
    const num = Number.parseFloat(raw)
    if (!Number.isFinite(num)) return 0
    return raw.includes('%') ? num * 2.55 : num
  }
  const alphaRaw = parts[3]
  let alpha = 1
  if (alphaRaw != null) {
    const num = Number.parseFloat(alphaRaw)
    if (Number.isFinite(num)) alpha = alphaRaw.includes('%') ? num / 100 : num
  }
  return [
    Math.round(clamp(channel(parts[0]), 0, 255)),
    Math.round(clamp(channel(parts[1]), 0, 255)),
    Math.round(clamp(channel(parts[2]), 0, 255)),
    clamp(alpha, 0, 1),
  ]
}

/** 取颜色透明度，无法解析时按不透明处理 */
export const getAlpha = (color: string): number => parseColor(color)?.[3] ?? 1

/** 把 color 叠在 base 上，返回不透明的 rgb(...) */
export const flattenColor = (color: string, base: string): string => {
  const top = parseColor(color)
  if (!top) return color
  if (top[3] >= 0.999) return `rgb(${top[0]}, ${top[1]}, ${top[2]})`
  const bottom = parseColor(base) ?? [255, 255, 255, 1]
  const a = top[3]
  const mix = (i: number) => Math.round(top[i] * a + bottom[i] * (1 - a))
  return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`
}

/** 转成原生可用的 #RRGGBB（丢弃透明度） */
export const toHexColor = (color: string, fallback = '#FFFFFF'): string => {
  const parsed = parseColor(color)
  if (!parsed) return fallback
  const hex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  return `#${hex(parsed[0])}${hex(parsed[1])}${hex(parsed[2])}`.toUpperCase()
}
