import { useEffect, useRef, useState } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'

import Image from '@/components/common/Image'
import CoverPlaceholder from '@/components/common/CoverPlaceholder'
import { useTheme } from '@/store/theme/hook'
import { cleanSongName } from '@/utils/songName'
import { readEmbeddedCover } from '@/core/localMusic/cover'

/**
 * 本地音乐封面：内存缓存 + 提取队列 + 一个可复用的展示组件。
 *
 * 从 LocalMusic/index.tsx 抽出来，是因为「更多」Sheet 和「歌曲信息」页也要显示封面，
 * 而它们和列表在同一个目录下、需要共用同一份 picCache —— 各写一份会重复抽封面。
 */
export const picCache = new Map<string, string>()

/** 同时最多跑 2 个原生抽取，切到「专辑 / 艺人」页签时不会一次压上几十个任务 */
let activeLoads = 0
const pendingLoads: Array<() => void> = []
const withLimit = async<T,>(task: () => Promise<T>): Promise<T> => {
  if (activeLoads >= 2) {
    await new Promise<void>(resolve => { pendingLoads.push(resolve) })
  }
  activeLoads++
  try {
    return await task()
  } finally {
    activeLoads--
    pendingLoads.shift()?.()
  }
}

/** 取封面：内存缓存 → 文件内嵌（私有目录读文件 / 公共目录读 content uri） */
export const loadPic = async(item: LX.Music.MusicInfoLocal): Promise<string> => {
  const key = item.meta.filePath
  const cached = picCache.get(key)
  if (cached) return cached
  const pic = await withLimit(async() => await readEmbeddedCover(item)).catch(() => '')
  if (pic) picCache.set(key, pic)
  return pic
}

export interface CoverImageProps {
  item: LX.Music.MusicInfoLocal
  size?: number
  /** 艺人头像用圆形 */
  round?: boolean
  /** 圆角半径，默认 10（round 时为 size/2） */
  radius?: number
  /** 图片相对底色容器内缩多少（列表行留一圈底色，大封面传 0 铺满） */
  inset?: number
  /** 容器底色，默认用主题色；中性页面传 palette.card / palette.bg */
  background?: string
  style?: StyleProp<ViewStyle>
}

export const CoverImage = ({
  item,
  size = 56,
  round = false,
  radius: radiusProp,
  inset = 8,
  background,
  style,
}: CoverImageProps) => {
  const theme = useTheme()
  // MediaStore 条目自带 albumart 的 content:// 地址，直接用它（公共目录读不了文件）
  const [uri, setUri] = useState<string>(() => picCache.get(item.meta.filePath) ?? item.meta.picUrl ?? '')
  /** 抽取失败/图片加载失败后标记，用来切到首字占位 */
  const [failed, setFailed] = useState(false)
  /** 本轮是否已经尝试过抽取，避免 effect 反复跑 */
  const tried = useRef(false)
  /** 加载失败后允许重新抽一次（缓存被系统清掉时能自愈） */
  const recovered = useRef(false)
  /** 上一次应用过的曲库封面，只有它变了才覆盖当前显示 */
  const lastPicRef = useRef(item.meta.picUrl ?? '')

  useEffect(() => {
    if (uri || failed || tried.current) return
    tried.current = true
    let alive = true
    void loadPic(item).then(pic => {
      if (!alive) return
      if (pic) setUri(pic)
      else setFailed(true)
    })
    return () => { alive = false }
  }, [item, uri, failed])

  /** 曲库里的封面被补上了（音乐工具 / 联网搜索）→ 已挂载的行也要跟着换 */
  useEffect(() => {
    const next = item.meta.picUrl ?? ''
    if (!next || next === lastPicRef.current) return
    lastPicRef.current = next
    setUri(next)
    setFailed(false)
    recovered.current = false
  }, [item.meta.picUrl])

  /** 图片加载失败：先给一次重新抽取的机会，再失败就落到首字占位 */
  const handleError = () => {
    if (!recovered.current) {
      recovered.current = true
      tried.current = false
      setUri('')
      return
    }
    setFailed(true)
  }

  const radius = radiusProp ?? (round ? size / 2 : 10)
  const inner = Math.max(size - inset, 0)
  const innerRadius = round ? inner / 2 : radius
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: background ?? theme['c-primary-alpha-900'],
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {
        uri && !failed
          ? <Image url={uri} style={{ width: inner, height: inner, borderRadius: innerRadius }} onError={handleError} />
          : <CoverPlaceholder name={cleanSongName(item.name, item.singer)} size={size} radius={radius} />
      }
    </View>
  )
}
