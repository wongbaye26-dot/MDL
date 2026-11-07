/** 歌单广场收藏来的在线条目是扁平结构：pic/lrc/album 在顶层，没有 meta/interval */
export const normalizeMusicInfo = <T extends LX.Music.MusicInfo>(raw: T): T => {
  const item: any = { ...raw }
  if (!item.meta) item.meta = {}
  if (!item.meta.picUrl) item.meta.picUrl = item.pic ?? item.picUrl ?? ''
  if (!item.meta.albumName) item.meta.albumName = item.album ?? item.albumName ?? ''
  if (!item.source && typeof item.id === 'string' && !item.id.startsWith('local_')) {
    const guess = item.id.split('_')[0]
    if (guess && guess !== item.id) item.source = guess
  }
  if (!item.interval && typeof item.lrc === 'string') {
    // 从歌词最后一个 [mm:ss.xx] 推时长，避免播放器把 0 时长当成播完自动切歌
    const times = [...item.lrc.matchAll(/\[(\d{1,3}):(\d{1,2})(?:\.(\d{1,3}))?\]/g)]
    if (times.length) {
      const last = times[times.length - 1]
      const seconds = Number(last[1]) * 60 + Number(last[2])
      const mm = Math.floor(seconds / 60)
      const ss = seconds % 60
      item.interval = `${mm}:${ss.toString().padStart(2, '0')}`
    }
  }
  return item as T
}
