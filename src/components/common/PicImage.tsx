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
    // 异步解析：取不到/网络抖动时再重试一次，减少「偶发无封面」
    let alive = true
    let retries = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    const run = () => {
      void getPicPath({ musicInfo, isRefresh: false, listId }).then(u => {
        if (!alive) return
        if (u) {
          setUrl(u)
          return
        }
        if (retries < 1) {
          retries++
          timer = setTimeout(run, 1200)
        }
      }).catch(() => {
        if (!alive) return
        if (retries < 1) {
          retries++
          timer = setTimeout(run, 1200)
        }
      })
    }
    run()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [musicInfo, listId])

  return <Image url={url} {...rest} />
}

export default memo(PicImage, (prev, next) => {
  return prev.musicInfo === next.musicInfo &&
    prev.listId === next.listId &&
    prev.style === next.style
})
