import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
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
import { collectMusic, playNext, playPrev, togglePlay, uncollectMusic } from '@/core/player/player'
import { setCurrentTime, getPosition, getDuration } from '@/plugins/player'
import { setNowPlayTime, setMaxplayTime } from '@/core/player/progress'
import { getListMusicSync } from '@/utils/listManage'
import { LIST_IDS } from '@/config/constant'
import { setNavActiveId, updateSetting } from '@/core/common'
import { formatSize, QUALITY_LABEL } from '@/core/download/utils'

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

/** 底部渐变遮罩的逐层透明度，从浅到深模拟线性渐变 */
const GRADIENT_STOPS = [0.05, 0.09, 0.14, 0.20, 0.27, 0.35, 0.44, 0.54]

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

const LyricLine = memo(({ text, active, ratio, size }: {
  text: string
  active: boolean
  ratio: number
  size: number
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

  const currentTime = progress.nowPlayTime
  const maxTime = progress.maxPlayTime

  const audioMeta = useMemo(() => {
    const raw = playerState.playMusicInfo.musicInfo
    if (!raw) return ''
    if ('progress' in raw) {
      const info = raw.metadata
      return [info.ext?.toUpperCase(), QUALITY_LABEL[info.quality as LX.Quality] ?? info.quality].filter(Boolean).join(' · ')
    }
    if (raw.source === 'local') {
      return [raw.meta.ext?.toUpperCase(), raw.meta.bitrate, raw.meta.size ? formatSize(raw.meta.size) : ''].filter(Boolean).join(' · ')
    }
    const qualities = raw.meta.qualitys ?? []
    const best = qualities.length ? qualities[qualities.length - 1] : null
    return [best ? (QUALITY_LABEL[best.type] ?? best.type) : '', raw.meta.albumName].filter(Boolean).join(' · ')
  }, [musicInfo.id])

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

  return (
    <Animated.View
      style={{ ...styles.container, transform: [{ translateY: panY }] }}
      {...panResponder.panHandlers}
    >
      {/* 背景：封面态清晰全屏，歌词态模糊压暗 */}
      {
        pic
          ? <RNImage
              source={{ uri: pic }}
              blurRadius={isCover ? 0 : 40}
              style={StyleSheet.absoluteFill}
              resizeMode='cover'
            />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#151019' }]} />
      }

      {/* 歌词态整体压暗，保证文字可读 */}
      {
        isCover
          ? null
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,6,12,0.62)' }]} />
      }

      {/* 底部渐变：用多层半透明色块模拟，避免引入渐变库 */}
      <View pointerEvents='none' style={StyleSheet.absoluteFill}>
        {
          GRADIENT_STOPS.map((alpha, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${38 + i * (62 / GRADIENT_STOPS.length)}%`,
                height: `${62 / GRADIENT_STOPS.length + 1}%`,
                backgroundColor: `rgba(0,0,0,${alpha})`,
              }}
            />
          ))
        }
      </View>

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
                {pic ? null : (
                  <View style={styles.coverPlaceholder}>
                    <Icon name='album' size={64} color='rgba(255,255,255,0.12)' />
                  </View>
                )}
              </TouchableOpacity>
              )
            : (
              <View style={styles.lyricArea}>
                {
                  lines.length
                    ? (
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
                              />
                            </TouchableOpacity>
                          ))
                        }
                      </ScrollView>
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
                  <Text size={12} color='rgba(255,255,255,0.72)' numberOfLines={1} style={styles.currentLyric}>
                    {lrcPlay.text || ' '}
                  </Text>
                  <Text size={22} color='#FFFFFF' numberOfLines={1} style={styles.name}>{musicInfo.name || '未在播放'}</Text>
                  <Text size={12} color='rgba(255,255,255,0.6)' numberOfLines={1} style={styles.singer}>{musicInfo.singer}</Text>
                </TouchableOpacity>
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
                  <View key={`${item.id}_${index}`} style={styles.queueRow}>
                    <Text size={12} color={theme['c-450']} style={styles.queueIndex}>{index + 1}</Text>
                    <PicImage musicInfo={item} listId={playerState.playInfo.playerListId} style={styles.queueCover} />
                    <View style={styles.queueInfo}>
                      <Text size={13} numberOfLines={1}>{item.name}</Text>
                      <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.queueSinger}>{item.singer}</Text>
                    </View>
                  </View>
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
    </Animated.View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
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
    marginBottom: 8,
    letterSpacing: 0.2,
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
