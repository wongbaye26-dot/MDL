import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  ScrollView,
  TouchableOpacity,
  View,
  Image as RNImage,
} from 'react-native'

import Text from '@/components/common/Text'
import PicImage from '@/components/common/PicImage'
import MarqueeText from '@/components/common/MarqueeText'
import { Icon } from '@/components/common/Icon'
import Slider from '@react-native-community/slider'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo, useIsPlay, useProgress } from '@/store/player/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { useWindowSize } from '@/utils/hooks'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle, toast } from '@/utils/tools'
import { useLrcSet, useLrcPlay, type Line } from '@/plugins/lyric'
import playerState from '@/store/player/state'
import { collectMusic, playList, playNext, playPrev, togglePlay, uncollectMusic } from '@/core/player/player'
import { setCurrentTime, getPosition, getDuration } from '@/plugins/player'
import { setNowPlayTime, setMaxplayTime } from '@/core/player/progress'
import { getListMusicSync } from '@/utils/listManage'
import { LIST_IDS } from '@/config/constant'
import { setNavActiveId, updateSetting } from '@/core/common'
import { formatSize, formatSampleRate, QUALITY_LABEL, QUALITY_DESC } from '@/core/download/utils'
import DownloadQualityModal, { type DownloadQualityModalType } from '@/components/DownloadQualityModal'

const PLAY_MODES = ['listLoop', 'random', 'singleLoop', 'list'] as const
type PlayMode = typeof PLAY_MODES[number]
const MODE_ICON: Record<PlayMode, string> = {
  listLoop: 'repeat',
  random: 'shuffle-variant',
  singleLoop: 'repeat-once',
  list: 'format-list-numbered',
}
const MODE_LABEL: Record<PlayMode, string> = {
  listLoop: '列表循环',
  random: '随机播放',
  singleLoop: '单曲循环',
  list: '顺序播放',
}

const LYRIC_SIZES = [15, 17, 19, 22]

/**
 * 渐变遮罩用预渲染的 alpha 渐变 PNG，而不是堆几十层色块。
 * 色块堆叠在低端机上会出现明显横带（截图里的灰色条纹），
 * 一张 8x256 的渐变图缩放后是完全平滑的，性能也更好。
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FADE_BOTTOM = require('@/resources/images/fade-bottom.png')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FADE_TOP = require('@/resources/images/fade-top.png')

const formatTime = (time: number) => {
  if (!time || time < 0 || !Number.isFinite(time)) return '00:00'
  const total = Math.floor(time)
  const m = Math.floor(total / 60)
  const sec = total % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** 当前正在唱的歌词行序号 */
const findLine = (lines: Line[], timeMs: number) => {
  let index = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= timeMs) index = i
    else break
  }
  return index
}

const LyricLine = memo(({ text, active, ratio, size, wordByWord, activeColor, distance = 0 }: {
  text: string
  active: boolean
  ratio: number
  size: number
  wordByWord: boolean
  /** 当前行高亮色（主题色） */
  activeColor: string
  /** 距离当前行几行：越远越淡（模拟飞牛的景深效果） */
  distance?: number
}) => {
  if (!active) {
    return (
      <Text
        size={size}
        color='rgba(255,255,255,0.55)'
        style={{ ...styles.lyricLine, lineHeight: size * 1.5, opacity: Math.max(0.14, 0.62 - distance * 0.11) }}
        numberOfLines={2}
      >{text || ' '}</Text>
    )
  }
  // 关闭逐字时整行高亮
  if (!wordByWord) {
    return (
      <Text
        size={size}
        color={activeColor}
        style={{ ...styles.lyricLine, lineHeight: size * 1.5, fontWeight: '600' }}
        numberOfLines={2}
      >{text || ' '}</Text>
    )
  }
  const shown = Math.min(text.length, Math.ceil(text.length * Math.max(0, Math.min(1, ratio))))
  return (
    <Text
      size={size}
      color='rgba(255,255,255,0.45)'
      style={{ ...styles.lyricLine, lineHeight: size * 1.5 }}
      numberOfLines={2}
    >
      <Text size={size} color={activeColor} style={styles.lyricActive}>{text.slice(0, shown)}</Text>
      {text.slice(shown)}
    </Text>
  )
})

