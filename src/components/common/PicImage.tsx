import { memo, useEffect, useState } from 'react'
import Image, { type ImageProps } from './Image'
import { getPicPath } from '@/core/music'

/**
 * 自动异步解析封面的 Image 组件
 * 优先用 meta.picUrl，为空时调用 getPicPath 异步获取
 */
const PicImage = ({ musicInfo, listId, ...rest }: {
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem | null | undefined
  listId?: string | null
} & Omit<ImageProps, 'url'>) => {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!musicInfo) {
      setUrl(null)
      return
    }
    // 下载文件
    if ('progress' in musicInfo) {
      const picUrl = musicInfo.metadata.musicInfo.meta?.picUrl
      if (picUrl) {
        setUrl(picUrl)
        return
      }
    }
    // 普通音乐
    if (!('progress' in musicInfo)) {
      const picUrl = musicInfo.meta?.picUrl
      if (picUrl) {
        setUrl(picUrl)
        return
      }
    }
    // 异步解析
    let alive = true
    void getPicPath({ musicInfo, isRefresh: false, listId }).then(u => {
      if (alive && u) setUrl(u)
    }).catch(() => {})
    return () => { alive = false }
  }, [musicInfo, listId])

  return <Image url={url} {...rest} />
}

export default memo(PicImage, (prev, next) => {
  return prev.musicInfo === next.musicInfo &&
    prev.listId === next.listId &&
    prev.style === next.style
})
