import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  ScrollView,
  StatusBar as RNStatusBar,
  TouchableOpacity,
  View,
  Image as RNImage,
} from 'react-native'

import Text from '@/components/common/Text'
import PicImage from '@/components/common/PicImage'
import MarqueeText from '@/components/common/MarqueeText'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo, useIsPlay, useProgress } from '@/store/player/hook'
import { useStatusbarHeight, useNavActiveId } from '@/store/common/hook'
import { useWindowSize } from '@/utils/hooks'
import { useSettingValue } from '@/store/setting/hook'
import { toast } from '@/utils/tools'
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
import Stage, { COVER_TOP_RATIO, COVER_H_RATIO } from './Stage'
import SeekBar from './SeekBar'
import { u } from './metrics'

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

/** 歌词字号（当前行）。非当前行 = 当前行 / 1.14（飞牛实测 19.5 : 17.1） */
const LYRIC_SIZES = [17.5, 20, 22.5, 25.5]
const LYRIC_NORMAL_RATIO = 1.14

/** 歌词行高：飞牛实测 112.6px / 2.625 = 42.9dp */
const LYRIC_LINE_H = 42.9
/**
 * 底部整块高度：信息行 44 + 24 + 进度 48 + 32 + 控制 56 + 32 = 236
 * 飞牛实测：信息行 655.6、进度 723.4、控制 803.4、底部留白 32
 */
const BOTTOM_BLOCK_H = 236

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

/**
 * 歌词行。飞牛：当前行纯白 + 加粗 + 字号放大，其余行统一半透明白（没有距离渐隐）。
 */
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
        size={u(size / LYRIC_NORMAL_RATIO)}
        color='rgba(255,255,255,0.38)'
        style={styles.lyricLine}
        numberOfLines={1}
      >{text || ' '}</Text>
    )
  }
  // 关闭逐字时整行高亮
  if (!wordByWord) {
    return (
      <Text
        size={u(size)}
        color='#FFFFFF'
        style={{ ...styles.lyricLine, fontWeight: '600' }}
        numberOfLines={1}
      >{text || ' '}</Text>
    )
  }
  const shown = Math.min(text.length, Math.ceil(text.length * Math.max(0, Math.min(1, ratio))))
  return (
    <Text
      size={u(size)}
      color='rgba(255,255,255,0.32)'
      style={styles.lyricLine}
      numberOfLines={1}
    >
      <Text size={u(size)} color='#FFFFFF' style={styles.lyricActive}>{text.slice(0, shown)}</Text>
      {text.slice(shown)}
    </Text>
  )
})

