import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Image as RNImage,
} from 'react-native'

import Text from '@/components/common/Text'
import PicImage from '@/components/common/PicImage'
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
const FADE_TOP = require('@/resources/images/fade-top.png')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FADE_BOTTOM = require('@/resources/images/fade-bottom.png')

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

const LyricLine = memo(({ text, active, ratio, size, wordByWord }: {
  text: string
  active: boolean
  ratio: number
  size: number
  wordByWord: boolean
}) => {
  if (!active) {
    return (
      <Text
        size={size}
        color='rgba(255,255,255,0.42)'
        style={{ ...styles.lyricLine, lineHeight: size * 1.5 }}
        numberOfLines={2}
      >{text || ' '}</Text>
    )
  }
  // 关闭逐字时整行高亮
  if (!wordByWord) {
    return (
      <Text
        size={size}
        color='#FFFFFF'
        style={{ ...styles.lyricLine, lineHeight: size * 1.5, fontWeight: '600' }}
        numberOfLines={2}
      >{text || ' '}</Text>
    )
  }
  const shown = Math.min(text.length, Math.ceil(text.length * Math.max(0, Math.min(1, ratio))))
  return (
    <Text
      size={size}
      color='rgba(255,255,255,0.42)'
      style={{ ...styles.lyricLine, lineHeight: size * 1.5 }}
      numberOfLines={2}
    >
      <Text size={size} color='#FFFFFF' style={styles.lyricActive}>{text.slice(0, shown)}</Text>
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

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => (
      modeRef.current === 'cover' && g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5
    ),
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) panY.setValue(g.dy)
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 110 || g.vy > 0.6) {
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

  useEffect(() => {
    if (mode !== 'lyric' || currentLine < 0) return
    const offset = lineOffsets.current[currentLine]
    if (offset == null) return
    scrollRef.current?.scrollTo({ y: Math.max(0, offset - height * 0.26), animated: true })
  }, [currentLine, mode, height])

  const pic = musicInfo.pic
  const isCover = mode === 'cover'

  // 封面卡进场：换歌或从歌词页切回时，从 92% 缩放淡入
  const coverAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!isCover) return
    coverAnim.setValue(0)
    Animated.timing(coverAnim, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [coverAnim, isCover, pic])

  return (
    <Animated.View
      style={{ ...styles.container, transform: [{ translateY: panY }] }}
      {...panResponder.panHandlers}
    >
      {/* 底层：同一张封面放大模糊，铺满整屏 */}
      {
        pic
          ? <RNImage
              source={{ uri: pic }}
              blurRadius={isCover ? 48 : 36}
              style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.22 }] }]}
              resizeMode='cover'
            />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#151019' }]} />
      }

      {/*
        磨砂玻璃层：封面之外（以及整个歌词页）都是半透明的磨砂面，
        不是把封面糊成一片背景 —— 加一层冷白高光 + 暗色蒙版，才有“玻璃”的质感
      */}
      <View
        pointerEvents='none'
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isCover ? 'rgba(10,8,16,0.34)' : 'rgba(10,8,16,0.30)' },
        ]}
      />
      <View
        pointerEvents='none'
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.045)' }]}
      />

      {/* 顶部渐变：让状态栏与背景自然融合 */}
      <RNImage source={FADE_TOP} resizeMode='stretch' style={styles.topGradient} />
      {/* 底部渐变：预渲染 alpha 渐变，无横带 */}
      <RNImage source={FADE_BOTTOM} resizeMode='stretch' style={styles.bottomGradient} />

      <View style={{ flex: 1, paddingTop: statusBarHeight }}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.topBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => { setNavActiveId('nav_home') }}
          >
            <Icon name='chevron-down' size={22} color='rgba(255,255,255,0.9)' />
          </TouchableOpacity>
          {
            mode === 'lyric'
              ? (
                <TouchableOpacity style={styles.topTitle} activeOpacity={0.7} onPress={handleToggleMode}>
                  <Text size={16} color='#FFFFFF' numberOfLines={1} style={styles.topName}>{musicInfo.name || '未在播放'}</Text>
                  <Text size={11} color='rgba(255,255,255,0.6)' numberOfLines={1} style={styles.topSinger}>{musicInfo.singer}</Text>
                </TouchableOpacity>
                )
              : null
          }
          <View style={styles.topBtn} />
        </View>

        {
          mode === 'cover'
            ? (
              <TouchableOpacity activeOpacity={1} style={styles.coverArea} onPress={handleToggleMode}>
                {
                  pic
                    ? (
                      <Animated.View style={{ ...styles.coverShadow, opacity: coverAnim, transform: [{ scale: coverAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}>
                        <View style={styles.coverCard}>
                          <RNImage source={{ uri: pic }} style={styles.coverImg} resizeMode='cover' />
                        </View>
                      </Animated.View>
                      )
                    : (
                      <View style={styles.coverPlaceholder}>
                        <Icon name='album' size={64} color='rgba(255,255,255,0.12)' />
                      </View>
                      )
                }
              </TouchableOpacity>
              )
            : (
              <View style={styles.lyricArea}>
                {
                  lines.length
                    ? (
                        isSingleLine
                          ? (
                          <TouchableOpacity activeOpacity={0.9} style={styles.singleLineArea} onPress={handleToggleMode}>
                            <LyricLine
                              text={currentLine >= 0 ? lines[currentLine].text : ''}
                              size={lyricSize + 3}
                              active
                              ratio={currentRatio}
                              wordByWord={isWordByWord}
                            />
                          </TouchableOpacity>
                            )
                          : (
                          <ScrollView
                            ref={scrollRef}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.lyricContent}
                            scrollEventThrottle={32}
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
                                  />
                                </TouchableOpacity>
                              ))
                            }
                          </ScrollView>
                            )
                      )
                    : (
                      <TouchableOpacity activeOpacity={0.8} style={styles.lyricEmpty} onPress={handleToggleMode}>
                        <Icon name='comment-text-outline' size={30} color='rgba(255,255,255,0.35)' />
                        <Text size={12} color='rgba(255,255,255,0.5)' style={styles.lyricEmptyText}>暂无歌词 · 点击返回</Text>
                      </TouchableOpacity>
                      )
                }
              </View>
              )
        }

        {
          mode === 'cover'
            ? (
              <View style={styles.infoRow}>
                <TouchableOpacity style={styles.infoText} activeOpacity={0.7} onPress={handleToggleMode}>
                  <Text size={15} color='rgba(255,255,255,0.78)' numberOfLines={1} style={styles.currentLyric}>
                    {lrcPlay.text || ' '}
                  </Text>
                  <Text size={22} color='#FFFFFF' numberOfLines={1} style={styles.name}>{musicInfo.name || '未在播放'}</Text>
                  <Text size={12} color='rgba(255,255,255,0.6)' numberOfLines={1} style={styles.singer}>{musicInfo.singer}</Text>
                </TouchableOpacity>
                {
                  autoSaveEnabled
                    ? null
                    : (
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={handleDownload}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Icon name='download-2' size={21} color='rgba(255,255,255,0.9)' />
                      </TouchableOpacity>
                      )
                }
                <TouchableOpacity style={styles.iconBtn} onPress={handleToggleCollect} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Icon
                    name={collected ? 'love' : 'heart-outline'}
                    size={22}
                    color={collected ? '#FF4D6D' : 'rgba(255,255,255,0.9)'}
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => { setDetailVisible(true) }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Icon name='dots-vertical' size={20} color='rgba(255,255,255,0.9)' />
                </TouchableOpacity>
              </View>
              )
            : (
              <View style={styles.lyricTools}>
                <TouchableOpacity style={styles.iconBtn} onPress={handleSizeChange}>
                  <Icon name='format-size' size={20} color='rgba(255,255,255,0.85)' />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={handleToggleCollect}>
                  <Icon name={collected ? 'love' : 'heart-outline'} size={21} color={collected ? '#FF4D6D' : 'rgba(255,255,255,0.85)'} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => { setDetailVisible(true) }}>
                  <Icon name='dots-vertical' size={20} color='rgba(255,255,255,0.85)' />
                </TouchableOpacity>
              </View>
              )
        }

        <View style={styles.bottomArea}>
          <Slider
            value={currentTime}
            minimumValue={0}
            maximumValue={maxTime || 1}
            minimumTrackTintColor='rgba(255,255,255,0.95)'
            maximumTrackTintColor='rgba(255,255,255,0.28)'
            thumbTintColor='#FFFFFF'
            style={styles.slider}
            onSlidingComplete={handleSeek}
          />
          <View style={styles.timeRow}>
            <Text size={11} color='rgba(255,255,255,0.65)' style={styles.timeText}>{formatTime(currentTime)}</Text>
            {
              audioMeta
                ? <Text size={10} color='rgba(255,255,255,0.45)' numberOfLines={1} style={styles.timeCenter}>{audioMeta}</Text>
                : <View style={styles.timeCenter} />
            }
            <Text size={11} color='rgba(255,255,255,0.65)' style={styles.timeText}>{formatTime(maxTime)}</Text>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity style={styles.ctrlBtn} onPress={handleCycleMode}>
              <Icon name={MODE_ICON[playMode]} size={21} color='rgba(255,255,255,0.85)' />
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => { void playPrev() }}>
              <Icon name='prevMusic' size={30} color='#FFFFFF' />
            </TouchableOpacity>
            <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
              <Icon name={isPlay ? 'pause' : 'play'} size={40} color='#FFFFFF' />
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => { void playNext() }}>
              <Icon name='nextMusic' size={30} color='#FFFFFF' />
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => { setQueueVisible(true) }}>
              <Icon name='playlist-music' size={24} color='rgba(255,255,255,0.85)' />
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#0B0810',
  },
  coverShadow: {
    width: '86%',
    aspectRatio: 1,
    borderRadius: 26,
    elevation: 22,
    shadowColor: '#000000',
    shadowOpacity: 0.42,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
  },
  coverCard: {
    flex: 1,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  coverImg: {
    width: '100%',
    height: '100%',
  },
  topGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '26%',
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 8,
    height: 44,
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
  },
  topName: {
    fontWeight: '600',
  },
  topSinger: {
    marginTop: 3,
  },
  coverArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholder: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLyric: {
    marginBottom: 12,
    letterSpacing: 0.2,
    lineHeight: 21,
  },
  queueCover: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
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
  lyricArea: {
    flex: 1,
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 10,
    paddingTop: 12,
    paddingBottom: 4,
  },
  infoText: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 8,
  },
  name: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  singer: {
    marginTop: 5,
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lyricTools: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 12,
    paddingTop: 4,
  },
  bottomArea: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingBottom: 10,
  },
  slider: {
    width: '100%',
    height: 30,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 6,
    paddingRight: 6,
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
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 6,
    paddingBottom: 12,
  },
  ctrlBtn: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtn: {
    width: 62,
    height: 62,
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
  queueInfo: {
    flexGrow: 1,
    flexShrink: 1,
  },
  queueSinger: {
    marginTop: 2,
  },
})
