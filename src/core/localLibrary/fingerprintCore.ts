/** 指纹纯函数（不依赖 Native，便于单测） */

export const hashString = (text: string): string => {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export interface FingerprintInput {
  size: number
  durationMs: number
  head: string
  tail: string
}

export const buildFingerprint = ({ size, durationMs, head, tail }: FingerprintInput): string => {
  return `fp:${hashString(`${size}|${durationMs}|${head.length}|${tail.length}|${head}|${tail}`)}`
}