export default () => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const navActiveId = useNavActiveId()
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const progress = useProgress()
  const lines = useLrcSet()
  const lrcPlay = useLrcPlay()
  const { height, width } = useWindowSize()
  const playMode = (useSettingValue('player.togglePlayMethod') ?? 'listLoop') as PlayMode

  const [mode, setMode] = useState<'cover' | 'lyric'>('cover')
  const [sizeIndex, setSizeIndex] = useState(1)
  const [now, setNow] = useState(0)
  const [seekPreview, setSeekPreview] = useState<number | null>(null)
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

  // ── 布局常量（全部来自飞牛 1080x2340 实测，真 dp） ──
  const coverTop = height * COVER_TOP_RATIO
  const coverH = height * COVER_H_RATIO
  const bottomTop = height - BOTTOM_BLOCK_H
  /** 封面态：封面下方的当前歌词行区域 */
  const stripTop = coverTop + coverH
  const stripH = bottomTop - stripTop
  /** 歌词页：歌词列表区域 */
  const lyricAreaH = bottomTop - coverTop
  // 必须是稳定引用：每次渲染新建对象会让 ScrollView 重新应用样式
  const lyricContentStyle = useMemo(() => ({ paddingLeft: 20, paddingRight: 20 }), [])

  // 下拉返回：拖动封面页下滑关闭，带跟手位移动画
  const panY = useRef(new Animated.Value(0)).current
  const modeRef = useRef(mode)
  modeRef.current = mode
  const heightRef = useRef(height)
  heightRef.current = height

  const closeWithSlideDown = useCallback(() => {
    Animated.timing(panY, {
      toValue: heightRef.current,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      panY.setValue(0)
      setNavActiveId('nav_home')
    })
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
        closeWithSlideDown()
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
    setSeekPreview(null)
    setNowPlayTime(time)
    setNow(time)
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

  const currentTime = seekPreview ?? progress.nowPlayTime
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

  const timeMs = (mode === 'lyric' ? now : progress.nowPlayTime) * 1000
  const currentLine = useMemo(() => findLine(lines, timeMs), [lines, timeMs])
  const currentRatio = useMemo(() => {
    if (currentLine < 0) return 0
    const start = lines[currentLine].time
    const end = lines[currentLine + 1]?.time ?? (maxTime * 1000 || start + 4000)
    return end > start ? (timeMs - start) / (end - start) : 0
  }, [currentLine, lines, timeMs, maxTime])

  const scrollRef = useRef<ScrollView>(null)
  /** 行高固定 + 上下等长 spacer，当前行居中就是滚到 index * 行高 */
  const currentLineRef = useRef(currentLine)
  currentLineRef.current = currentLine

  const scrollToLine = useCallback((index: number, animated: boolean) => {
    if (index < 0) return
    scrollRef.current?.scrollTo({ y: index * LYRIC_LINE_H, animated })
  }, [])

  useEffect(() => {
    if (mode !== 'lyric') return
    scrollToLine(currentLine, true)
  }, [currentLine, mode, scrollToLine])

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
        播放器页背景永远是深色，但全局 StatusBar 是按主题给 barStyle 的，
        浅色主题下状态栏图标就是黑的、在封面糊底上完全看不见。
        这里在播放器页挂一个 light-content 的 StatusBar 覆盖掉全局设置。
      */}
      {navActiveId === 'nav_player' ? (
        <RNStatusBar barStyle='light-content' backgroundColor='rgba(0,0,0,0)' translucent />
      ) : null}

      {/* 背景：整屏模糊封面（歌词页更糊，飞牛是整片柔光） */}
      <View pointerEvents='none' style={styles.bgBlur}>
        {
          pic
            ? <RNImage source={{ uri: pic }} blurRadius={mode === 'lyric' ? 55 : 34} style={styles.bgImg} resizeMode='cover' />
            : <View style={[styles.bgImg, { backgroundColor: '#17141C' }]} />
        }
      </View>
      {/* 压暗：顶部给状态栏/标题，底部给控制区 */}
      <View pointerEvents='none' style={styles.bgDim} />
      <View pointerEvents='none' style={styles.scrimTop}>
        <RNImage source={FADE_TOP} resizeMode='stretch' style={styles.bgImg} />
      </View>
      <View pointerEvents='none' style={styles.scrimBottom}>
        <RNImage source={FADE_BOTTOM} resizeMode='stretch' style={styles.bgImg} />
      </View>

      {/* 舞台：上倒影 + 封面（四边柔化）+ 下倒影，全部铺到屏幕边缘 */}
      <Animated.View pointerEvents='none' style={[styles.stage, { opacity: coverAnim }]}>
        <Stage pic={pic} width={width} height={height} hidden={mode === 'lyric'} />
      </Animated.View>

      {/* 顶栏：返回键 + （歌词页）居中的歌名/歌手 */}
      <View style={[styles.header, { top: statusBarHeight + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => { setNavActiveId('nav_home') }}
        >
          <Icon name='chevron-down' size={u(26)} color='rgba(255,255,255,0.94)' />
        </TouchableOpacity>
        {
          mode === 'lyric'
            ? (
              <View pointerEvents='none' style={styles.headerTitle}>
                <Text size={u(15)} color='rgba(255,255,255,0.96)' numberOfLines={1} style={styles.headerName}>{musicInfo.name || '未在播放'}</Text>
                <Text size={u(11)} color='rgba(255,255,255,0.62)' numberOfLines={1} style={styles.headerSinger}>{musicInfo.singer}</Text>
              </View>
              )
            : null
        }
      </View>

      {
        mode === 'cover'
          ? (
            <>
              {/* 封面 + 封面下方当前歌词，整块可点切歌词（飞牛点击区 16..395dp） */}
              <TouchableOpacity
                activeOpacity={1}
                style={{ position: 'absolute', left: 16, right: 16, top: coverTop, height: bottomTop - coverTop }}
                onPress={handleToggleMode}
              />
              <View pointerEvents='none' style={[styles.lyricStrip, { top: stripTop, height: stripH }]}>
                <Text size={u(16)} color='rgba(255,255,255,0.95)' numberOfLines={1} style={styles.nowLyric}>
                  {lrcPlay.text || ' '}
                </Text>
              </View>
            </>
            )
          : (
            <View style={{ position: 'absolute', left: 0, right: 0, top: coverTop, height: lyricAreaH }}>
              {
                lines.length
                  ? (
                      isSingleLine
                        ? (
                        <TouchableOpacity activeOpacity={0.9} style={styles.singleLineArea} onPress={handleToggleMode}>
                          <LyricLine
                            text={currentLine >= 0 ? lines[currentLine].text : ''}
                            size={lyricSize + 4}
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
                          contentContainerStyle={lyricContentStyle}
                          scrollEventThrottle={32}
                          onScroll={e => { lyricScrollY.current = e.nativeEvent.contentOffset.y }}
                          onContentSizeChange={() => { scrollToLine(currentLineRef.current, false) }}
                        >
                          <View style={{ height: lyricAreaH / 2 - LYRIC_LINE_H / 2 }} />
                          {
                            lines.map((line, index) => (
                              <TouchableOpacity
                                key={`${index}_${line.time}`}
                                activeOpacity={0.85}
                                style={styles.lyricRow}
                                onPress={handleToggleMode}
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
                          <View style={{ height: lyricAreaH / 2 - LYRIC_LINE_H / 2 }} />
                        </ScrollView>
                          )
                    )
                  : (
                    <TouchableOpacity activeOpacity={0.8} style={styles.lyricEmpty} onPress={handleToggleMode}>
                      <Icon name='comment-text-outline' size={u(30)} color='rgba(255,255,255,0.4)' />
                      <Text size={u(12)} color='rgba(255,255,255,0.38)' style={styles.lyricEmptyText}>暂无歌词 · 点击返回</Text>
                    </TouchableOpacity>
                    )
              }
            </View>
            )
      }

      {/* 底部整块：信息行/工具行 + 进度 + 五个主控键（尺寸全部按飞牛实测） */}
      <View style={[styles.bottomBlock, { top: bottomTop }]}>
        {
          mode === 'cover'
            ? (
              <View style={styles.infoRow}>
                <TouchableOpacity style={styles.titleText} activeOpacity={0.75} onPress={handleToggleMode}>
                  <MarqueeText
                    text={musicInfo.name || '未在播放'}
                    size={u(18)}
                    color='#FFFFFF'
                    style={styles.songName}
                  />
                  <Text size={u(12)} color='rgba(255,255,255,0.66)' numberOfLines={1} style={styles.songSinger}>{musicInfo.singer}</Text>
                </TouchableOpacity>
                <View style={styles.infoActions}>
                  {
                    autoSaveEnabled
                      ? null
                      : (
                        <TouchableOpacity style={styles.iconBtn} onPress={handleDownload} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Icon name='download-2' size={u(21)} color='rgba(255,255,255,0.92)' />
                        </TouchableOpacity>
                        )
                  }
                  <TouchableOpacity style={styles.iconBtn} onPress={handleToggleCollect} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Icon
                      name={collected ? 'love' : 'heart-outline'}
                      size={u(26)}
                      color={collected ? '#FF3B5C' : 'rgba(255,255,255,0.92)'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => { setDetailVisible(true) }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Icon name='dots-vertical' size={u(24)} color='rgba(255,255,255,0.92)' />
                  </TouchableOpacity>
                </View>
              </View>
              )
            : (
              <View style={styles.toolRow}>
                <TouchableOpacity style={styles.toolBtn} onPress={handleSizeChange} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Icon name='format-size' size={u(21)} color='rgba(255,255,255,0.88)' />
                </TouchableOpacity>
                <View style={styles.infoActions}>
                  <TouchableOpacity style={styles.iconBtn} onPress={handleToggleCollect} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Icon name={collected ? 'love' : 'heart-outline'} size={u(26)} color={collected ? '#FF3B5C' : 'rgba(255,255,255,0.9)'} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => { setDetailVisible(true) }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Icon name='dots-vertical' size={u(24)} color='rgba(255,255,255,0.9)' />
                  </TouchableOpacity>
                </View>
              </View>
              )
        }

        <View style={styles.progressBlock}>
          <View style={styles.seekWrap}>
            <SeekBar
              value={currentTime}
              max={maxTime}
              height={6}
              onSeek={handleSeek}
              onPreview={setSeekPreview}
            />
          </View>
          <View style={styles.timeRow}>
            <Text size={u(11)} color='rgba(255,255,255,0.78)' style={styles.timeText}>{formatTime(currentTime)}</Text>
            {
              audioMeta
                ? <Text size={u(10.5)} color='rgba(255,255,255,0.54)' numberOfLines={1} style={styles.timeCenter}>{audioMeta}</Text>
                : <View style={styles.timeCenter} />
            }
            <Text size={u(11)} color='rgba(255,255,255,0.78)' style={styles.timeTextRight}>{formatTime(maxTime)}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.ctrlBtn} onPress={handleCycleMode} activeOpacity={0.6}>
            <Icon name={MODE_ICON[playMode]} size={u(21)} color='rgba(255,255,255,0.9)' />
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtnBig} onPress={() => { void playPrev() }} activeOpacity={0.6}>
            <Icon name='prevMusic' size={u(39)} color='#FFFFFF' />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ctrlBtnBig}
            onPress={togglePlay}
            activeOpacity={0.75}
            onPressIn={() => { pressPlay(0.9) }}
            onPressOut={() => { pressPlay(1) }}
          >
            <Animated.View style={{ transform: [{ scale: playBtnScale }] }}>
              <Icon name={isPlay ? 'pause' : 'play'} size={u(53)} color='#FFFFFF' />
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtnBig} onPress={() => { void playNext() }} activeOpacity={0.6}>
            <Icon name='nextMusic' size={u(39)} color='#FFFFFF' />
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => { setQueueVisible(true) }} activeOpacity={0.6}>
            <Icon name='playlist-music' size={u(23)} color='rgba(255,255,255,0.9)' />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={queueVisible} transparent animationType='slide' onRequestClose={() => { setQueueVisible(false) }}>
        <TouchableOpacity style={styles.modalMask} activeOpacity={1} onPress={() => { setQueueVisible(false) }}>
          <View style={{ ...styles.queueSheet, backgroundColor: theme['c-content-background'] }}>
            <View style={styles.queueHead}>
              <Text size={u(14)} style={styles.queueTitle}>播放队列 · {queue.length}</Text>
              <TouchableOpacity onPress={() => { setQueueVisible(false) }}>
                <Icon name='close' size={u(18)} color={theme['c-450']} />
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
                    <Text size={u(12)} color={theme['c-450']} style={styles.queueIndex}>{index + 1}</Text>
                    <PicImage musicInfo={item} listId={playerState.playInfo.playerListId} style={styles.queueCover} />
                    <View style={styles.queueInfo}>
                      <Text size={u(13)} numberOfLines={1}>{item.name}</Text>
                      <Text size={u(10)} color={theme['c-450']} numberOfLines={1} style={styles.queueSinger}>{item.singer}</Text>
                    </View>
                    {
                      item.id === musicInfo.id
                        ? <Icon name='volume-high' size={u(15)} color={theme['c-primary-font']} />
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
            <Text size={u(14)} style={styles.queueTitle}>歌曲详情</Text>
            {
              detailRows.map(row => (
                <View key={row.label} style={styles.detailRow}>
                  <Text size={u(12)} color={theme['c-450']} style={styles.detailLabel}>{row.label}</Text>
                  <Text size={u(12)} numberOfLines={2} style={styles.detailValue}>{row.value}</Text>
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

/**
 * 这里刻意不用 createStyle：它会把数值按 375x667 设计稿放大（本机 1.097），
 * 而下面的数字都是飞牛真机实测的真 dp，必须原样生效才能 1:1 对齐。
 */
const styles = {
  container: {
    flex: 1,
    width: '100%' as const,
    backgroundColor: '#0B0810',
  },
  /*
    注意：绝对定位的 <Image> 只写 left/right 时，RN 会按图片自身像素宽渲染
    （fade PNG 只有 8px → 21px 一条）。所有绝对定位的图片都外包一层 View。
  */
  bgBlur: { position: 'absolute' as const, left: -40, right: -40, top: -40, bottom: -40 },
  bgImg: { width: '100%' as const, height: '100%' as const },
  bgDim: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,8,14,0.18)',
  },
  scrimTop: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: 0,
    height: 190,
    opacity: 0.34,
  },
  scrimBottom: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: 430,
    opacity: 0.5,
  },

  stage: { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0 },

  header: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    height: 40,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingLeft: 16,
    paddingRight: 16,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center' as const, alignItems: 'center' as const },
  headerTitle: {
    position: 'absolute' as const,
    left: 60,
    right: 60,
    top: 0,
    bottom: 0,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerName: { fontWeight: '600' as const, lineHeight: 20 },
  headerSinger: { lineHeight: 16 },

  /* 封面态：封面下方的当前歌词行（飞牛 588.6..605.7） */
  lyricStrip: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    justifyContent: 'center' as const,
    paddingLeft: 24,
    paddingRight: 24,
  },
  nowLyric: {
    lineHeight: 22,
    marginBottom: 17,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },

  singleLineArea: {
    flex: 1,
    justifyContent: 'center' as const,
    paddingLeft: 20,
    paddingRight: 20,
  },
  lyricRow: { height: LYRIC_LINE_H, justifyContent: 'center' as const },
  lyricLine: { textAlign: 'center' as const },
  lyricActive: { fontWeight: '600' as const },
  lyricEmpty: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  lyricEmptyText: { marginTop: 10 },

  bottomBlock: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    height: BOTTOM_BLOCK_H,
  },
  /* 信息行：655.6..699.4（高 44） */
  infoRow: {
    height: 44,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingLeft: 24,
    paddingRight: 16,
  },
  titleText: { flexGrow: 1, flexShrink: 1, paddingRight: 8 },
  songName: { fontWeight: '600' as const },
  songSinger: { lineHeight: 20 },
  infoActions: { flexDirection: 'row' as const, alignItems: 'center' as const },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginLeft: 12,
  },
  toolRow: {
    height: 44,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingLeft: 16,
    paddingRight: 16,
  },
  toolBtn: { width: 44, height: 44, justifyContent: 'center' as const, alignItems: 'center' as const },

  /* 进度：723.4..771.4（高 48），轨道 6dp、中心在块内 25.2 */
  progressBlock: { height: 48, marginTop: 24, paddingLeft: 24, paddingRight: 24 },
  // SeekBar 高 38（轨道 6 + 上下各 16 触摸区），轨道中心在 19 → top 6.2 让中心落在块内 25.2
  seekWrap: { position: 'absolute' as const, left: 24, right: 24, top: 6.2 },
  timeRow: {
    position: 'absolute' as const,
    left: 24,
    right: 24,
    top: 28.2,
    height: 19.8,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  // 左右时间都留 40dp 最小宽度防止数字跳动；右边那个右对齐，墨迹才能正好落在进度条末端
  timeText: { flexShrink: 0, minWidth: 40, fontVariant: ['tabular-nums'] as const },
  timeTextRight: { flexShrink: 0, minWidth: 40, textAlign: 'right' as const, fontVariant: ['tabular-nums'] as const },
  timeCenter: {
    flexGrow: 1,
    flexShrink: 1,
    textAlign: 'center' as const,
    paddingLeft: 10,
    paddingRight: 10,
  },

  /* 控制：803.4..859.4（高 56），两端贴边、无左右 padding */
  controls: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    height: 56,
    marginTop: 32,
    marginBottom: 32,
    /*
      按钮是 48dp，图标墨迹居中，左右各留 (48-17.5)/2=15.25dp。
      要让「随机播放」图标左沿对齐进度条起点 24dp、播放队列图标右沿对齐终点 387.4dp，
      行内左右各内缩 8.75 / 9.2。
    */
    paddingLeft: 8.75,
    paddingRight: 9.2,
  },
  ctrlBtn: { width: 48, height: 48, justifyContent: 'center' as const, alignItems: 'center' as const },
  ctrlBtnBig: { width: 56, height: 56, justifyContent: 'center' as const, alignItems: 'center' as const },

  modalMask: { flex: 1, justifyContent: 'flex-end' as const, backgroundColor: 'rgba(0,0,0,0.45)' },
  queueSheet: { maxHeight: '60%' as const, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  queueHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingLeft: 18,
    paddingRight: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  queueTitle: { fontWeight: '600' as const },
  queueList: { paddingLeft: 8, paddingRight: 8 },
  queueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  queueIndex: { width: 26 },
  queueCover: { width: 36, height: 36, borderRadius: 8, marginRight: 10 },
  queueInfo: { flexGrow: 1, flexShrink: 1 },
  queueSinger: { marginTop: 2 },
  detailSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  detailRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, marginTop: 12 },
  detailLabel: { width: 62 },
  detailValue: { flexGrow: 1, flexShrink: 1 },
}
