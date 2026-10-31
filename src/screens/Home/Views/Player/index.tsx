import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View, Image as RNImage } from 'react-native'

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

const formatTime = (time: number) => {
  if (!time || time < 0) return '00:00'
  const m = Math.floor(time / 60)
  const sec = Math.floor(time % 60)
  return `${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`
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
  const { width, height } = useWindowSize()
  const playMode = (useSettingValue('player.togglePlayMethod') ?? 'listLoop') as PlayMode

  const [mode, setMode] = useState<'cover' | 'lyric'>('cover')
  const [sizeIndex, setSizeIndex] = useState(1)
  const [now, setNow] = useState(0)
  const [collected, setCollected] = useState(false)
  const [queueVisible, setQueueVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)

  const lyricSize = LYRIC_SIZES[sizeIndex]
  const coverSize = useMemo(() => Math.min(width * 0.84, height * 0.44), [width, height])

  // 歌词模式用 requestAnimationFrame 做流畅逐字进度
  useEffect(() => {
    if (mode !== 'lyric') return
    let stopped = false
    let rafId: number
    let lastFetch = 0
    let cachedPos = 0

    const tick = (ts: number) => {
      if (stopped) return
      // 每 500ms 拉一次真实位置，中间用插值平滑
      if (ts - lastFetch > 500) {
        lastFetch = ts
        void getPosition().then(t => {
          if (!stopped) cachedPos = t
        }).catch(() => {})
      }
      // 用 cachedPos + 时间差做插值估算
      setNow(cachedPos)
      rafId = requestAnimationFrame(tick)
    }
    // 初始拉一次
    void getPosition().then(t => {
      if (!stopped) {
        cachedPos = t
        setNow(t)
        rafId = requestAnimationFrame(tick)
      }
    }).catch(() => {})
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
    return [best ? (QUALITY_LABEL[best as unknown as LX.Quality] ?? best) : '', raw.meta.albumName].filter(Boolean).join(' · ')
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
        const best = qualities.length ? qualities[qualities.length - 1] : ''
        if (best) rows.push({ label: '最高音质', value: QUALITY_LABEL[best as unknown as LX.Quality] ?? best })
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

  return (
    <View style={styles.container}>
      {
        pic
          ? <RNImage source={{ uri: pic }} blurRadius={30} style={StyleSheet.absoluteFill} resizeMode='cover' />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: theme['c-main-background'] }]} />
      }
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,8,16,0.55)' }]} />

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
                <View style={{ ...styles.coverShadow, width: coverSize, height: coverSize }}>
                  {
                    pic
                      ? <RNImage source={{ uri: pic }} style={{ width: coverSize, height: coverSize, borderRadius: 24 }} resizeMode='cover' />
                      : <View style={{ width: coverSize, height: coverSize, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' }}>
                        <Icon name='album' size={coverSize * 0.3} color='rgba(255,255,255,0.15)' />
                      </View>
                  }
                </View>
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
                  <Text size={11} color='rgba(255,255,255,0.55)' numberOfLines={1} style={styles.currentLyric}>
                    {lrcPlay.text || ' '}
                  </Text>
                  <Text size={18} color='#FFFFFF' numberOfLines={1} style={styles.name}>{musicInfo.name || '未在播放'}</Text>
                  <Text size={12} color='rgba(255,255,255,0.62)' numberOfLines={1} style={styles.singer}>{musicInfo.singer}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={handleToggleCollect}>
                  <Icon name={collected ? 'love' : 'heart-outline'} size={21} color={collected ? theme['c-primary-light-200'] : 'rgba(255,255,255,0.85)'} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => { setDetailVisible(true) }}>
                  <Icon name='information-outline' size={19} color='rgba(255,255,255,0.85)' />
                </TouchableOpacity>
              </View>
              )
            : (
              <View style={styles.lyricTools}>
                <TouchableOpacity style={styles.iconBtn} onPress={handleSizeChange}>
                  <Icon name='format-size' size={20} color='rgba(255,255,255,0.85)' />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={handleToggleCollect}>
                  <Icon name={collected ? 'love' : 'heart-outline'} size={21} color={collected ? theme['c-primary-light-200'] : 'rgba(255,255,255,0.85)'} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => { setDetailVisible(true) }}>
                  <Icon name='information-outline' size={19} color='rgba(255,255,255,0.85)' />
                </TouchableOpacity>
              </View>
              )
        }

        <View style={styles.bottomGlass}>
        <View style={styles.progressArea}>
          <Slider
            value={currentTime}
            minimumValue={0}
            maximumValue={maxTime || 1}
            minimumTrackTintColor='rgba(255,255,255,0.92)'
            maximumTrackTintColor='rgba(255,255,255,0.24)'
            thumbTintColor='#FFFFFF'
            style={styles.slider}
            onSlidingComplete={handleSeek}
          />
          <View style={styles.timeRow}>
            <Text size={11} color='rgba(255,255,255,0.6)' style={styles.timeText}>{formatTime(currentTime)}</Text>
            {
              mode === 'lyric'
                ? (
                  <View style={styles.timeCenter} />
                  )
                : null
            }
            <Text size={11} color='rgba(255,255,255,0.6)' style={styles.timeText}>{formatTime(maxTime)}</Text>
          </View>
          {
            audioMeta
              ? <Text size={10} color='rgba(255,255,255,0.4)' numberOfLines={1} style={styles.audioMeta}>{audioMeta}</Text>
              : null
          }
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.ctrlBtn} onPress={handleCycleMode}>
            <Icon name={MODE_ICON[playMode]} size={20} color='rgba(255,255,255,0.85)' />
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => { void playPrev() }}>
            <Icon name='prevMusic' size={26} color='#FFFFFF' />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
            <Icon name={isPlay ? 'pause' : 'play'} size={38} color='#FFFFFF' />
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => { void playNext() }}>
            <Icon name='nextMusic' size={26} color='#FFFFFF' />
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => { setQueueVisible(true) }}>
            <Icon name='playlist-music' size={22} color='rgba(255,255,255,0.85)' />
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
    </View>
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
  coverShadow: {
    borderRadius: 24,
    elevation: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
  },
  currentLyric: {
    marginBottom: 6,
  },
  audioMeta: {
    textAlign: 'center',
    marginTop: 6,
    letterSpacing: 0.3,
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
    paddingLeft: 22,
    paddingRight: 12,
    paddingTop: 14,
    paddingBottom: 6,
  },
  infoText: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 8,
  },
  name: {
    fontWeight: '600',
  },
  singer: {
    marginTop: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
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
  bottomGlass: {
    marginLeft: 12,
    marginRight: 12,
    marginTop: 6,
    marginBottom: 8,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 6,
    overflow: 'hidden',
  },
  progressArea: {
    paddingLeft: 18,
    paddingRight: 18,
    paddingTop: 8,
  },
  slider: {
    width: '100%',
    height: 32,
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
    paddingLeft: 28,
    paddingRight: 28,
    paddingTop: 10,
    paddingBottom: 16,
  },
  ctrlBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
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
