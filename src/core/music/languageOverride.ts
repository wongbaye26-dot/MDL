import { getData, saveData } from '@/plugins/storage'

/**
 * 用户手动纠正的歌曲语种（按歌曲 id）。
 * 在线歌没有可写的 meta，刮削自动判断也可能误判，所以单独持久化一份覆盖值。
 * 空字符串/缺省表示「自动判断」。
 */
const KEY = 'music_language_overrides_v1'
let cache: Record<string, string> = {}
let loaded = false

export const initLanguageOverrides = async() => {
  if (loaded) return
  loaded = true
  try {
    const data = await getData<Record<string, string>>(KEY)
    if (data && typeof data === 'object') cache = data
  } catch {}
}

export const getLanguageOverrideSync = (id?: string | null): string => (id ? cache[id] ?? '' : '')

export const setLanguageOverride = async(id: string, language: string) => {
  if (!id) return
  if (language) cache[id] = language
  else delete cache[id]
  try {
    await saveData(KEY, cache)
  } catch {}
}
