/**
 * 歌名里混进歌手名时的清洗。
 *
 * 起因：下载文件的命名格式是「歌手 - 歌名」（`download.fileName` 的默认值），
 * 下载完成后 `addLocalMusicFile` 直接把文件名当成 `title` 写进曲库，
 * 于是列表 / 首页 / 播放器上显示的歌名就变成了「歌手 - 歌名」，
 * 下面一行又重复显示一次歌手。
 *
 * 这里只在「歌名里确实带着已知歌手」时才动手：
 *   1. 尾部  歌手  → 摘掉尾部
 *   2. 头部  歌手 - → 摘掉头部
 * 不做「A - B 谁是歌手」的猜测 —— 猜错会把正常的歌名改坏，
 * 而没有歌手信息的文件在扫描时已经走过文件名拆分的兜底逻辑。
 */

const SEPARATOR = '[-–—－]'

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 歌手字段可能是「A/B」「A、B」「A & B」「A feat. B」，逐个拆开参与匹配 */
const singerCandidates = (singer: string) => {
  return singer
    .split(/[/、,&]|\sfeat\.?\s|\sft\.?\s/i)
    .map(text => text.trim())
    .filter(Boolean)
}

export interface SplitNameResult {
  name: string
  singer: string
}

/**
 * 把「歌名 - 歌手」里的歌手摘掉，只留歌名。
 * @param name 原始歌名（可能混着歌手）
 * @param singer 已知歌手，为空时原样返回
 */
export const splitNameAndSinger = (name?: string | null, singer?: string | null): SplitNameResult => {
  const rawName = (name ?? '').trim()
  const rawSinger = (singer ?? '').trim()
  if (!rawName) return { name: rawName, singer: rawSinger }
  if (!rawSinger) return { name: rawName, singer: rawSinger }

  const candidates = [...new Set([rawSinger, ...singerCandidates(rawSinger)])]
  for (const candidate of candidates) {
    const escaped = escapeRegExp(candidate)

    // 1) 尾部：「歌名 - 歌手」
    const tail = new RegExp(`\\s*${SEPARATOR}\\s*${escaped}\\s*$`, 'i')
    if (tail.test(rawName)) {
      const stripped = rawName.replace(tail, '').trim()
      // 全被吃掉说明「歌名」本身就是歌手名（比如纯音乐以歌手命名），保留原文更安全
      if (stripped) return { name: stripped, singer: rawSinger }
    }

    // 2) 头部：「歌手 - 歌名」
    const head = new RegExp(`^\\s*${escaped}\\s*${SEPARATOR}\\s*`, 'i')
    if (head.test(rawName)) {
      const stripped = rawName.replace(head, '').trim()
      if (stripped) return { name: stripped, singer: rawSinger }
    }
  }

  return { name: rawName, singer: rawSinger }
}

/** 只取歌名（渲染层用，避免每处都写解构） */
export const cleanSongName = (name?: string | null, singer?: string | null) => splitNameAndSinger(name, singer).name