export default () => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const progress = useProgress()
  const lines = useLrcSet()
  const lrcPlay = useLrcPlay()
  const { height } = useWindowSize()
  const playMode = (useSettingValue('player.togglePlayMethod') ?? 'listLoop') as PlayMode

  const [mode, setMode] = useState<'cover' | 'lyric'>('cover')
  const [sizeIndex, setSizeIndex] = useState(1)
  const [now, setNow] = useState(0)
  const [collected, setCollected] = useState(false)
  const [queueVisible, setQueueVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const downloadModalRef = useRef<DownloadQualityModalType>(null)
  const autoSaveEnabled = useSettingValue('download.autoSaveWhilePlaying')
  const isWordByWord = useSettingValue('player.isWordByWordLyric')
  const isSingleLine = useSettingValue('player.isSingleLineLyric')

  const handleDownload = useCallback(() => {
    const raw = playerState.playMusicInfo.musicInfo
    if (!raw) return
    if ('progress' in raw) {
      toast('这首已经下载过了')
      return
    }
    if (raw.source === 'local') {
      toast('本地文件无需下载')
      return
    }
    downloadModalRef.current?.show({ musicInfos: [raw] })
  }, [])

  const lyricSize = LYRIC_SIZES[sizeIndex]

  // 下拉返回：拖动封面页下滑关闭，带跟手位移动画
  const panY = useRef(new Animated.Value(0)).current
  const modeRef = useRef(mode)
  modeRef.current = mode
  const heightRef = useRef(height)
  heightRef.current = height

  const closeWithSlideDown = useCallback((fromY: number) => {
    Animated.timing(panY, {
      toValue: heightRef.current,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      panY.setValue(0)
      setNavActiveId('nav_home')
    })
    void fromY
  }, [panY])

  const lyricScrollY = useRef(0)

  // 用 capture 阶段接管：之前用 onMoveShouldSetPanResponder 会被封面/歌词的
  // 触摸区域和歌词列表抢走，导致下滑经常没反应
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) => {
      if (g.dy <= 4) return false
      if (Math.abs(g.dy) <= Math.abs(g.dx) * 1.1) return false
      // 歌词列表没回到顶部时，下滑交给列表自己滚动
      if (modeRef.current === 'lyric' && lyricScrollY.current > 2) return false
      return true
    },
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) panY.setValue(g.dy)
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 70 || g.vy > 0.45) {
        closeWithSlideDown(g.dy)
      } else {
        Animated.spring(panY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 90,
        }).start()
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start()
    },
  }), [panY, closeWithSlideDown])

  // 歌词模式：本地时钟插值，保证逐字进度连续变化（不再是 500ms 一跳）
  useEffect(() => {
    if (mode !== 'lyric') return
    let stopped = false
    let rafId = 0
    let basePos = 0 // 最近一次真实播放位置（秒）
    let baseAt = 0 // 取到该位置时的本地时间戳
    let lastFetch = 0
    let lastEmitted = -1

    const syncPosition = () => {
      lastFetch = Date.now()
      void getPosition().then(t => {
        if (stopped) return
        basePos = t
        baseAt = Date.now()
      }).catch(() => {})
    }

    const tick = () => {
      if (stopped) return
      if (Date.now() - lastFetch > 600) syncPosition()
      // 暂停时不推进插值，避免进度条自己往前走
      const est = playerState.isPlay
        ? basePos + (Date.now() - baseAt) / 1000
        : basePos
      // 只在变化超过 25ms 时提交，约 40fps，足够平滑且不浪费渲染
      if (est - lastEmitted >= 0.025) {
        lastEmitted = est
        setNow(est)
      }
      rafId = requestAnimationFrame(tick)
    }

    syncPosition()
    rafId = requestAnimationFrame(tick)
    return () => {
      stopped = true
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [mode])

  useEffect(() => {
    setCollected(getListMusicSync(LIST_IDS.LOVE).some(m => m.id === musicInfo.id))
  }, [musicInfo.id])

  // 时长兜底：切歌后播放器还没回调时长时主动取一次
  useEffect(() => {
    if (!musicInfo.id) return
    let alive = true
    const timer = setTimeout(() => {
      if (!alive) return
      if (playerState.progress.maxPlayTime > 0) return
      void getDuration().then(duration => {
        if (alive && duration > 0) setMaxplayTime(duration)
      }).catch(() => {})
    }, 300)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [musicInfo.id])

  const handleToggleMode = useCallback(() => {
    setMode(mode => mode === 'cover' ? 'lyric' : 'cover')
  }, [])

  const handleSeek = useCallback((time: number) => {
    setNowPlayTime(time)
    void setCurrentTime(time)
  }, [])

  const handleToggleCollect = useCallback(() => {
    if (collected) {
      uncollectMusic()
      setCollected(false)
      toast('已取消收藏')
    } else {
      collectMusic()
      setCollected(true)
      toast('已收藏到「我的收藏」')
    }
  }, [collected])

  const handleCycleMode = useCallback(() => {
    const index = PLAY_MODES.indexOf(playMode)
    const next = PLAY_MODES[(index + 1) % PLAY_MODES.length]
    updateSetting({ 'player.togglePlayMethod': next })
    toast(MODE_LABEL[next])
  }, [playMode])

  const handleSizeChange = useCallback(() => {
    setSizeIndex(index => (index + 1) % LYRIC_SIZES.length)
  }, [])

  /** 点击队列里的歌曲直接切歌播放 */
  const handlePlayFromQueue = useCallback((index: number) => {
    const listId = playerState.playInfo.playerListId
    if (!listId) return
    setQueueVisible(false)
    void playList(listId, index)
  }, [])

  const currentTime = progress.nowPlayTime
  const maxTime = progress.maxPlayTime

  const audioMeta = useMemo(() => {
    const raw = playerState.playMusicInfo.musicInfo
    if (!raw) return ''

    // 已下载文件
    if ('progress' in raw) {
      const info = raw.metadata
      return [
        '已下载',
        QUALITY_LABEL[info.quality as LX.Quality] ?? info.quality,
        raw.total ? formatSize(raw.total) : '',
      ].filter(Boolean).join(' · ')
    }

    // 本地文件：格式 / 采样率 / 码率 / 大小
    if (raw.source === 'local') {
      const meta = raw.meta
      const rate = meta.sampleRate ? formatSampleRate(meta.sampleRate) : ''
      const bitrate = meta.bitrate ? `${meta.bitrate} kbps` : ''
      return [
        '本地',
        meta.ext?.toUpperCase(),
        rate,
        bitrate,
        meta.size ? formatSize(meta.size) : '',
      ].filter(Boolean).join(' · ')
    }

    // 在线音乐：当前实际播放音质
    const quality = playerState.playQuality
    if (quality) {
      return [
        '在线',
        QUALITY_DESC[quality as LX.Quality] ?? QUALITY_LABEL[quality as LX.Quality] ?? quality,
        raw.meta.albumName || '',
      ].filter(Boolean).join(' · ')
    }
    const qualities = raw.meta.qualitys ?? []
    const best = qualities.length ? qualities[qualities.length - 1] : null
    return [
      '在线',
      best ? (QUALITY_DESC[best.type] ?? QUALITY_LABEL[best.type] ?? best.type) : '',
      raw.meta.albumName || '',
    ].filter(Boolean).join(' · ')
  }, [musicInfo.id, musicInfo.pic])

  const detailRows = useMemo(() => {
    const raw = playerState.playMusicInfo.musicInfo
    const rows: Array<{ label: string, value: string }> = []
    rows.push({ label: '歌名', value: musicInfo.name || '-' })
    rows.push({ label: '歌手', value: musicInfo.singer || '-' })
    if (musicInfo.album) rows.push({ label: '专辑', value: musicInfo.album })
    if (raw) {
      if ('progress' in raw) {
        rows.push({ label: '来源', value: '下载文件' })
        rows.push({ label: '格式', value: `${raw.metadata.ext?.toUpperCase() ?? '-'} · ${QUALITY_LABEL[raw.metadata.quality as LX.Quality] ?? raw.metadata.quality}` })
        rows.push({ label: '文件', value: raw.metadata.filePath ?? '-' })
      } else if (raw.source === 'local') {
        rows.push({ label: '来源', value: '本地文件' })
        rows.push({ label: '格式', value: [raw.meta.ext?.toUpperCase(), raw.meta.bitrate].filter(Boolean).join(' · ') || '-' })
        rows.push({ label: '文件', value: raw.meta.filePath })
      } else {
        rows.push({ label: '来源', value: raw.source.toUpperCase() })
        const qualities = raw.meta.qualitys ?? []
        const best = qualities.length ? qualities[qualities.length - 1] : null
        if (best) rows.push({ label: '最高音质', value: QUALITY_LABEL[best.type] ?? best.type })
      }
    }
    rows.push({ label: '时长', value: formatTime(maxTime) })
    return rows
  }, [musicInfo.id, musicInfo.name, musicInfo.singer, musicInfo.album, maxTime])

  const queue = useMemo(() => {
    return queueVisible ? getListMusicSync(playerState.playInfo.playerListId) : []
  }, [queueVisible])

  const timeMs = (mode === 'lyric' ? now : currentTime) * 1000
  const currentLine = useMemo(() => findLine(lines, timeMs), [lines, timeMs])
  const currentRatio = useMemo(() => {
    if (currentLine < 0) return 0
    const start = lines[currentLine].time
    const end = lines[currentLine + 1]?.time ?? (maxTime * 1000 || start + 4000)
    return end > start ? (timeMs - start) / (end - start) : 0
  }, [currentLine, lines, timeMs, maxTime])

  const scrollRef = useRef<ScrollView>(null)
  const lineOffsets = useRef<number[]>([])
  const lyricAreaH = useRef(0)
  // 歌词换歌后行高/偏移会变，等内容布局完再对齐一次
  const [contentTick, setContentTick] = useState(0)

  useEffect(() => {
    // 换歌：清掉上一首的行偏移，避免新歌词按旧坐标滚动（对不齐的根因）
    lineOffsets.current = []
  }, [lines])

  useEffect(() => {
    if (mode !== 'lyric' || currentLine < 0) return
    const offset = lineOffsets.current[currentLine]
    if (offset == null) return
    // 当前行垂直居中（飞牛也是居中高亮）
    const areaH = lyricAreaH.current || height * 0.6
    scrollRef.current?.scrollTo({ y: Math.max(0, offset - areaH / 2 + 22), animated: true })
  }, [currentLine, mode, height, contentTick])

  const pic = musicInfo.pic

  // 播放键按压反馈
  const playBtnScale = useRef(new Animated.Value(1)).current
  const pressPlay = useCallback((to: number) => {
    Animated.spring(playBtnScale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 8,
    }).start()
  }, [playBtnScale])

  // 封面进场：换歌时淡入 + 从 1.06 推近到 1
  const coverAnim = useRef(new Animated.Value(0)).current
  const coverScale = coverAnim.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] })
  // 只在换歌时重放（切歌词页不重放），否则歌词态背景会一直是黑的
  useEffect(() => {
    coverAnim.setValue(0)
    Animated.timing(coverAnim, {
      toValue: 1,
      duration: 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [coverAnim, pic])

  return (
    <Animated.View
      style={{ ...styles.container, transform: [{ translateY: panY }] }}
      {...panResponder.panHandlers}
    >
      {/*
        背景：同一张封面放大 + 高斯模糊，铺满整屏。
        blurRadius 用 RN 自带（RenderScript/RenderEffect），比叠加色块干净。
      */}
      <View pointerEvents='none' style={styles.bgBlur}>
        {
          pic
            ? <RNImage source={{ uri: pic }} blurRadius={mode === 'lyric' ? 46 : 32} style={styles.bgImg} resizeMode='cover' />
            : <View style={[styles.bgImg, { backgroundColor: '#17141C' }]} />
        }
      </View>
      <View pointerEvents='none' style={styles.bgDim} />
      {/* 底部再压一层渐变，保证按键/时间在浅色封面上也看得清 */}
      <View pointerEvents='none' style={styles.bottomFade}>
        <RNImage source={FADE_BOTTOM} resizeMode='stretch' style={styles.bgImg} />
      </View>

      <View style={{ flex: 1, paddingTop: statusBarHeight }}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.topBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => { setNavActiveId('nav_home') }}
          >
            <Icon name='chevron-down' size={26} color='rgba(255,255,255,0.94)' />
          </TouchableOpacity>
          {
            mode === 'lyric'
              ? (
                <View style={styles.topTitle}>
                  <Text size={15} color='rgba(255,255,255,0.95)' numberOfLines={1} style={styles.topTitleName}>{musicInfo.name || '未在播放'}</Text>
                  <Text size={11} color='rgba(255,255,255,0.6)' numberOfLines={1} style={styles.topTitleSinger}>{musicInfo.singer}</Text>
                </View>
                )
              : <View style={{ flex: 1 }} />
          }
          {
            mode === 'lyric'
              ? (
                <TouchableOpacity style={styles.topBtn} onPress={handleSizeChange} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Icon name='format-size' size={20} color='rgba(255,255,255,0.85)' />
                </TouchableOpacity>
                )
              : <View style={styles.topBtn} />
          }
        </View>

        {/*
          封面区：飞牛是「整宽 + contain」——竖版专辑图会在两侧留出模糊背景，
          横版/方形图则上下留白，永远不会裁掉画面。点一下切歌词。
        */}
        {
          mode === 'cover'
            ? (
              <TouchableOpacity activeOpacity={1} style={styles.coverStage} onPress={handleToggleMode}>
                <Animated.View style={{ ...styles.coverBox, opacity: coverAnim, transform: [{ scale: coverScale }] }}>
                  {
                    pic
                      ? <RNImage source={{ uri: pic }} resizeMode='contain' style={styles.coverImg} />
                      : <View style={styles.coverEmpty}><Icon name='album' size={64} color='rgba(255,255,255,0.14)' /></View>
                  }
                  {/* 四边柔化：上下各一条模糊带（强），左右两条（弱） */}
                  {
                    pic
                      ? (
                        <>
                          <View pointerEvents='none' style={[styles.edgeStrip, styles.edgeTop]}>
                            <RNImage source={{ uri: pic }} blurRadius={26} resizeMode='contain' style={styles.edgeImgH} />
                          </View>
                          <View pointerEvents='none' style={[styles.edgeStrip, styles.edgeBottom]}>
                            <RNImage source={{ uri: pic }} blurRadius={26} resizeMode='contain' style={[styles.edgeImgH, styles.edgeImgBottom]} />
                          </View>
                          <View pointerEvents='none' style={[styles.edgeStripV, styles.edgeLeft]}>
                            <RNImage source={{ uri: pic }} blurRadius={22} resizeMode='contain' style={styles.edgeImgV} />
                          </View>
                          <View pointerEvents='none' style={[styles.edgeStripV, styles.edgeRight]}>
                            <RNImage source={{ uri: pic }} blurRadius={22} resizeMode='contain' style={[styles.edgeImgV, styles.edgeImgRight]} />
                          </View>
                        </>
                        )
                      : null
                  }
                </Animated.View>
                {/* 封面下方的倒影：垂直翻转 + 高斯模糊，向下淡出 */}
                {
                  pic
                    ? (
                      <Animated.View style={{ ...styles.reflection, opacity: coverAnim }}>
                        <RNImage
                          source={{ uri: pic }}
                          blurRadius={42}
                          resizeMode='cover'
                          style={styles.reflectionImg}
                        />
                      </Animated.View>
                      )
                    : null
                }
              </TouchableOpacity>
              )
            : (
              <View style={styles.lyricArea} onLayout={e => { lyricAreaH.current = e.nativeEvent.layout.height }}>
                {/* 注意：Image 只写 left/right 会按图片自身像素宽渲染（21px），
                    必须外包一层 View 由 View 吃布局 */}
                <View pointerEvents='none' style={styles.lyricFadeTop}>
                  <RNImage source={FADE_TOP} resizeMode='stretch' style={styles.bgImg} />
                </View>
                <View pointerEvents='none' style={styles.lyricFadeBottom}>
                  <RNImage source={FADE_BOTTOM} resizeMode='stretch' style={styles.bgImg} />
                </View>
                {
                  lines.length
                    ? (
                        isSingleLine
                          ? (
                          <TouchableOpacity activeOpacity={0.9} style={styles.singleLineArea} onPress={handleToggleMode}>
                            <LyricLine
                              text={currentLine >= 0 ? lines[currentLine].text : ''}
                              size={lyricSize + 5}
                              active
                              ratio={currentRatio}
                              wordByWord={isWordByWord}
                              activeColor={theme['c-primary']}
                            />
                          </TouchableOpacity>
                            )
                          : (
                          <ScrollView
                            ref={scrollRef}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.lyricContent}
                            scrollEventThrottle={32}
                            onScroll={e => { lyricScrollY.current = e.nativeEvent.contentOffset.y }}
                            onContentSizeChange={() => { setContentTick(v => v + 1) }}
                          >
                            {
                              lines.map((line, index) => (
                                <TouchableOpacity
                                  key={`${index}_${line.time}`}
                                  activeOpacity={0.8}
                                  onPress={handleToggleMode}
                                  onLayout={e => { lineOffsets.current[index] = e.nativeEvent.layout.y }}
                                >
                                  <LyricLine
                                    text={line.text}
                                    size={lyricSize}
                                    active={index === currentLine}
                                    ratio={index === currentLine ? currentRatio : 0}
                                    wordByWord={isWordByWord}
                                    activeColor={theme['c-primary']}
                                    distance={index === currentLine ? 0 : Math.abs(index - currentLine)}
                                  />
                                </TouchableOpacity>
                              ))
                            }
                          </ScrollView>
                            )
                      )
                    : (
                      <TouchableOpacity activeOpacity={0.8} style={styles.lyricEmpty} onPress={handleToggleMode}>
                        <Icon name='comment-text-outline' size={30} color='rgba(255,255,255,0.4)' />
                        <Text size={12} color='rgba(255,255,255,0.55)' style={styles.lyricEmptyText}>暂无歌词 · 点击返回</Text>
                      </TouchableOpacity>
                      )
                }
              </View>
              )
        }

        {/* 当前歌词行（封面态） */}
        {
          mode === 'cover'
            ? (
              <View style={styles.lyricStrip}>
                <Text size={17} color='rgba(255,255,255,0.88)' numberOfLines={2} style={styles.nowLyric}>
                  {lrcPlay.text || ' '}
                </Text>
              </View>
              )
            : null
        }

        {/* 歌名 / 歌手 + 下载 / 收藏 / 更多 */}
        <View style={styles.infoBlock}>
          <TouchableOpacity style={styles.titleText} activeOpacity={0.75} onPress={handleToggleMode}>
            <MarqueeText
              text={musicInfo.name || '未在播放'}
              size={21}
              color='#FFFFFF'
              style={styles.songName}
            />
            <Text size={12} color='rgba(255,255,255,0.66)' numberOfLines={1} style={styles.songSinger}>{musicInfo.singer}</Text>
          </TouchableOpacity>
          {
            autoSaveEnabled
              ? null
              : (
                <TouchableOpacity style={styles.iconBtn} onPress={handleDownload} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Icon name='download-2' size={21} color='rgba(255,255,255,0.92)' />
                </TouchableOpacity>
                )
          }
          <TouchableOpacity style={styles.iconBtn} onPress={handleToggleCollect} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Icon
              name={collected ? 'love' : 'heart-outline'}
              size={23}
              color={collected ? '#FF3B5C' : 'rgba(255,255,255,0.92)'}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => { setDetailVisible(true) }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Icon name='dots-vertical' size={20} color='rgba(255,255,255,0.92)' />
          </TouchableOpacity>
        </View>

        {/* 进度条 + 时间（飞牛：条 6dp、时间在条下方两侧，中间是音频信息） */}
        <View style={styles.progressBlock}>
          <Slider
            value={currentTime}
            minimumValue={0}
            maximumValue={maxTime || 1}
            minimumTrackTintColor='rgba(255,255,255,0.98)'
            maximumTrackTintColor='rgba(255,255,255,0.32)'
            thumbTintColor='#FFFFFF'
            style={styles.slider}
            onSlidingComplete={handleSeek}
          />
          <View style={styles.timeRow}>
            <Text size={11} color='rgba(255,255,255,0.72)' style={styles.timeText}>{formatTime(currentTime)}</Text>
            {
              audioMeta
                ? <Text size={10} color='rgba(255,255,255,0.5)' numberOfLines={1} style={styles.timeCenter}>{audioMeta}</Text>
                : <View style={styles.timeCenter} />
            }
            <Text size={11} color='rgba(255,255,255,0.72)' style={styles.timeText}>{formatTime(maxTime)}</Text>
          </View>
        </View>

        {/* 五个主控键：外侧 48dp、内侧 56dp，两端贴边 */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.ctrlBtn} onPress={handleCycleMode} activeOpacity={0.6}>
            <Icon name={MODE_ICON[playMode]} size={22} color='rgba(255,255,255,0.9)' />
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtnBig} onPress={() => { void playPrev() }} activeOpacity={0.6}>
            <Icon name='prevMusic' size={32} color='#FFFFFF' />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.playBtn}
            onPress={togglePlay}
            activeOpacity={0.75}
            onPressIn={() => { pressPlay(0.9) }}
            onPressOut={() => { pressPlay(1) }}
          >
            <Animated.View style={{ transform: [{ scale: playBtnScale }] }}>
              <Icon name={isPlay ? 'pause' : 'play'} size={44} color='#FFFFFF' />
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtnBig} onPress={() => { void playNext() }} activeOpacity={0.6}>
            <Icon name='nextMusic' size={32} color='#FFFFFF' />
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => { setQueueVisible(true) }} activeOpacity={0.6}>
            <Icon name='playlist-music' size={25} color='rgba(255,255,255,0.9)' />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={queueVisible} transparent animationType='slide' onRequestClose={() => { setQueueVisible(false) }}>
        <TouchableOpacity style={styles.modalMask} activeOpacity={1} onPress={() => { setQueueVisible(false) }}>
          <View style={{ ...styles.queueSheet, backgroundColor: theme['c-content-background'] }}>
            <View style={styles.queueHead}>
              <Text size={14} style={styles.queueTitle}>播放队列 · {queue.length}</Text>
              <TouchableOpacity onPress={() => { setQueueVisible(false) }}>
                <Icon name='close' size={18} color={theme['c-450']} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.queueList}>
              {
                queue.map((item, index) => (
                  <TouchableOpacity
                    key={`${item.id}_${index}`}
                    style={styles.queueRow}
                    activeOpacity={0.6}
                    onPress={() => { handlePlayFromQueue(index) }}
                  >
                    <Text size={12} color={theme['c-450']} style={styles.queueIndex}>{index + 1}</Text>
                    <PicImage musicInfo={item} listId={playerState.playInfo.playerListId} style={styles.queueCover} />
                    <View style={styles.queueInfo}>
                      <Text size={13} numberOfLines={1}>{item.name}</Text>
                      <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.queueSinger}>{item.singer}</Text>
                    </View>
                    {
                      item.id === musicInfo.id
                        ? <Icon name='volume-high' size={15} color={theme['c-primary-font']} />
                        : null
                    }
                  </TouchableOpacity>
                ))
              }
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={detailVisible} transparent animationType='fade' onRequestClose={() => { setDetailVisible(false) }}>
        <TouchableOpacity style={styles.modalMask} activeOpacity={1} onPress={() => { setDetailVisible(false) }}>
          <View style={{ ...styles.detailSheet, backgroundColor: theme['c-content-background'] }}>
            <Text size={14} style={styles.queueTitle}>歌曲详情</Text>
            {
              detailRows.map(row => (
                <View key={row.label} style={styles.detailRow}>
                  <Text size={12} color={theme['c-450']} style={styles.detailLabel}>{row.label}</Text>
                  <Text size={12} numberOfLines={2} style={styles.detailValue}>{row.value}</Text>
                </View>
              ))
            }
          </View>
        </TouchableOpacity>
      </Modal>

      <DownloadQualityModal ref={downloadModalRef} />
    </Animated.View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#0B0810',
  },
  /*
    重要：Image 的绝对定位必须写死 width/height。
    之前只写 left/right 时，RN 会用图片自身的像素宽（fade PNG 只有 8px）
    渲染成 21px 宽的一条 —— 那就是用户一直看到的「左侧黑边」。
  */
  bgBlur: {
    position: 'absolute',
    left: -40,
    right: -40,
    top: -40,
    bottom: -40,
  },
  bgImg: {
    width: '100%',
    height: '100%',
  },
  bgImgZoom: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.15 }],
  },
  bgDim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(12,10,18,0.18)',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: '100%',
    height: '46%',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 8,
    paddingRight: 8,
    height: 48,
  },
  topBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTitle: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  topTitleName: {
    fontWeight: '600',
  },
  topTitleSinger: {
    marginTop: 2,
  },
  coverStage: {
    // 固定占屏 52%：封面居中，歌词紧贴在封面下方
    height: '52%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBox: {
    // 飞牛：封面两边留空（约 7%），图片 contain 不裁切
    width: '86%',
    aspectRatio: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  reflection: {
    width: '86%',
    aspectRatio: 7,
    marginTop: 2,
    overflow: 'hidden',
    opacity: 0.18,
  },
  reflectionImg: {
    // 按封面原尺寸铺（宽 100% + 正方形），再垂直翻转：
    // 这样条带里露出的是封面「最底部那一条」的镜像，才是真正的倒影；
    // 直接 height:100% 会把整张图压扁进条带，看起来像一条色块
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    aspectRatio: 1,
    transform: [{ scaleY: -1 }],
  },
  // 四边柔化：上下强、左右弱
  edgeStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '7%',
    overflow: 'hidden',
  },
  edgeTop: {
    top: 0,
    opacity: 0.68,
  },
  edgeBottom: {
    bottom: 0,
    opacity: 0.68,
  },
  edgeStripV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '5%',
    overflow: 'hidden',
  },
  edgeLeft: {
    left: 0,
    opacity: 0.34,
  },
  edgeRight: {
    right: 0,
    opacity: 0.34,
  },
  edgeImgH: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    aspectRatio: 1,
  },
  edgeImgBottom: {
    top: undefined,
    bottom: 0,
  },
  edgeImgV: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    aspectRatio: 1,
  },
  edgeImgRight: {
    left: undefined,
    right: 0,
  },
  coverImg: {
    width: '100%',
    height: '100%',
  },
  coverEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lyricArea: {
    flex: 1,
  },
  lyricFadeTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 70,
    zIndex: 2,
  },
  lyricFadeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
    zIndex: 2,
    transform: [{ scaleY: -1 }],
  },
  singleLineArea: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 26,
    paddingRight: 26,
  },
  lyricContent: {
    paddingLeft: 26,
    paddingRight: 26,
    paddingTop: 40,
    paddingBottom: 60,
  },
  lyricLine: {
    textAlign: 'center',
    paddingTop: 9,
    paddingBottom: 9,
  },
  lyricActive: {
    fontWeight: '600',
  },
  lyricEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lyricEmptyText: {
    marginTop: 10,
  },
  lyricStrip: {
    // flex:1 吸收封面区固定高度后剩下的空间，让歌词紧贴封面下方、
    // 同时把信息区/进度/按键压到屏幕底部
    flex: 1,
    minHeight: 50,
    justifyContent: 'flex-start',
    paddingLeft: 26,
    paddingRight: 26,
    paddingTop: 6,
  },
  nowLyric: {
    lineHeight: 21,
    letterSpacing: 0.2,
  },
  infoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 26,
    paddingRight: 12,
    paddingBottom: 10,
  },
  titleText: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 10,
  },
  songName: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  songSinger: {
    marginTop: 5,
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBlock: {
    paddingLeft: 24,
    paddingRight: 24,
  },
  slider: {
    width: '100%',
    height: 26,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  timeText: {
    flexShrink: 0,
    minWidth: 42,
    fontVariant: ['tabular-nums'],
  },
  timeCenter: {
    flexGrow: 1,
    flexShrink: 1,
    textAlign: 'center',
    paddingLeft: 10,
    paddingRight: 10,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    marginTop: 10,
    marginBottom: 18,
  },
  ctrlBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctrlBtnBig: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtn: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMask: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  queueSheet: {
    maxHeight: '60%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  queueHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 18,
    paddingRight: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  queueTitle: {
    fontWeight: '600',
  },
  queueList: {
    paddingLeft: 8,
    paddingRight: 8,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  queueIndex: {
    width: 26,
  },
  queueCover: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
  },
  queueInfo: {
    flexGrow: 1,
    flexShrink: 1,
  },
  queueSinger: {
    marginTop: 2,
  },
  detailSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
  },
  detailLabel: {
    width: 62,
  },
  detailValue: {
    flexGrow: 1,
    flexShrink: 1,
  },
})
