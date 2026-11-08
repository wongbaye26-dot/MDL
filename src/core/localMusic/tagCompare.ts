/** 标签写入前的纯比较逻辑（便于单测，不依赖 RN/文件系统） */
export interface WantedTags {
  title: string
  artist: string
  album: string
  year: string
  genre: string
  language: string
}

export const sameText = (a?: string | null, b?: string | null) => (a ?? '').trim() === (b ?? '').trim()

/** 文件现有标签是否已经等于目标值；tags 为 null（读不到）时返回 false */
export const tagsMatch = (tags: Record<string, string> | null, wanted: WantedTags): boolean => {
  if (!tags) return false
  return sameText(tags.TITLE, wanted.title) &&
    sameText(tags.ARTIST, wanted.artist) &&
    sameText(tags.ALBUM, wanted.album) &&
    sameText(tags.DATE, wanted.year) &&
    sameText(tags.GENRE, wanted.genre) &&
    sameText(tags.LANGUAGE, wanted.language)
}
