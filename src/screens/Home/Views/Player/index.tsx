import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text as RNText,
  TouchableOpacity,
  View,
  Image as RNImage,
  Image,
  type LayoutChangeEvent,
} from 'react-native'

import LinearGradient from 'react-native-linear-gradient'
import PagerView from 'react-native-pager-view'

import Text from '@/components/common/Text'
import PicImage from '@/components/common/PicImage'
import Glass from '@/components/common/Glass'
import MarqueeText from '@/components/common/MarqueeText'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo, useIsPlay, useProgress } from '@/store/player/hook'
import { useStatusbarHeight, useNavActiveId, useFontSize } from '@/store/common/hook'
import { useWindowSize } from '@/utils/hooks'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { useSettingValue } from '@/store/setting/hook'
import { toast } from '@/utils/tools'
import { useLrcSet, useLrcPlay, type Line } from '@/plugins/lyric'
import * as Jyutping from '@/utils/jyutping/index.js'
import { detectLanguage, isCantonese, isChineseLanguage } from '@/utils/language'
import playerState from '@/store/player/state'
import { collectMusic, playList, playNext, playPrev, togglePlay, uncollectMusic } from '@/core/player/player'
import { setCurrentTime, getDuration, getPosition } from '@/plugins/player'
import { removeListMusics } from '@/core/list'
import { setNowPlayTime, setMaxplayTime } from '@/core/player/progress'
import { getListMusicSync } from '@/utils/listManage'
import { LIST_IDS } from '@/config/constant'
import { setNavActiveId, updateSetting } from '@/core/common'
import { toggleTranslation } from '@/core/lyric'
import { formatSize, formatSampleRate, QUALITY_LABEL, QUALITY_DESC } from '@/core/download/utils'
import DownloadQualityModal, { type DownloadQualityModalType } from '@/components/DownloadQualityModal'
import { canPlayCloseTransition, closePlayerWithTransition } from '@/utils/playerOpen'
import Stage, { COVER_TOP_RATIO, COVER_H_RATIO } from './Stage'
import SeekBar from './SeekBar'
import SleepTimerButton from './SleepTimerButton'
import SleepTimerSheet from './SleepTimerSheet'
import LyricQuickMenu from './LyricQuickMenu'
import ListMusicAdd, { type MusicAddModalType } from '@/components/MusicAddModal'
import AddPlaylistIcon from '@/components/common/AddPlaylistIcon'
import CapsuleIconButton from '@/components/common/CapsuleIconButton'
import CapsuleButton from '@/components/common/CapsuleButton'
import { getLocalMusicListSync, updateLocalMusicMeta } from '@/core/localMusic'
import { getLanguageOverrideSync, setLanguageOverride } from '@/core/music/languageOverride'
import PlayGlyph from './PlayGlyph'
import QueueCoverFlow from './QueueCoverFlow'
import FadeMask from './FadeMask'
import { u } from './metrics'
import { getTextSize } from '@/utils/pixelRatio'
import { cleanSongName } from '@/utils/songName'
import { getPlayerPalette } from '@/theme/playerPalette'
import {
  beginClose,
  cancelClose,
  dragY,
  finishClose,
  getOriginNavId,
  getTransitionState,
  resetTransition,
  setCloseProgress,
  subscribeTransition,
} from '@/utils/playerTransition'

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
/**
 * 当前高亮行在档位字号上再大一点点：按档位比例取（17.5→+1.3、20→+1.5、
 * 22.5→+1.7、25.5→+1.9sp；单行歌词模式字号更大，封顶 +2），随档位自然变化。
 * 非当前行不变（仍然 = 档位字号 / 1.14）。
 */
const LYRIC_HIGHLIGHT_SIZE_RATIO = 0.075
const LYRIC_HIGHLIGHT_SIZE_MIN = 1
const LYRIC_HIGHLIGHT_SIZE_MAX = 2
/**
 * 当前高亮行的实际字号。主歌词层、逐字高亮的底字层和高亮层、行高都必须用同一个值：
 * 三层字号不一致时，英文逐字高亮会按旧宽度裁切，末尾字母会被切掉。
 */
const getHighlightLyricSize = (size: number) => size + Math.min(LYRIC_HIGHLIGHT_SIZE_MAX, Math.max(LYRIC_HIGHLIGHT_SIZE_MIN, size * LYRIC_HIGHLIGHT_SIZE_RATIO))
/**
 * 歌词行内文本的行高系数：主歌词和翻译/注音都用它。
 * 行高必须显式给：长外文行会折行，行数（1~3）决定这一行的实际高度，
 * 行高不再写死，否则开翻译后每行固定 +40dp，行距看起来就是空的。
 */
const LYRIC_LINE_HEIGHT_RATIO = 1.34
/**
 * 外文（英文/泰文等）歌词的行高比例：比中文略松一点。
 * 英文长句经常折成两行，行高太紧时上下两行会挤在一起、整块显得乱。
 */
const LYRIC_LINE_HEIGHT_RATIO_FOREIGN = 1.46
/** 作词/作曲等 credit 行：这些行通常很长，需要允许折行 */
const LYRIC_META_RXP = /^(作词|作曲|编曲|制作人|词|曲|监制|出品|OP|SP|吉他|贝斯|鼓|和声|混音|母带|录音|弦乐|制作助理|统筹|发行|策划|封面|文案)\s*[:：]/

/** 歌词行最小行高：飞牛实测 112.6px / 2.625 = 42.9dp（含翻译/注音时按内容自动变高） */
const LYRIC_LINE_H = 42.9
/**
 * 底部整块高度：10 + 信息行 44 + 14 + 进度 51 + 29 + 控制 56 + 32 = 236
 * 飞牛实测：信息行 655.6、进度 723.4、控制 803.4、底部留白 32
 * （时间行按飞牛收紧到贴近进度条后重新配平，进度条和控制区绝对位置都不变，总高仍 236）
 */
const BOTTOM_BLOCK_H = 236

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

/** 扩展行里区分「中文翻译」和「罗马音/粤拼注音」：翻译以中文为主，注音是拉丁字母 */
const CJK_CHAR_RXP = /[\u3400-\u4dbf\u4e00-\u9fff]/g
const LATIN_CHAR_RXP = /[A-Za-z\u00c0-\u024f\u0e00-\u0e7f\u0400-\u04ff]/g
const CJK_LINE_RXP = /[\u3400-\u4dbf\u4e00-\u9fff]/
const hasCjk = (text: string) => CJK_LINE_RXP.test(text)
const isTranslationExtra = (text: string) => {
  const cjk = text.match(CJK_CHAR_RXP)?.length ?? 0
  if (!cjk) return false
  const latin = text.match(LATIN_CHAR_RXP)?.length ?? 0
  return cjk / (cjk + latin) >= 0.3
}

/**
 * 整页歌词是不是以「外文」为主（英文/泰文/其它字母语言）。
 * 外文歌词走左对齐的段落式排版：折行后的短尾巴不再居中，整块看起来才整齐；
 * 中文歌词仍然保持居中，不影响原来的视觉。
 */
const isForeignLyricLines = (lines: Line[]) => {
  let total = 0
  let foreign = 0
  for (const line of lines) {
    const text = line.text.trim()
    // 空行和作词/作曲等 credit 行不参与判断（它们常常是中文）
    if (!text || LYRIC_META_RXP.test(text)) continue
    total++
    const cjk = text.match(CJK_CHAR_RXP)?.length ?? 0
    const latin = text.match(LATIN_CHAR_RXP)?.length ?? 0
    if (cjk === 0 && latin >= 3) foreign++
  }
  return total > 0 && foreign / total >= 0.6
}

/**
 * 歌词行。飞牛：当前行纯白 + 加粗 + 字号放大，其余行统一半透明白（没有距离渐隐）。
 *
 * 行高不再固定：长英文/泰文等外文行会折行（最多 3 行），外文歌词下面的中文翻译/
 * 罗马音/粤拼按实际内容高度排在正下方，开翻译后行距只多出翻译本身那一行的高度。
 * 翻译行（中文）比注音行（罗马音/粤拼）略大、更亮一点，两种扩展行一眼能区分。
 */
const LyricLine = memo(({ text, extras, active, startMs, endMs, playing, syncMs, size, wordByWord, activeColor, align = 'center', foreign = false }: {
  text: string
  /** lrc 的翻译/罗马音/粤拼等扩展行（设置开启时由 lrc parser 提供） */
  extras: string[]
  active: boolean
  startMs: number
  endMs: number
  playing: boolean
  syncMs: number
  size: number
  wordByWord: boolean
  /** 当前行高亮色：跟随主题（Material You 主色） */
  activeColor: string
  /** 横屏和歌名一样左对齐，竖屏居中；外文歌词也左对齐 */
  align?: 'center' | 'left'
  /** 外文歌词：行高更松、折行用 balanced 策略（避免出现只有一两个词的短尾巴） */
  foreign?: boolean
}) => {
  const fontScale = useFontSize()
  /** 行高必须按「实际渲染字号」算：字体设置放大后，固定行高会把字头裁掉 */
  const textLineHeight = (px: number, ratio: number) => getTextSize(u(px)) * fontScale * ratio
  /** 非当前行字号：用档位字号 / 1.14，保持原来的视觉比例不变 */
  const normalSize = size / LYRIC_NORMAL_RATIO
  /** 当前高亮行字号：比其它行再大一点点（+1.3~1.9sp，随档位变化） */
  const highlightSize = getHighlightLyricSize(size)
  /** 主歌词行高（折行时每行都按这个高度）；高亮行按高亮字号单独算，行高自适应 */
  const lineHeightRatio = foreign ? LYRIC_LINE_HEIGHT_RATIO_FOREIGN : LYRIC_LINE_HEIGHT_RATIO
  const highlightLineHeight = textLineHeight(highlightSize, lineHeightRatio)
  /** 外文折行用 balanced：两行长度更接近，不会出现「一行只剩一两个单词」的短尾巴 */
  const textBreakStrategy = foreign ? 'balanced' : 'highQuality'
  /** 翻译/注音比主歌词小一半左右，行高同样按字号算，避免行距被撑开 */
  const extraSize = Math.max(9, size * 0.5)
  const extraNodes = extras.length
    ? (
      <View style={styles.lyricExtras}>
        {extras.map((extra, i) => {
          const isTranslation = isTranslationExtra(extra)
          // 注音行比翻译行再小一点、淡一点：翻译是要读的内容，注音只是辅助
          const fontSize = isTranslation ? extraSize : extraSize * 0.92
          return (
            <Text
              key={`${i}_${extra}`}
              size={u(fontSize)}
              color={isTranslation
                ? (active ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.44)')
                : (active ? 'rgba(255,255,255,0.56)' : 'rgba(255,255,255,0.27)')}
              style={[
                styles.lyricExtra,
                { textAlign: align, lineHeight: textLineHeight(fontSize, LYRIC_LINE_HEIGHT_RATIO) },
                i > 0 ? styles.lyricExtraGap : null,
              ]}
              numberOfLines={3}
            >{extra}</Text>
          )
        })}
      </View>
      )
    : null
  if (!active) {
    return (
      <View style={[styles.lyricLineWrap, { alignItems: align === 'center' ? 'center' : 'flex-start' }]}>
        <Text
          size={u(normalSize)}
          color='rgba(255,255,255,0.38)'
          style={[styles.lyricLine, { textAlign: align, lineHeight: textLineHeight(normalSize, lineHeightRatio) }]}
          numberOfLines={3}
          textBreakStrategy={textBreakStrategy}
        >{text || ' '}</Text>
        {extraNodes}
      </View>
    )
  }
  // 关闭逐字时整行高亮
  if (!wordByWord) {
    return (
      <View style={[styles.lyricLineWrap, { alignItems: align === 'center' ? 'center' : 'flex-start' }]}>
        <Text
          size={u(highlightSize)}
          color={activeColor}
          style={{ ...styles.lyricLine, textAlign: align, ...styles.lyricActive, lineHeight: highlightLineHeight }}
          numberOfLines={3}
          textBreakStrategy={textBreakStrategy}
        >{text || ' '}</Text>
        {extraNodes}
      </View>
    )
  }
  return (
    <View style={[styles.lyricLineWrap, { alignItems: align === 'center' ? 'center' : 'flex-start' }]}>
      <KaraokeText
        text={text}
        size={highlightSize}
        activeColor={activeColor}
        align={align}
        foreign={foreign}
        startMs={startMs}
        endMs={endMs}
        playing={playing}
        syncMs={syncMs}
      />
      {extraNodes}
    </View>
  )
})

/**
 * 卡拉 OK 式逐字歌词。
 *
 * - 单行：用像素宽度裁切高亮层（高亮层宽度 = 行宽 × 当前行进度，进度由本组件自己的
 *   rAF 插值），高亮随唱推进是连续的；
 * - 折行（长英文/泰文行）：高亮层没法按像素横着裁，改成在同一段 Text 里把已唱部分
 *   用内嵌 span 染色。折行位置由整段文本决定，所以不会裁字、也不会跳行；
 * - Player 只在「换行」时 setState，不跟着 60fps 重渲染整个播放器页面；
 * - 暂停/继续用 syncMs 重新对齐，seek 后最多 1 秒内自动跟上（歌词行不变的情况）。
 */
const KaraokeText = memo(({ text, size, activeColor, align, foreign, startMs, endMs, playing, syncMs }: {
  text: string
  size: number
  activeColor: string
  align: 'center' | 'left'
  /** 外文歌词：折行用 balanced，两行长度更接近 */
  foreign: boolean
  startMs: number
  endMs: number
  playing: boolean
  syncMs: number
}) => {
  const [lineWidth, setLineWidth] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const [textHeight, setTextHeight] = useState(0)
  const [ratio, setRatio] = useState(0)
  const syncRef = useRef(syncMs)
  syncRef.current = syncMs
  const duration = Math.max(1, endMs - startMs)
  const ratioAt = useCallback((time: number) => Math.max(0, Math.min(1, (time - startMs) / duration)), [startMs, duration])

  useEffect(() => {
    if (!playing) {
      setRatio(ratioAt(syncRef.current))
      return
    }
    // 从当前播放位置起步：挂载时可能刚好在一行中间
    const elapsed = Math.max(0, Math.min(duration, syncRef.current - startMs))
    const lineStartedAt = Date.now() - elapsed
    let stopped = false
    let rafId = 0
    const tick = () => {
      if (stopped) return
      const next = Math.max(0, Math.min(1, (Date.now() - lineStartedAt) / duration))
      setRatio(next)
      if (next < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => {
      stopped = true
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [playing, startMs, duration, ratioAt])

  // 暂停时按真实进度对齐；播放中 seek 到同一行时最多等下一次进度推送（1s）修正
  useEffect(() => {
    if (!playing) setRatio(ratioAt(syncMs))
  }, [syncMs, playing, ratioAt])

  const fontScale = useFontSize()
  const lineHeight = getTextSize(u(size)) * fontScale * (foreign ? LYRIC_LINE_HEIGHT_RATIO_FOREIGN : LYRIC_LINE_HEIGHT_RATIO)
  const textBreakStrategy = foreign ? 'balanced' : 'highQuality'
  // 折行判断：显式行高下，1 行 = lineHeight，2 行 = 2×lineHeight
  const wrapped = textHeight > lineHeight * 1.5
  const progress = Math.max(0, Math.min(1, ratio))
  const overlayLeft = align === 'center' ? Math.max(0, (containerWidth - lineWidth) / 2) : 0
  const highlightStyle = { color: activeColor }
  const measureHeight = (h: number) => {
    if (h > 0 && Math.abs(h - textHeight) > 0.5) setTextHeight(h)
  }

  if (wrapped) {
    // 折行：同一段 Text 内嵌套 span 染色，折行位置和文字位置都不变，不会切字
    const visibleChars = Math.min(text.length, Math.round(progress * text.length))
    return (
      <View
        style={[styles.karaokeWrap, { alignItems: align === 'center' ? 'center' : 'flex-start' }]}
        onLayout={e => {
          const w = e.nativeEvent.layout.width
          if (w > 0 && Math.abs(w - containerWidth) > 0.5) setContainerWidth(w)
        }}
      >
        <Text
          size={u(size)}
          color='rgba(255,255,255,0.32)'
          style={[styles.lyricLine, styles.lyricActive, { textAlign: align, lineHeight }]}
          numberOfLines={3}
          textBreakStrategy={textBreakStrategy}
          onLayout={e => { measureHeight(e.nativeEvent.layout.height) }}
        >
          <RNText style={highlightStyle}>{text.slice(0, visibleChars)}</RNText>
          {text.slice(visibleChars) || null}
        </Text>
      </View>
    )
  }

  return (
    <View
      style={[styles.karaokeWrap, { alignItems: align === 'center' ? 'center' : 'flex-start' }]}
      onLayout={e => {
        const w = e.nativeEvent.layout.width
        if (w > 0 && Math.abs(w - containerWidth) > 0.5) setContainerWidth(w)
      }}
    >
      {/*
        底色层和上面按进度裁切的高亮层必须用完全相同的字体样式（含加粗），
        否则英文在「非加粗测量宽度 / 加粗渲染」之间会差几个 px：
        高亮层宽度不够，唱到最后末尾一两个字母会被裁掉（就是用户说的「显示不全」）。
      */}
      <Text
        size={u(size)}
        color='rgba(255,255,255,0.32)'
        style={[styles.lyricLine, styles.lyricActive, { textAlign: align, lineHeight }]}
        numberOfLines={3}
        textBreakStrategy={textBreakStrategy}
        onLayout={e => {
          measureHeight(e.nativeEvent.layout.height)
          const w = e.nativeEvent.layout.width
          if (w > 0 && Math.abs(w - lineWidth) > 0.5) setLineWidth(w)
        }}
      >{text || ' '}</Text>
      {lineWidth > 0
        ? (
          <View pointerEvents='none' style={[styles.karaokeOverlay, { left: overlayLeft, width: lineWidth * progress }]}>
            <Text
              size={u(size)}
              color={activeColor}
              style={[styles.lyricLine, styles.lyricActive, { width: lineWidth, textAlign: align, lineHeight }]}
              numberOfLines={1}
            >{text || ' '}</Text>
          </View>
          )
        : null}
    </View>
  )
})

/**
 * 无歌词提示：竖屏歌词页和横屏歌词区共用同一套文案与视觉。
 * - 主文案「暂无歌词」+ 次文案说明原因，不再拼接「· 点击返回」；
 * - 竖屏整块可点（点击回封面态），并单独给一行「轻触返回封面」的交互提示；
 * - 横屏不做点击（返回用左上角按钮），所以不显示交互提示。
 */
const LyricEmptyHint = memo(({ onPress }: { onPress?: () => void }) => {
  const body = (
    <View style={styles.lyricEmpty}>
      <View style={styles.lyricEmptyIcon}>
        <Icon name='comment-text-outline' size={u(24)} color='rgba(255,255,255,0.46)' />
      </View>
      <Text size={u(14)} color='rgba(255,255,255,0.62)' style={styles.lyricEmptyTitle}>暂无歌词</Text>
      <Text size={u(10.5)} color='rgba(255,255,255,0.34)' style={styles.lyricEmptyDesc}>当前歌曲没有可显示的歌词</Text>
      {onPress ? <Text size={u(10)} color='rgba(255,255,255,0.26)' style={styles.lyricEmptyAction}>轻触返回封面</Text> : null}
    </View>
  )
  return onPress
    ? <TouchableOpacity activeOpacity={0.85} style={styles.lyricEmptyTouch} onPress={onPress}>{body}</TouchableOpacity>
    : body
})

/** 在线歌曲的 interval 是 "04:13" 文本；进度兜底时转成秒 */
const parseIntervalSeconds = (interval?: string | number) => {
  if (typeof interval === 'number') return interval > 0 ? interval : 0
  const m = /^(\d+):(\d+)$/.exec(interval ?? '')
  if (!m) return 0
  return Number(m[1]) * 60 + Number(m[2])
}

export default () => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const navActiveId = useNavActiveId()
  const musicInfo = usePlayerMusicInfo()
  const [languageVersion, setLanguageVersion] = useState(0)

  // 按歌曲语言自动切换：粤语开粤拼、外语开翻译、国语关闭粤拼
  const metaLanguage = String((musicInfo as { language?: string }).language ?? '')
  const manualLanguage = useMemo(() => getLanguageOverrideSync(musicInfo.id), [musicInfo.id, languageVersion])
  // 在线歌没有 language 字段：歌词加载后用歌词判断语种
  const lyricLanguage = useMemo(() => detectLanguage(String(musicInfo.rawlrc ?? musicInfo.lrc ?? ''), `${musicInfo.name ?? ''} ${musicInfo.singer ?? ''}`), [musicInfo.id, musicInfo.lrc, musicInfo.rawlrc, musicInfo.name, musicInfo.singer])
  // 优先级：用户手动纠正 > 曲库/自动判断；曲库若只有「普通话」而歌词是粤语，以歌词为准
  const detectedLanguage = (!metaLanguage || metaLanguage === '普通话') && lyricLanguage
    ? lyricLanguage
    : metaLanguage
  const musicLanguage = manualLanguage || detectedLanguage
  useEffect(() => {
    if (!musicLanguage) return
    const cantonese = isCantonese(musicLanguage)
    const chinese = isChineseLanguage(musicLanguage)
    updateSetting({ 'player.isAutoJyutping': cantonese })
    if (!chinese) {
      // 外语：自动开启中文翻译
      updateSetting({ 'player.isShowLyricTranslation': true })
      void toggleTranslation(true)
    } else {
      // 中文/粤语只需关掉翻译设置；不要调 toggleTranslation(false)：
      // 它内部会等远程翻译请求并 seek，切歌时会拖慢起播
      updateSetting({ 'player.isShowLyricTranslation': false })
    }
  }, [musicInfo.id, musicLanguage])
  /** 歌名只显示歌名（下载文件的标签常常是「歌手 - 歌名」） */
  const songName = useMemo(() => cleanSongName(musicInfo.name, musicInfo.singer), [musicInfo.name, musicInfo.singer])
  const isPlay = useIsPlay()
  const progress = useProgress()
  const lines = useLrcSet()
  const lrcPlay = useLrcPlay()
  const { height, width } = useWindowSize()
  const playMode = (useSettingValue('player.togglePlayMethod') ?? 'listLoop') as PlayMode
  const lyricOffsetMs = useSettingValue('player.lyricOffsetMs') ?? 0

  /** 歌曲信息 / 歌曲页面 / 歌词页面 三页；和 Salt Player 一样用原生 PagerView 横滑 */
  const [mode, setMode] = useState<'info' | 'cover' | 'lyric'>('cover')
  const pagerRef = useRef<ComponentRef<typeof PagerView>>(null)
  const [currentLine, setCurrentLine] = useState(-1)
  const [seekPreview, setSeekPreview] = useState<number | null>(null)
  const [collected, setCollected] = useState(false)
  const [queueVisible, setQueueVisible] = useState(false)
  const [sleepTimerVisible, setSleepTimerVisible] = useState(false)
  const [lyricSettingsVisible, setLyricSettingsVisible] = useState(false)
  const musicAddRef = useRef<MusicAddModalType>(null)
  /** 冷启动的短时兜底：模糊图首帧出来前，先用清晰封面垫底，避免透明 */
  const [bgFallback, setBgFallback] = useState(true)
  const downloadModalRef = useRef<DownloadQualityModalType>(null)
  const autoSaveEnabled = useSettingValue('download.autoSaveWhilePlaying')
  const isWordByWord = useSettingValue('player.isWordByWordLyric')
  const isAutoJyutping = useSettingValue('player.isAutoJyutping')
  const isSingleLine = useSettingValue('player.isSingleLineLyric')
  const lyricSizeIndex = useSettingValue('player.lyricSizeIndex')
  const lyricAlignSetting = useSettingValue('player.lyricAlign')


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

  const lyricSize = LYRIC_SIZES[Math.max(0, Math.min(LYRIC_SIZES.length - 1, lyricSizeIndex ?? 1))]
  /**
   * 音源自带注音/翻译优先；没有时按设置用本地粤拼词典自动生成。
   * 行高不再写死：开翻译/注音后每行高度由「主歌词折行数 + 扩展行实际行数」撑开，
   * 只有真的有翻译/拼音的行才变高，相邻行距不会再被固定 +40dp 撑得很空。
   */
  const isCantoneseSong = /粤语|粵語|cantonese/i.test(musicLanguage)
  const handleSelectLanguage = useCallback(async(language: string) => {
    const id = musicInfo.id
    if (!id) return
    await setLanguageOverride(id, language)
    const raw = playerState.playMusicInfo.musicInfo
    if (raw && 'meta' in raw && raw.source === 'local') {
      await updateLocalMusicMeta(raw, { language: language || undefined })
    }
    setLanguageVersion(v => v + 1)
  }, [musicInfo.id])

  const lyricExtras = useMemo(() => lines.map(line => {
    if (line.extendedLyrics?.length) {
      // 音源 romalrc：粤语歌直接用作粤拼；国语歌只保留翻译（含中文的行），丢弃拼音
      const extras = isCantoneseSong
        ? line.extendedLyrics
        : line.extendedLyrics.filter(text => hasCjk(text))
      if (extras.length) return extras
    }
    if (!isAutoJyutping) return []
    const text = line.text?.trim()
    if (!text) return []
    // 只有中文行才生成粤拼：英文/泰文等外文行词典会输出占位符 […]，不能当注音行显示
    if (!hasCjk(text)) return []
    try {
      const jyutping = Jyutping.getJyutpingText(text)
        .replace(/\[…\]/g, '')
        .replace(/[0-9]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      return jyutping ? [jyutping] : []
    } catch {
      return []
    }
  }), [lines, isAutoJyutping, isCantoneseSong])

  /*
    播放器页底色永远是深色（封面糊底），所以不能直接用 c-primary：
    M3 在深色表面上用 tone 80 的 primary（浅而高彩度的柔和色），
    背景则是「带一点种子色相的中性深色」。两者都由 playerPalette 按种子色算出来，
    换主题色时整页氛围（背景染色 + 进度条 + 播放键 + 当前歌词）一起变。
  */
  const palette = useMemo(() => getPlayerPalette(theme), [theme])
  const accent = palette.accent

  /*
    横屏时播放器在左侧导航栏右边的内容区里，useWindowSize 给的是整屏宽度，
    所以真实尺寸一律用根容器 onLayout 量出来的值。
  */
  const [box, setBox] = useState({ w: width, h: height })
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout
    if (w <= 0 || h <= 0) return
    setBox(prev => (Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5) ? prev : { w, h })
  }, [])
  const boxW = box.w
  const boxH = box.h
  // 方向按窗口判断；竖屏继续用窗口尺寸（和之前完全一致，避免量出来的值有误差导致位移）
  const isLandscape = width > height * 1.2
  const layoutW = isLandscape ? boxW : width
  const layoutH = isLandscape ? boxH : height

  // ── 竖屏布局常量（全部来自飞牛 1080x2340 实测，真 dp） ──
  const coverTop = layoutH * COVER_TOP_RATIO
  const coverH = layoutH * COVER_H_RATIO
  const bottomTop = layoutH - BOTTOM_BLOCK_H
  /** 封面态：封面下方的当前歌词行区域 */
  const stripTop = coverTop + coverH
  const stripH = bottomTop - stripTop
  /** 歌词页：歌词列表区域 */
  const lyricAreaH = bottomTop - coverTop
  // 必须是稳定引用：每次渲染新建对象会让 ScrollView 重新应用样式
  const lyricContentStyle = useMemo(() => ({ paddingLeft: 20, paddingRight: 20 }), [])
  /** 横屏：歌词左对齐到歌名那条线，不再居中 */
  const landLyricContentStyle = useMemo(() => ({ paddingLeft: 0, paddingRight: 8 }), [])
  /** 歌词可视区高度：竖屏是算出来的，横屏是 flex 撑开的，统一用 onLayout 实测 */
  const [lyricH, setLyricH] = useState(0)
  const lyricPad = Math.max(0, (lyricH || lyricAreaH) / 2 - LYRIC_LINE_H / 2)
  /*
    排版规则（随整页歌词语言切换，切歌自动生效）：
    - 中文歌词：保持原来的居中排版 + 最小行高 42.9；
    - 英文/泰文等外文歌词：左对齐，折行后的短尾巴不会变成居中错位；行高更松，
      行距统一由上下 padding 控制（去掉最小行高），1 行/2 行的行与行之间间距一致。
  */
  const isForeignLyricPage = useMemo(() => isForeignLyricLines(lines), [lines])
  const lyricTextAlign = lyricAlignSetting === 'auto'
    ? (isLandscape || isForeignLyricPage ? 'left' : 'center')
    : lyricAlignSetting
  const lyricRowStyle = isForeignLyricPage ? styles.lyricRowForeign : styles.lyricRow

  /*
    下滑关闭的位移值来自 playerTransition 模块（dragY）：
    手势必须在 PagerView 外面识别，否则原生 ViewPager 会把竖向拖动抢走，
    这里只负责读它做 translateY。手势逻辑在 Vertical/PlayerGestureLayer 里。
  */
  const panY = dragY
  const modeRef = useRef(mode)
  modeRef.current = mode
  const heightRef = useRef(layoutH)
  heightRef.current = layoutH

  /*
    共享元素转场：打开/收起期间播放器自己的封面要让位给「飞行封面」。
    两处同时画会看到重影；而且飞行封面的终点和 Stage 完全重合，
    所以这里隐藏后切回来是看不出接缝的。
  */
  const [transitionPhase, setTransitionPhase] = useState(getTransitionState().phase)
  useEffect(() => subscribeTransition(() => {
    setTransitionPhase(getTransitionState().phase)
  }), [])
  /** 这次下滑有没有成功接管共享元素（没有起点记录时不接管，退回原来的整页滑动） */
  const closingRef = useRef(false)
  /** 收尾动画是否已在跑（release / terminate 可能接连触发，只能收一次） */
  const settlingRef = useRef(false)
  /** 本次拖动是否已经开始（用来在每次新手势时重置收尾锁） */
  const draggingRef = useRef(false)
  /** 本次手势是横向翻页还是纵向收起 */
  const horizontalRef = useRef(false)
  const landscapeRef = useRef(isLandscape)
  landscapeRef.current = isLandscape
  // 页面被卸载（例如点返回键直接切走）时清掉转场状态，避免飞行封面残留
  useEffect(() => () => { resetTransition() }, [])
  /*
    每次切到播放器页都把位移复位。
    只在挂载时复位不够：PagerView 会预加载相邻页，Player 可能一直没卸载，
    从设置页左滑过来时 dragY 还停在「上次关闭」的屏高位置，看到的就是黑屏。
  */
  useEffect(() => {
    if (navActiveId !== 'nav_player') return
    dragY.setValue(0)
  }, [navActiveId])

  /**
   * 整页下滑并切回原 Tab（没有共享元素可用时的关闭方式：横屏 / 起点没记到）。
   * 关掉的是「当前这次进入前的 Tab」，不是固定回首页。
   */
  const closeWithSlideDown = useCallback(() => {
    Animated.timing(panY, {
      toValue: heightRef.current + 80,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      panY.setValue(0)
      setNavActiveId(getOriginNavId() ?? 'nav_home')
    })
  }, [panY])

  /**
   * 统一的关闭入口：左上角 chevron / 返回键。
   *
   * 有共享元素时：飞行封面从播放器封面收回到本次进入的起点（同一个大圆、同一条贝塞尔），
   * 同时整页往下滑 —— 和手势关闭同一个观感；封面落位后才切回原 Tab，
   * 所以不会出现「先看到首页、封面才慢慢缩回去」的双封面/闪一下。
   */
  const handleClosePlayer = useCallback(() => {
    if (settlingRef.current) return
    if (!canPlayCloseTransition()) {
      closeWithSlideDown()
      return
    }
    settlingRef.current = true
    // 280ms < 收拢动画 300ms：切页发生在封面落位之后，底部不会露出播放器页的边
    Animated.timing(panY, {
      toValue: heightRef.current + 80,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
    closePlayerWithTransition(() => {
      // 切页前把位移补满（和手势关闭同一处理），下一帧首页就位，看不出跳动
      panY.setValue(heightRef.current + 80)
      settlingRef.current = false
    })
  }, [closeWithSlideDown, panY])

  /** 返回键：和左上角 chevron 走同一条收拢动画；弹层打开时先关弹层 */
  useBackHandler(useCallback(() => {
    if (navActiveId !== 'nav_player') return false
    if (queueVisible) {
      setQueueVisible(false)
      return true
    }
    handleClosePlayer()
    return true
  }, [handleClosePlayer, navActiveId, queueVisible]))

  const lyricScrollY = useRef(0)
  /*
    进度条所在的屏幕 y 区间。下滑手势是在 capture 阶段抢的，会盖过进度条自己的
    responder —— 拖动时手指稍微上下抖一下就被当成「下滑」抢走，表现就是「进度条拖不动」。
    这里把这块区域排除掉。
  */
  const seekZoneRef = useRef({ top: 0, bottom: 0 })
  /** 队列面板打开时，播放器不接管下滑（避免在队列里下滑把整页最小化） */
  const queueOpenRef = useRef(false)
  queueOpenRef.current = queueVisible
  seekZoneRef.current = { top: bottomTop + 6, bottom: bottomTop + 62 }

  /*
    用 capture 阶段接管：普通冒泡会被封面/歌词的触摸区域和歌词列表抢走。
    注意 PagerView 的横向滚动已经在 Main.tsx 里对播放器页关掉了，
    否则原生 ViewPager 会把竖向拖动的触摸序列整段抢走（实测只能收到 dy=4~7）。
  */
  const panResponder = useMemo(() => {
    /**
     * 松手（或手势被上层取消）时的收尾。
     * 快速滑动时系统经常直接 cancel 手势（onPanResponderTerminate），
     * 以前 terminate 只会回弹，表现就是「快速下滑没反应」；现在两种情况统一按位移判断。
     */
    const settle = (g: { dx: number, dy: number, vx: number, vy: number }) => {
      // 横向手势：翻到上一页/下一页；不参与下滑收尾
      if (horizontalRef.current) {
        horizontalRef.current = false
        draggingRef.current = false
        settlingRef.current = false
        const current = modeRef.current === 'info' ? 0 : modeRef.current === 'cover' ? 1 : 2
        const delta = g.dx < -60 || g.vx < -0.45 ? 1 : g.dx > 60 || g.vx > 0.45 ? -1 : 0
        const next = Math.max(0, Math.min(2, current + delta))
        if (next !== current) {
          pagerRef.current?.setPage(next)
          setMode(next === 0 ? 'info' : next === 1 ? 'cover' : 'lyric')
        }
        return
      }
      // release 和 terminate 可能接连触发，收尾只能做一次，否则两个动画互相打断
      if (settlingRef.current) return
      settlingRef.current = true
      draggingRef.current = false
      const shouldClose = g.dy > 70 || g.vy > 0.45
      if (shouldClose) {
        if (closingRef.current) {
          // 页面继续下滑 + 封面缩回圆盘同时跑，封面落位后再切页
          Animated.timing(panY, {
            toValue: heightRef.current + 80,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start()
          finishClose(() => {
            closingRef.current = false
            settlingRef.current = false
            /*
              切页前把位移补满：panY 的 timing(260ms) 可能比封面动画(300ms) 先结束，
              但两者独立，实际可能差几像素 —— 差这一下，屏幕底部就会露出播放器页顶部
              那一条深色背景（用户看到的就是「最底部一块封面色」）。
              页面已经基本移出屏幕，这里 setValue 看不出跳动。
            */
            // 多移 80dp：layoutH 用的是窗口高度，比页面实际高度少了底部导航条那一条，
            // 只移 heightRef 的话最底部会露出播放器页的一条边（用户看到的那块色）
            panY.setValue(heightRef.current + 80)
            setNavActiveId(getOriginNavId() ?? 'nav_home')
          })
        } else {
          closeWithSlideDown()
          settlingRef.current = false
        }
        return
      }
      Animated.spring(panY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 90,
      }).start(() => { settlingRef.current = false })
      if (closingRef.current) {
        closingRef.current = false
        cancelClose()
      }
    }

    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => {
        /*
          阈值必须很小（1 而不是 4）：慢速拖动时前几个 move 的 dy 只有 1~3，
          如果这里返回 false，下层组件会立刻抢走 responder，之后就再也不走 capture 了，
          表现就是「快速下滑能关、慢慢滑反而没反应」。
        */
        if (queueOpenRef.current) return false
        // 起点在进度条上：交给进度条自己处理（拖动跳转）
        if (g.y0 >= seekZoneRef.current.top && g.y0 <= seekZoneRef.current.bottom) return false
        const absX = Math.abs(g.dx)
        const absY = Math.abs(g.dy)
        // 横向：PagerView 已关闭原生滚动，由这里接管翻页
        if (absX > absY * 1.1) {
          if (absX <= 6) return false
          horizontalRef.current = true
          return true
        }
        horizontalRef.current = false
        // 信息页让列表自己竖向滚动，不抢下滑关闭
        if (modeRef.current === 'info') return false
        if (g.dy <= 1) return false
        // 歌词列表没回到顶部时，下滑交给列表自己滚动
        if (modeRef.current === 'lyric' && lyricScrollY.current > 2) return false
        return true
      },
      onPanResponderMove: (_, g) => {
        if (horizontalRef.current) return
        if (g.dy <= 0) return
        // 新手势开始：允许下一次收尾
        if (!draggingRef.current) {
          draggingRef.current = true
          settlingRef.current = false
        }
        panY.setValue(g.dy)
        // 竖屏且这次是从圆盘点进来的 → 封面跟着手指缩回圆盘（真正跟手，不是播一段独立动画）
        if (landscapeRef.current) return
        if (!closingRef.current) closingRef.current = beginClose()
        if (closingRef.current) setCloseProgress(1 - g.dy / heightRef.current)
      },
      onPanResponderRelease: (_, g) => { settle(g) },
      onPanResponderTerminate: (_, g) => { settle(g) },
    })
  }, [panY, closeWithSlideDown])

  /*
    歌词页时间轴：基准位置直接取 store 里的 progress.nowPlayTime（播放器每 ~500ms 推一次），
    两次推送之间用 rAF 插值。

    之前用 getPosition() 主动采样，但它在「暂停 / 本地文件刚起播」时会 reject，
    catch 里又静默忽略 —— basePos 就永远停在 0，findLine 返回 -1，
    表现是：进歌词页一行都不高亮、也不滚动（拖动一下进度条才正常）。
    改成吃 store 的进度之后，暂停、拖动、切歌都会立刻把基准顶正，不需要额外兜底。
  */
  const lrcBase = useRef({ pos: 0, at: 0 })
  useEffect(() => {
    lrcBase.current = { pos: progress.nowPlayTime, at: Date.now() }
  }, [progress.nowPlayTime])

  useEffect(() => {
    if (mode !== 'lyric' && !isLandscape) return
    let stopped = false
    let rafId = 0

    const tick = () => {
      if (stopped) return
      const base = lrcBase.current
      // 只信「基准之后经过的时间」，并且封顶 1.2s（比推送间隔略长）：从后台切回来不会跳掉整首歌
      const elapsed = Math.min(1200, Math.max(0, Date.now() - base.at)) / 1000
      // 暂停时不推进插值，避免歌词自己往前跑
      const est = playerState.isPlay ? base.pos + elapsed : base.pos
      let line = findLine(lines, est * 1000 + lyricOffsetMs)
      const prevLine = currentLineRef.current
      /*
        播放中进度基准每秒会回拨一次（rAF 估算比真实位置略早），
        跨行瞬间会出现「先到第二行、下个 tick 又回到第一行」的抖动。
        只要真实播放位置还没离开上一行，就不允许行号回退；真 seek/上一首时实际时间会早于行起点，才放行。
      */
      if (playerState.isPlay && prevLine >= 0 && line < prevLine) {
        const prevStart = lines[prevLine]?.time ?? 0
        if (playerState.progress.nowPlayTime * 1000 >= prevStart) line = prevLine
      }
      if (line !== prevLine) {
        currentLineRef.current = line
        setCurrentLine(line)
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      stopped = true
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [mode, isLandscape, lines, lyricOffsetMs])

  useEffect(() => {
    setCollected(getListMusicSync(LIST_IDS.LOVE).some(m => m.id === musicInfo.id))
  }, [musicInfo.id])

  /*
    收藏状态的外部同步。
    收藏不再只由本页按钮触发：通知栏的收藏按钮（native-notify）、收藏页、列表页都会改
    「我的收藏」列表，本页开着时不刷新的话爱心就会和实际状态对不上。
    列表事件走 global.list_event（Event.emit 内部是 setImmediate 异步派发），
    这里只过滤 LOVE 列表，触发时用 playerState.musicInfo.id 现取当前歌，
    所以订阅只在挂载时注册一次，切歌不会反复注册/泄漏。
  */
  useEffect(() => {
    const refreshCollected = () => {
      setCollected(getListMusicSync(LIST_IDS.LOVE).some(m => m.id === playerState.musicInfo.id))
    }
    // list_event 的监听签名和 emitter 方法同型（返回 Promise），参考 notification.ts 的写法
    const handleListMusicChanged = async(listId: string) => {
      if (listId === LIST_IDS.LOVE) refreshCollected()
    }
    // 清空列表的参数是 ids 数组
    const handleListMusicCleared = async(ids: string[]) => {
      if (ids.includes(LIST_IDS.LOVE)) refreshCollected()
    }
    global.list_event.on('list_music_add', handleListMusicChanged)
    global.list_event.on('list_music_remove', handleListMusicChanged)
    global.list_event.on('list_music_overwrite', handleListMusicChanged)
    global.list_event.on('list_music_clear', handleListMusicCleared)
    return () => {
      global.list_event.off('list_music_add', handleListMusicChanged)
      global.list_event.off('list_music_remove', handleListMusicChanged)
      global.list_event.off('list_music_overwrite', handleListMusicChanged)
      global.list_event.off('list_music_clear', handleListMusicCleared)
    }
  }, [])

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

  // 进度兜底：核心 1s 轮询在部分起播/恢复场景会没启动，页面自己补拉，
  // 避免在线歌曲偶发「没有时间、进度条不动」。
  const seekPreviewRef = useRef<number | null>(seekPreview)
  useEffect(() => { seekPreviewRef.current = seekPreview }, [seekPreview])
  useEffect(() => {
    if (!musicInfo.id) return
    let alive = true
    let busy = false
    const fallbackMax = parseIntervalSeconds((musicInfo as { interval?: string | number }).interval)
    const tick = () => {
      if (!alive || busy) return
      busy = true
      void Promise.all([getPosition(), getDuration()]).then(([pos, dur]) => {
        if (!alive) return
        if (Number.isFinite(pos) && seekPreviewRef.current == null && Math.abs(pos - playerState.progress.nowPlayTime) > 0.7) {
          setNowPlayTime(pos)
        }
        if (Number.isFinite(dur) && dur > 0) {
          if (Math.abs(dur - playerState.progress.maxPlayTime) > 0.5) setMaxplayTime(dur)
        } else if (fallbackMax > 0 && playerState.progress.maxPlayTime <= 0) {
          setMaxplayTime(fallbackMax)
        }
      }).catch(() => {}).finally(() => { busy = false })
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [musicInfo.id])

  /** 三页顺序：歌曲信息(0) / 歌曲页面(1) / 歌词页面(2) */
  const goPage = useCallback((index: 0 | 1 | 2) => {
    pagerRef.current?.setPage(index)
  }, [])

  const handleToggleMode = useCallback(() => {
    goPage(mode === 'cover' ? 2 : 1)
  }, [goPage, mode])

  const handleSeek = useCallback((time: number) => {
    setSeekPreview(null)
    setNowPlayTime(time)
    lrcBase.current = { pos: time, at: Date.now() }
    const line = findLine(lines, time * 1000)
    currentLineRef.current = line
    setCurrentLine(line)
    void setCurrentTime(time)
  }, [lines])

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

  /** 播放器当前歌：添加至歌单 */
  const handleAddToPlaylist = useCallback(() => {
    const raw = playerState.musicInfo
    if (!raw) return
    // 播放器里的 MusicInfo 是精简结构；加入歌单后收藏页会按本地曲目读取 meta，
    // 这里优先换成曲库里的完整条目，避免收藏-歌单页报错。
    const full = getLocalMusicListSync()?.find(item => item.id === raw.id)
    musicAddRef.current?.show({ musicInfo: (full ?? raw) as unknown as LX.Music.MusicInfo, listId: '', isMove: false })
  }, [])

  const handleCycleMode = useCallback(() => {
    const index = PLAY_MODES.indexOf(playMode)
    const next = PLAY_MODES[(index + 1) % PLAY_MODES.length]
    updateSetting({ 'player.togglePlayMethod': next })
    toast(MODE_LABEL[next])
  }, [playMode])

  /** 点击队列里的歌曲直接切歌播放 */
  const handlePlayFromQueue = useCallback((index: number) => {
    const listId = playerState.playInfo.playerListId
    if (!listId) return
    setQueueVisible(false)
    void playList(listId, index)
  }, [])

  /**
   * 横屏封面流队列里点封面：直接播这首，但**不关队列**。
   * 竖屏底部队列仍然用上面那个（点了就收起来），两边的交互预期不一样，
   * 所以这里单独分一个 handler —— 以前共用同一个，横屏点一下队列就直接没了。
   */
  const handlePlayFromLandscapeQueue = useCallback((index: number) => {
    const listId = playerState.playInfo.playerListId
    if (!listId) return
    void playList(listId, index)
  }, [])

  /** 关闭播放队列（给横屏覆盖层一个稳定引用：它的返回键监听依赖这个回调） */
  const handleCloseQueue = useCallback(() => { setQueueVisible(false) }, [])

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
    // 依赖只是用来在切歌时触发重算（数据实际读自 playerState），静态分析看不出，别删
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicInfo.id, musicInfo.pic])

  const detailRows = useMemo(() => {
    const raw = playerState.playMusicInfo.musicInfo
    const rows: Array<{ label: string, value: string }> = []
    rows.push({ label: '歌名', value: songName || '-' })
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
    // 同上：musicInfo.id 只是切歌信号
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicInfo.id, songName, musicInfo.singer, musicInfo.album, maxTime])

  const queue = useMemo(() => {
    /*
      横屏覆盖层关闭时会先淡出一小段再卸载（把状态栏恢复后的重排藏在覆盖层后面），
      那段时间还需要继续渲染这份列表，所以这里不随 visible 清空 —— 只在开关时刷新一次。
    */
    return getListMusicSync(playerState.playInfo.playerListId)
    // 只在打开/关闭时取一次快照（列表变化不影响已打开的队列，和原来的行为一致）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueVisible])

  const scrollRef = useRef<ScrollView>(null)
  /** 每行实际布局（y / 高度）：行高按内容变高（折行、翻译/注音），滚动要按实测位置居中 */
  const rowLayouts = useRef<Array<{ y: number, h: number } | undefined>>([])
  const lyricViewHRef = useRef(lyricH || lyricAreaH)
  lyricViewHRef.current = lyricH || lyricAreaH
  const lyricPadRef = useRef(lyricPad)
  lyricPadRef.current = lyricPad
  const currentLineRef = useRef(currentLine)
  currentLineRef.current = currentLine
  /** 行高变化（变高亮行 / 翻译开关）后，如果变的是当前行就重新居中 */
  const handleRowLayout = useCallback((index: number, e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout
    const prev = rowLayouts.current[index]
    if (prev && Math.abs(prev.y - y) < 0.5 && Math.abs(prev.h - height) < 0.5) return
    rowLayouts.current[index] = { y, h: height }
    if (index !== currentLineRef.current) return
    const viewH = lyricViewHRef.current
    if (viewH <= 0) return
    scrollRef.current?.scrollTo({ y: Math.max(0, y + height / 2 - viewH / 2), animated: false })
  }, [])

  const scrollToLine = useCallback((index: number, animated: boolean) => {
    if (index < 0) return
    const viewH = lyricViewHRef.current
    const layout = rowLayouts.current[index]
    // 还没量到实际布局时按最小行高估：量到之后 onContentSizeChange / onLayout 会再校正一次
    const y = layout
      ? layout.y + layout.h / 2 - viewH / 2
      : lyricPadRef.current + index * LYRIC_LINE_H + LYRIC_LINE_H / 2 - viewH / 2
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated })
  }, [])

  /** 上一次高亮的行，用来判断「跳太远」 */
  const prevLineRef = useRef(-1)
  // 换歌后行数据整个换掉，重置基准
  useEffect(() => {
    prevLineRef.current = -1
    currentLineRef.current = -1
    rowLayouts.current = []
    setCurrentLine(-1)
  }, [lines])

  useEffect(() => {
    if (mode !== 'lyric' && !isLandscape) return
    // 跳太远（切歌、拖动进度）时直接定位，不要从上一首的位置一路滚过去
    const far = prevLineRef.current < 0 || Math.abs(currentLine - prevLineRef.current) > 5
    scrollToLine(currentLine, !far)
    prevLineRef.current = currentLine
  }, [currentLine, mode, isLandscape, scrollToLine, lines])


  const pic = musicInfo.pic
  useEffect(() => {
    // 冷启动时先把封面读进原生图片缓存，减少第一次进歌词页的空窗
    if (pic) Image.prefetch(pic).catch(() => {})
    setBgFallback(true)
    const timer = setTimeout(() => { setBgFallback(false) }, 700)
    return () => { clearTimeout(timer) }
  }, [pic])
  /*
    当前播放的是本地音乐（文件已经在手机上）。这种情况不显示下载按钮：
    本地文件没有「下载」这回事，留一个点了只弹 toast 的图标是噪音。
    下载完成的曲目（ListItem，带 progress 字段）不算本地音乐，图标照旧（点了会提示已下载）。
  */
  const rawMusic = playerState.playMusicInfo.musicInfo
  const isLocalMusic = rawMusic != null && !('progress' in rawMusic) && rawMusic.source === 'local'

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

  /** 歌词行（横竖屏共用；横屏下点击不切模式）。行高按内容自适应（折行/翻译/注音都会变高） */
  const lyricRowNodes = lines.map((line, index) => (
    <TouchableOpacity
      key={`${index}_${line.time}`}
      activeOpacity={0.85}
      style={lyricRowStyle}
      onLayout={e => { handleRowLayout(index, e) }}
      onPress={isLandscape ? undefined : handleToggleMode}
    >
      <LyricLine
        text={line.text}
        extras={lyricExtras[index] ?? []}
        size={lyricSize}
        active={index === currentLine}
        startMs={line.time}
        endMs={lines[index + 1]?.time ?? (maxTime * 1000 || line.time + 4000)}
        playing={isPlay}
        syncMs={progress.nowPlayTime * 1000 + lyricOffsetMs}
        wordByWord={isWordByWord && !LYRIC_META_RXP.test(line.text.trim())}
        activeColor={accent}
        align={lyricTextAlign}
        foreign={isForeignLyricPage}
      />
    </TouchableOpacity>
  ))

  /** 队列面板的下滑关闭：只挂在顶部拖拽条上，不影响列表滚动 */
  const queuePan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderRelease: (_, g) => {
      if (g.dy > 60) setQueueVisible(false)
    },
  }), [])

  /** 队列 / 详情 / 下载音质 三个弹层，横竖屏共用 */
  const modals = (
    <>
  {
    isLandscape
      ? (
        /* 横屏队列是**页面内全屏覆盖层**（不是 Modal）：必须作为根 View 的最后一个子节点渲染，
           才能盖住播放器自己的封面/控制键；状态栏因此也是 Activity 级隐藏，真机能真正全屏 */
        <QueueCoverFlow
          visible={queueVisible}
          queue={queue}
          currentId={musicInfo.id ?? undefined}
          listId={playerState.playInfo.playerListId ?? undefined}
          playing={isPlay}
          onClose={handleCloseQueue}
          onPlay={handlePlayFromLandscapeQueue}
          onToggle={togglePlay}
        />
        )
      : (
  <Modal visible={queueVisible} transparent animationType='slide' onRequestClose={() => { setQueueVisible(false) }}>
    <TouchableOpacity style={styles.modalMask} activeOpacity={1} onPress={() => { setQueueVisible(false) }}>
      <View style={{ ...styles.queueSheet, backgroundColor: theme['c-content-background'], borderColor: theme['c-primary-alpha-700'] }}>
        <View {...queuePan.panHandlers} style={styles.queueHandleWrap}>
          <View style={{ ...styles.queueHandle, backgroundColor: theme['c-350'] }} />
        </View>
        <View style={styles.queueHead}>
          <View style={styles.queueTitleWrap}>
            <Text size={17} style={styles.queueTitle}>待播列表</Text>
            <Text size={11} color={theme['c-450']}>{queue.length} 首</Text>
          </View>
          <CapsuleIconButton icon='close' label='关闭待播列表' onPress={handleCloseQueue} />
        </View>
        <View style={styles.queueTools}>
          <CapsuleButton
            icon={MODE_ICON[playMode]}
            label={MODE_LABEL[playMode]}
            primary={false}
            onPress={() => {
              const next = PLAY_MODES[(PLAY_MODES.indexOf(playMode) + 1) % PLAY_MODES.length]
              updateSetting({ 'player.togglePlayMethod': next })
            }}
          />
          <View style={{ flex: 1 }} />
          <CapsuleButton
            icon='delete-outline'
            label='清空'
            primary={false}
            onPress={() => {
              if (!queue.length) return
              void removeListMusics(playerState.playInfo.playerListId ?? '', queue.map(item => item.id))
            }}
          />
        </View>
        <ScrollView style={styles.queueList} showsVerticalScrollIndicator={false}>
          {
            queue.map((item, index) => {
              const active = item.id === musicInfo.id
              return (
                <TouchableOpacity
                  key={`${item.id}_${index}`}
                  style={styles.queueRow}
                  activeOpacity={0.65}
                  onPress={() => { handlePlayFromQueue(index) }}
                >
                  <PicImage musicInfo={item} listId={playerState.playInfo.playerListId} style={styles.queueCover} />
                  <View style={styles.queueInfo}>
                    <Text size={14} color={active ? theme['c-primary'] : theme['c-font']} numberOfLines={1}>{cleanSongName(item.name, item.singer)}</Text>
                    <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.queueSinger}>{item.singer || '未知歌手'}</Text>
                  </View>
                  {active ? <Icon name='volume-high' size={u(16)} color={theme['c-primary']} style={styles.queueActiveIcon} /> : null}
                  <TouchableOpacity
                    style={styles.queueRemove}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => { void removeListMusics(playerState.playInfo.playerListId ?? '', [item.id]) }}
                  >
                    <Icon name='close' size={u(16)} color={theme['c-350']} />
                  </TouchableOpacity>
                  <View pointerEvents='none' style={[styles.queueDivider, { backgroundColor: theme['c-primary-alpha-700'] }]} />
                </TouchableOpacity>
              )
            })
          }
        </ScrollView>
      </View>
    </TouchableOpacity>
  </Modal>
        )
  }

  <DownloadQualityModal ref={downloadModalRef} />

  <SleepTimerSheet visible={sleepTimerVisible} onClose={() => { setSleepTimerVisible(false) }} />

  <ListMusicAdd ref={musicAddRef} />

  <LyricQuickMenu
    visible={lyricSettingsVisible}
    landscape={isLandscape}
    hasTranslation={lyricExtras.some(extras => extras.length > 0)}
    language={manualLanguage || ''}
    onSelectLanguage={language => { void handleSelectLanguage(language) }}
    onClose={() => { setLyricSettingsVisible(false) }}
  />

    </>
  )

  /*
    横屏：照飞牛的横版来 —— 封面满出血占左半屏（一直顶到屏幕左上下的边缘，
    没有卡片边框、没有留白），右半屏是 歌名/歌手 + 歌词 + 进度 + 控制键。
    之前封面是居中的圆角卡片，左边还留着一条导航栏的白底，所以整体看着是错位的。
  */
  if (isLandscape) {
    // 横屏 statusbarHeight 会报 0，但时钟照样浮在左上角
    const topInset = statusBarHeight > 0 ? statusBarHeight : 20
    /*
      封面宽度直接取容器高度：封面本身是正方形，取 boxH 就能既不裁切、
      又正好铺满左侧（约 46% 屏宽）。之前用 boxW*0.48 兜底，旋转时 boxW 拿到
      中间值会让封面窄一圈，看起来就是「错位」。
    */
    // 用窗口高（横屏时就是屏高）而不是 onLayout 的 boxH：旋转过程中 boxH 可能还是旧值，
    // 封面会窄一圈、右缘柔化带的位置也跟着错
    const coverW = Math.min(height, width * 0.52)
    return (
      <Animated.View
        style={{ ...styles.container, backgroundColor: palette.scrim, transform: [{ translateY: panY }] }}
        {...panResponder.panHandlers}
        onLayout={handleLayout}
      >
        {/*
          下滑关闭时整页会跟着手指往下走，让出来的上方区域原本是页面白底（浅色主题下就是白屏）。
          这块深色垫片和内容一起移动，把让出来的区域涂成播放器底色，滑下去就是「沉进黑里」，
          不会闪白。
        */}
        <View pointerEvents='none' style={[styles.slideBackdrop, transitionPhase !== 'idle' ? styles.fadeOut : null]} />
        {navActiveId === 'nav_player' ? (
          <RNStatusBar barStyle='light-content' backgroundColor='rgba(0,0,0,0)' translucent />
        ) : null}

        <View pointerEvents='none' style={styles.bgBlur}>
          {
            pic
              ? <RNImage source={{ uri: pic }} blurRadius={50} style={styles.bgImg} resizeMode='cover' />
              : <View style={[styles.bgImg, { backgroundColor: '#17141C' }]} />
          }
        </View>
        <View pointerEvents='none' style={[styles.bgDim, { backgroundColor: palette.dim }]} />
        <LinearGradient
          pointerEvents='none'
          colors={[palette.scrimAt(0.42), palette.scrimAt(0.30), palette.scrimAt(0.64)]}
          locations={[0, 0.5, 1]}
          style={styles.tintFull}
        />

        {/* ── 左半屏：封面满出血，右缘柔化进背景 ── */}
        {
          pic
            ? (
              <View pointerEvents='none' style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: coverW, overflow: 'hidden' }}>
                <RNImage source={{ uri: pic }} resizeMode='cover' style={{ width: coverW, height: '100%' }} />
                {/*
                  右边缘：清晰 → 糊，接缝不硬。
                  里面的图必须往左偏 (coverW - 带宽)，才能显示「同一位置」的右边缘；
                  不偏移的话会显示成图片的左边，看起来就是一条和封面内容对不上的重影（错位）。
                */}
                <FadeMask
                  width={Math.min(96, coverW * 0.24)}
                  height={boxH}
                  from={1}
                  to={0}
                  dir='h'
                  style={{ right: 0, top: 0 }}
                >
                  <RNImage
                    source={{ uri: pic }}
                    resizeMode='cover'
                    style={{ position: 'absolute', top: 0, left: -(coverW - Math.min(96, coverW * 0.24)), width: coverW, height: '100%' }}
                  />
                </FadeMask>
                {/* 上下边缘轻微压暗，保证状态栏和控制区可读 */}
                <LinearGradient
                  colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)']}
                  locations={[0, 0.22, 1]}
                  style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '40%' }}
                />
              </View>
              )
            : null
        }

        <View style={{ flex: 1, flexDirection: 'row' }}>
          {/* 占位：把右侧内容推到封面右边 */}
          <View style={{ width: coverW }} />
          <View style={{ flex: 1, paddingLeft: 20, paddingRight: 20, paddingBottom: 10, paddingTop: topInset }}>
            <View style={styles.landTopRow}>
              <View style={{ flexGrow: 1, flexShrink: 1 }}>
                <MarqueeText
                  text={songName || '未在播放'}
                  size={u(18)}
                  color='#FFFFFF'
                  style={styles.songName}
                />
                <Text size={u(11)} color={palette.textSecondary} numberOfLines={1} style={styles.songSinger}>{musicInfo.singer}</Text>
              </View>
              {
                // 本地音乐没有下载这回事，整颗按钮不渲染（不占位，收藏/详情往左收）
                autoSaveEnabled || isLocalMusic
                  ? null
                  : (
                    <TouchableOpacity style={styles.iconBtnLand} onPress={handleDownload} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Icon name='download-2' size={u(19)} color='rgba(255,255,255,0.92)' />
                    </TouchableOpacity>
                    )
              }
              <TouchableOpacity style={styles.iconBtnLand} onPress={() => { setLyricSettingsVisible(true) }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityRole='button' accessibilityLabel='歌词设置'>
                <Icon name='tune' size={u(19)} color='rgba(255,255,255,0.92)' />
              </TouchableOpacity>
              <SleepTimerButton
                onPress={() => { setSleepTimerVisible(true) }}
                size={u(20)}
                activeColor={accent}
                style={styles.iconBtnLand}
              />
              <TouchableOpacity style={styles.iconBtnLand} onPress={handleToggleCollect} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Icon name={collected ? 'love' : 'heart-outline'} size={u(22)} color={collected ? accent : 'rgba(255,255,255,0.92)'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtnLand} onPress={handleAddToPlaylist} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityRole='button' accessibilityLabel='添加至歌单'>
                <AddPlaylistIcon size={u(26)} color='rgba(255,255,255,0.92)' />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1, marginTop: 2 }} onLayout={e => { setLyricH(e.nativeEvent.layout.height) }}>
              {
                lines.length
                  ? (
                    <ScrollView
                      ref={scrollRef}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={landLyricContentStyle}
                      scrollEventThrottle={32}
                      onScroll={e => { lyricScrollY.current = e.nativeEvent.contentOffset.y }}
                      onContentSizeChange={() => { scrollToLine(currentLineRef.current, false) }}
                    >
                      <View style={{ height: lyricPad }} />
                      {lyricRowNodes}
                      <View style={{ height: lyricPad }} />
                    </ScrollView>
                    )
                  : <LyricEmptyHint />
              }
            </View>

            <View style={styles.landSeek}>
              <SeekBar
                value={currentTime}
                max={maxTime}
                height={5}
                fillColor={accent}
                trackColor={palette.track}
                hitSlopY={10}
                onSeek={handleSeek}
                onPreview={setSeekPreview}
              />
              <View style={styles.landTimeRow}>
                <Text size={u(10)} color={palette.textSecondary} style={styles.timeText}>{formatTime(currentTime)}</Text>
                {
                  audioMeta
                    ? <Text size={u(10)} color={palette.textTertiary} numberOfLines={1} style={styles.timeCenter}>{audioMeta}</Text>
                    : <View style={styles.timeCenter} />
                }
                <Text size={u(10)} color={palette.textSecondary} style={styles.timeTextRight}>{formatTime(maxTime)}</Text>
              </View>
            </View>

            <View style={styles.landControls}>
              <TouchableOpacity style={styles.ctrlBtn} onPress={handleCycleMode} activeOpacity={0.6} accessibilityRole='button' accessibilityLabel='切换播放模式'>
                <Icon name={MODE_ICON[playMode]} size={u(19)} color='rgba(255,255,255,0.9)' />
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtn} onPress={() => { void playPrev() }} activeOpacity={0.6} accessibilityRole='button' accessibilityLabel='上一首'>
                <Icon name='prevMusic' size={u(30)} color={accent} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ctrlBtn}
                accessibilityRole='button'
                accessibilityLabel={isPlay ? '暂停' : '播放'}
                onPress={togglePlay}
                activeOpacity={0.75}
                onPressIn={() => { pressPlay(0.9) }}
                onPressOut={() => { pressPlay(1) }}
              >
                <Animated.View style={[styles.playCircleSmall, { backgroundColor: accent, transform: [{ scale: playBtnScale }] }]}>
                  <PlayGlyph playing={isPlay} box={18} color={palette.onAccent} />
                </Animated.View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtn} onPress={() => { void playNext() }} activeOpacity={0.6} accessibilityRole='button' accessibilityLabel='下一首'>
                <Icon name='nextMusic' size={u(30)} color={accent} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtn} onPress={() => { setQueueVisible(true) }} activeOpacity={0.6} accessibilityRole='button' accessibilityLabel='播放队列'>
                <Icon name='playlist-music' size={u(20)} color='rgba(255,255,255,0.9)' />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 横屏下这个按钮压在封面左上角，给一层暗色圆底才不会被封面吃掉 */}
        <TouchableOpacity
          style={[styles.landBack, { top: topInset + 6 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole='button'
          accessibilityLabel='收起播放器'
          onPress={handleClosePlayer}
        >
          <Icon name='chevron-down' size={u(22)} color='rgba(255,255,255,0.94)' />
        </TouchableOpacity>

        {modals}
      </Animated.View>
    )
  }

  return (
    <Animated.View
      style={{ ...styles.container, backgroundColor: palette.scrim, transform: [{ translateY: panY }] }}
      {...panResponder.panHandlers}
      onLayout={handleLayout}
    >
      {/* 下滑关闭时把让出来的区域也涂成播放器底色，避免露出页面白底（浅色主题下就是白屏） */}
      <View pointerEvents='none' style={[styles.slideBackdrop, transitionPhase !== 'idle' ? styles.fadeOut : null]} />
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
        {/*
          只挂一张模糊底图（blurRadius 固定 40），切歌词页不再换图/换模糊半径：
          之前 34↔55 两套图会让 Android 在第一次切歌词页时重新解码，
          出现一帧「背景透明」；现在歌词页只通过叠加层加深，底图始终已就绪。
        */}
        {/*
          双层背景，保证任何一帧都不会「透明」：
          1) 底层常驻一张低透明度清晰封面：模糊图还没解码/绘制出来时，它先兜底；
          2) 上层模糊封面：加载完成后负责磨砂质感。
          歌词页固定隐藏 Stage（清晰大封面），不会再出现「第一次透明、第二次正常」。
        */}
        {
          pic
            ? (
              <>
                <RNImage
                  source={{ uri: pic }}
                  style={[styles.bgImg, { opacity: bgFallback ? 0.35 : 0 }]}
                  resizeMode='cover'
                  fadeDuration={0}
                />
                <RNImage
                  key={pic}
                  source={{ uri: pic }}
                  blurRadius={40}
                  style={styles.bgImg}
                  resizeMode='cover'
                  fadeDuration={0}
                />
              </>
              )
            : <View style={[styles.bgImg, { backgroundColor: palette.scrim }]} />
        }
      </View>
      {/* 压暗：歌词页用更透的遮罩，让封面半透明地透出来（黑主题也能看到底图） */}
      <View pointerEvents='none' style={[styles.bgDim, { backgroundColor: mode !== 'cover' ? palette.dimLyric : palette.dim }]} />

      {/* 舞台：上倒影 + 封面（四边柔化）+ 下倒影，全部铺到屏幕边缘 */}
      <Animated.View pointerEvents='none' style={[styles.stage, { opacity: coverAnim }]}>
        <Stage
          pic={pic ?? undefined}
          name={songName}
          width={layoutW}
          height={layoutH}
          hidden={transitionPhase !== 'idle'}
        />
      </Animated.View>

      {/*
        歌词页磨砂：直接对「已经显示出来的封面 Stage」做全屏原生模糊（BlurView），
        不依赖另一张模糊图是否解码完成 —— 冷启动首帧也一定有一层磨砂封面，
        不会出现透明/纯黑背景。歌词文字在该层之上，保持清晰。
      */}
      {
        mode !== 'cover' && transitionPhase === 'idle'
          ? (
            <View pointerEvents='none' style={StyleSheet.absoluteFill}>
              <Glass blurRadius={25} tint='rgba(8,6,12,0.30)' />
            </View>
            )
          : null
      }
      {/* 转场期间不跑实时 Glass 快照，用静态遮罩顶替，避免每帧重抓窗口导致掉帧 */}
      {
        mode !== 'cover' && transitionPhase !== 'idle'
          ? <View pointerEvents='none' style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,6,12,0.30)' }]} />
          : null
      }

      {/*
        倒影是叠在糊底上的，只压糊底染不到它 —— 所以染色层必须放在 Stage 之上。
        两段渐变严格贴在「封面之外」的区域，封面本身一点都不会被染。
      */}
      {
        mode === 'cover'
          ? (
            <>
              <LinearGradient
                pointerEvents='none'
                colors={[palette.scrimAt(0.50), palette.scrimAt(0.05)]}
                style={[styles.tint, { top: 0, height: coverTop }]}
              />
              <LinearGradient
                pointerEvents='none'
                colors={[palette.scrimAt(0.06), palette.scrimAt(0.68)]}
                style={[styles.tint, { top: coverTop + coverH, bottom: 0 }]}
              />
            </>
            )
          : (
            <LinearGradient
              pointerEvents='none'
              colors={[palette.scrimAt(0.30), palette.scrimAt(0.16), palette.scrimAt(0.55)]}
              locations={[0, 0.45, 1]}
              style={styles.tintFull}
            />
            )
      }

      {/* 顶栏：返回键 + （歌词页）居中的歌名/歌手 */}
      {/* 顶栏：封面页显示下箭头；歌词页居中标题；歌曲信息页无按钮（和 Salt Player 三页一致） */}
      <View style={[styles.header, { top: statusBarHeight + 8 }]} pointerEvents='box-none'>
        {
          mode === 'cover'
            ? (
              <TouchableOpacity
                style={styles.backBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole='button'
                accessibilityLabel='收起播放器'
                onPress={handleClosePlayer}
              >
                <Icon name='chevron-down' size={u(26)} color='rgba(255,255,255,0.94)' />
              </TouchableOpacity>
              )
            : null
        }
        {
          mode === 'lyric'
            ? (
              <View pointerEvents='none' style={styles.headerTitle}>
                <MarqueeText text={songName || '未在播放'} size={u(15)} color='rgba(255,255,255,0.96)' style={styles.headerName} align='center' />
                <Text size={u(11)} color='rgba(255,255,255,0.62)' numberOfLines={1} style={styles.headerSinger}>{musicInfo.singer}</Text>
              </View>
              )
            : null
        }
      </View>

      {/* 三页原生横滑：歌曲信息 / 歌曲页面 / 歌词页面（Salt Player 同款操作与动画） */}
      <PagerView
        ref={pagerRef}
        style={{ position: 'absolute', left: 0, right: 0, top: coverTop, height: bottomTop - coverTop }}
        initialPage={1}
        scrollEnabled={!isLandscape}
        onPageSelected={e => {
          const pos = e.nativeEvent.position
          setMode(pos === 0 ? 'info' : pos === 1 ? 'cover' : 'lyric')
        }}
      >
        {/* 0: 歌曲信息页（背景与歌词页相同的磨砂封面） */}
        <View key='info' style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: statusBarHeight + 64, paddingLeft: 24, paddingRight: 24, paddingBottom: 260 }}
          >
            <Text size={u(20)} color='rgba(255,255,255,0.96)' style={styles.infoHeading}>歌曲信息</Text>
            {detailRows.map(row => (
              <View key={row.label} style={styles.infoPanelRow}>
                <Text size={u(11)} color='rgba(255,255,255,0.5)' style={styles.infoPanelLabel}>{row.label}</Text>
                <Text size={u(13)} color='rgba(255,255,255,0.92)' selectable numberOfLines={5} style={styles.infoPanelValue}>{row.value}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* 1: 歌曲页面（保持原有封面页：点击封面仍可切到歌词页） */}
        <View key='cover' style={{ flex: 1 }}>
          <View pointerEvents='none' style={[styles.lyricStrip, { top: stripTop - coverTop, height: stripH }]}>
            <Text size={u(16)} color='rgba(255,255,255,0.95)' numberOfLines={1} style={styles.nowLyric}>
              {lrcPlay.text || ' '}
            </Text>
          </View>
        </View>

        {/* 2: 歌词页面（右滑回歌曲页面由 PagerView 原生处理） */}
        <View key='lyric' style={{ flex: 1 }} onLayout={e => { setLyricH(e.nativeEvent.layout.height) }}>
          {
            lines.length
              ? (
                  isSingleLine
                    ? (
                    <TouchableOpacity activeOpacity={0.9} style={styles.singleLineArea} onPress={() => { goPage(1) }}>
                      <LyricLine
                        text={currentLine >= 0 ? lines[currentLine].text : ''}
                        extras={currentLine >= 0 ? (lyricExtras[currentLine] ?? []) : []}
                        size={lyricSize + 4}
                        active={currentLine >= 0}
                        startMs={currentLine >= 0 ? lines[currentLine].time : 0}
                        endMs={currentLine >= 0 ? (lines[currentLine + 1]?.time ?? (maxTime * 1000 || lines[currentLine].time + 4000)) : 4000}
                        playing={isPlay}
                        syncMs={progress.nowPlayTime * 1000 + lyricOffsetMs}
                        wordByWord={isWordByWord && !(currentLine >= 0 && LYRIC_META_RXP.test(lines[currentLine].text.trim()))}
                        activeColor={accent}
                        align={lyricTextAlign}
                        foreign={isForeignLyricPage}
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
                      <View style={{ height: lyricPad }} />
                      {lyricRowNodes}
                      <View style={{ height: lyricPad }} />
                    </ScrollView>
                      )
                )
              : <LyricEmptyHint onPress={() => { goPage(1) }} />
          }
        </View>
      </PagerView>

      {/*
        封面页手势覆盖层：PagerView 的原生 ViewPager 会吃掉页内竖向拖动，
        导致按住封面下滑关闭没反应。这里在封面页区域盖一层只做手势的透明层：
        竖向下滑交给关闭逻辑，横向仍由同一套 PanResponder 翻页。
      */}
      {mode === 'cover'
        ? (
          <View
            style={{ position: 'absolute', left: 0, right: 0, top: coverTop, height: bottomTop - coverTop, zIndex: 20 }}
            {...panResponder.panHandlers}
          />
          )
        : null}

      {/* 底部整块：信息行/工具行 + 进度 + 五个主控键（尺寸全部按飞牛实测） */}
      <View style={[styles.bottomBlock, { top: bottomTop }]}>
        {
          mode === 'cover'
            ? (
              <View style={styles.infoRow}>
                <TouchableOpacity style={styles.titleText} activeOpacity={0.75} onPress={handleToggleMode}>
                  <MarqueeText
                    text={songName || '未在播放'}
                    size={u(18)}
                    color='#FFFFFF'
                    style={styles.songName}
                  />
                  <Text size={u(12)} color={palette.textSecondary} numberOfLines={1} style={styles.songSinger}>{musicInfo.singer}</Text>
                </TouchableOpacity>
                <View style={styles.infoActions}>
                  {
                    // 本地音乐不显示下载按钮（不留空占位）
                    autoSaveEnabled || isLocalMusic
                      ? null
                      : (
                        <TouchableOpacity style={styles.iconBtn} onPress={handleDownload} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Icon name='download-2' size={u(21)} color='rgba(255,255,255,0.92)' />
                        </TouchableOpacity>
                        )
                  }
                  <SleepTimerButton
                    onPress={() => { setSleepTimerVisible(true) }}
                    size={u(22)}
                    activeColor={accent}
                    style={styles.iconBtn}
                  />
                  <TouchableOpacity style={styles.iconBtn} onPress={handleToggleCollect} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Icon
                      name={collected ? 'love' : 'heart-outline'}
                      size={u(26)}
                      color={collected ? accent : 'rgba(255,255,255,0.92)'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={handleAddToPlaylist} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityRole='button' accessibilityLabel='添加至歌单'>
                    <AddPlaylistIcon size={u(30)} color='rgba(255,255,255,0.92)' />
                  </TouchableOpacity>
                </View>
              </View>
              )
            : (
              <View style={styles.toolRow}>
                <View style={styles.toolLeft}>
                  {/* 所有歌词开关收敛到一个入口（字号/对齐/逐字/单行/翻译/音译/粤拼/简繁） */}
                  <TouchableOpacity
                    style={styles.toolBtn}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityRole='button'
                    accessibilityLabel='歌词设置'
                    onPress={() => { setLyricSettingsVisible(true) }}
                  >
                    <Icon name='tune' size={u(21)} color='rgba(255,255,255,0.88)' />
                  </TouchableOpacity>
                </View>
                <View style={styles.infoActions}>
                  <SleepTimerButton
                    onPress={() => { setSleepTimerVisible(true) }}
                    size={u(22)}
                    activeColor={accent}
                    style={styles.iconBtn}
                  />
                  <TouchableOpacity style={styles.iconBtn} onPress={handleToggleCollect} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Icon name={collected ? 'love' : 'heart-outline'} size={u(26)} color={collected ? accent : 'rgba(255,255,255,0.9)'} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={handleAddToPlaylist} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityRole='button' accessibilityLabel='添加至歌单'>
                    <AddPlaylistIcon size={u(30)} color='rgba(255,255,255,0.9)' />
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
              fillColor={accent}
              trackColor={palette.track}
              onSeek={handleSeek}
              onPreview={setSeekPreview}
              onZone={(top, bottom) => { seekZoneRef.current = { top, bottom } }}
            />
          </View>
          <View style={styles.timeRow}>
            <Text size={u(11)} color={palette.textSecondary} style={styles.timeText}>{formatTime(currentTime)}</Text>
            {
              audioMeta
                ? <Text size={u(10.5)} color={palette.textTertiary} numberOfLines={1} style={styles.timeCenter}>{audioMeta}</Text>
                : <View style={styles.timeCenter} />
            }
            <Text size={u(11)} color={palette.textSecondary} style={styles.timeTextRight}>{formatTime(maxTime)}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.ctrlBtn} onPress={handleCycleMode} activeOpacity={0.6} accessibilityRole='button' accessibilityLabel='切换播放模式'>
            <Icon name={MODE_ICON[playMode]} size={u(21)} color='rgba(255,255,255,0.9)' />
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtnBig} onPress={() => { void playPrev() }} activeOpacity={0.6} accessibilityRole='button' accessibilityLabel='上一首'>
            <Icon name='prevMusic' size={u(39)} color={accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ctrlBtnBig}
            accessibilityRole='button'
            accessibilityLabel={isPlay ? '暂停' : '播放'}
            onPress={togglePlay}
            activeOpacity={0.75}
            onPressIn={() => { pressPlay(0.9) }}
            onPressOut={() => { pressPlay(1) }}
          >
            <Animated.View style={[styles.playCircle, { backgroundColor: accent, transform: [{ scale: playBtnScale }] }]}>
              <PlayGlyph playing={isPlay} box={21} color={palette.onAccent} />
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtnBig} onPress={() => { void playNext() }} activeOpacity={0.6} accessibilityRole='button' accessibilityLabel='下一首'>
            <Icon name='nextMusic' size={u(39)} color={accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => { setQueueVisible(true) }} activeOpacity={0.6} accessibilityRole='button' accessibilityLabel='播放队列'>
            <Icon name='playlist-music' size={u(23)} color='rgba(255,255,255,0.9)' />
          </TouchableOpacity>
        </View>
      </View>

      {modals}
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
    backgroundColor: 'rgba(10,8,14,0.20)',
  },
  fadeOut: {
    opacity: 0,
  },
  slideBackdrop: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: -2400,
    height: 2400,
    backgroundColor: '#0B0810',
  },
  tint: { position: 'absolute' as const, left: 0, right: 0 },
  tintFull: { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0 },

  stage: { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0 },

  foreground: {
    flex: 1,
  },
  infoHeading: {
    fontWeight: '600' as const,
    marginBottom: 18,
  },
  infoPanel: {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    right: 0,
    zIndex: 60,
  },
  infoInner: {
    flex: 1,
    paddingLeft: 16,
    paddingRight: 12,
    paddingBottom: 20,
  },
  infoHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
  },
  infoTitle: {
    fontWeight: '600' as const,
  },
  infoRows: {
    paddingBottom: 24,
  },
  infoPanelRow: {
    paddingBottom: 12,
  },
  infoPanelLabel: {
    marginBottom: 3,
  },
  infoPanelValue: {
    lineHeight: 16,
  },
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
    // 不能用 center：跑马灯的外层会按内容宽度收缩，boxWidth 永远等于文字宽度，滚不起来
    alignItems: 'stretch' as const,
    justifyContent: 'center' as const,
  },
  headerName: { fontWeight: '600' as const, textAlign: 'center' as const },
  headerSinger: { textAlign: 'center' as const },

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
    marginBottom: 17,
    paddingVertical: 2,
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
  lyricSettingsMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  lyricSettingsCard: {
    width: '82%' as const,
    borderRadius: 24,
    padding: 20,
    backgroundColor: 'rgba(32,28,38,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  lyricSettingsTitle: { marginBottom: 16 },
  lyricSettingsLabel: { marginBottom: 8 },
  lyricSizeRow: { flexDirection: 'row' as const, gap: 8, marginBottom: 18 },
  lyricSizeChip: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  lyricSizeChipActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
  lyricSwitchRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  lyricSwitchDesc: { marginTop: 3 },
  lyricRow: { minHeight: LYRIC_LINE_H, justifyContent: 'center' as const, paddingVertical: 2 },
  /**
   * 外文歌词行：不用最小行高，行距完全由上下 padding 决定。
   * 这样 1 行、2 行（折行）、高亮行的行与行之间间距都一样，不会忽大忽小。
   */
  lyricRowForeign: { justifyContent: 'center' as const, paddingVertical: 7 },
  lyricLine: { textAlign: 'center' as const },
  lyricLineWrap: { alignItems: 'center' as const },
  lyricExtras: { width: '100%' as const, marginTop: 2, alignItems: 'center' as const },
  lyricExtra: { width: '100%' as const, textAlign: 'center' as const },
  /** 同一行有多条扩展（翻译+粤拼/罗马音）时，两条之间留一点缝，不糊成一片 */
  lyricExtraGap: { marginTop: 1 },
  karaokeWrap: { width: '100%' as const, justifyContent: 'center' as const },
  karaokeOverlay: { position: 'absolute' as const, top: 0, bottom: 0, overflow: 'hidden' as const },
  lyricActive: {
    fontWeight: '600' as const,
    // 主题色在亮封面上会偏淡，压一层柔和阴影保证可读
    textShadowColor: 'rgba(0,0,0,0.42)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
  lyricEmptyTouch: { flex: 1 },
  lyricEmpty: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingLeft: 24, paddingRight: 24 },
  lyricEmptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  lyricEmptyTitle: { marginTop: 14, textAlign: 'center' as const },
  lyricEmptyDesc: { marginTop: 6, textAlign: 'center' as const },
  lyricEmptyAction: { marginTop: 18, textAlign: 'center' as const },

  bottomBlock: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    height: BOTTOM_BLOCK_H,
  },
  /*
    信息行：655.6..699.4（高 44）。
    这里按「信息行（歌名/歌手）+ 进度条下方的时间」整块再下移 10dp：
      infoRow 加 marginTop 10、toolRow 同步 +10（歌词态顶部是工具行，两种模式保持同一节奏），
      progressBlock 的 marginTop 24→14 抵掉这 10，进度条本身位置不变，
      时间行在块内 top 28.2→38.2 下移 10，block 高度 48→58 装下它，
      最后 controls 的 marginTop 32→22 把控制区拉回原位置 —— 底块总高仍是 236，
      时间行和控制区之间还有约 22dp，不会压到控制键。
  */
  infoRow: {
    height: 44,
    marginTop: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingLeft: 24,
    paddingRight: 16,
  },
  titleText: { flexGrow: 1, flexShrink: 1, paddingRight: 8 },
  songName: { fontWeight: '600' as const },
  songSinger: {},
  infoActions: { flexDirection: 'row' as const, alignItems: 'center' as const },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginLeft: 12,
  },
  toolRow: {
    // 和 infoRow 一样下移 10（歌词态顶部是工具行，不能让两态的时间行错位）
    height: 44,
    marginTop: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingLeft: 16,
    paddingRight: 16,
  },
  toolBtn: { width: 44, height: 44, justifyContent: 'center' as const, alignItems: 'center' as const },
  toolLeft: { flexDirection: 'row' as const, alignItems: 'center' as const },

  /*
    进度：723.4..771.4（轨道 6dp、中心在块内 25.2）。
    时间行按飞牛再收紧：轨道底 28.2 → 时间文字墨迹之间，飞牛实测约 9.5dp，
    这里 timeRow top 取 31.2（比上一轮的 38.2 上提 7dp），视觉间隙约 8dp。
    高度 51 = 31.2 + 行高 19.8，刚好装下时间行；进度条本身位置不变。
  */
  progressBlock: { height: 51, marginTop: 14, paddingLeft: 24, paddingRight: 24 },
  // SeekBar 高 38（轨道 6 + 上下各 16 触摸区），轨道中心在 19 → top 6.2 让中心落在块内 25.2
  seekWrap: { position: 'absolute' as const, left: 24, right: 24, top: 6.2 },
  timeRow: {
    position: 'absolute' as const,
    left: 24,
    right: 24,
    top: 31.2,
    height: 19.8,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  // 左右时间都留 40dp 最小宽度防止数字跳动；右边那个右对齐，墨迹才能正好落在进度条末端
  timeText: { flexShrink: 0, minWidth: 40, fontVariant: ['tabular-nums'] as Array<'tabular-nums'> },
  timeTextRight: { flexShrink: 0, minWidth: 40, textAlign: 'right' as const, fontVariant: ['tabular-nums'] as Array<'tabular-nums'> },
  timeCenter: {
    flexGrow: 1,
    flexShrink: 1,
    textAlign: 'center' as const,
    paddingLeft: 10,
    paddingRight: 10,
  },

  /*
    控制：803.4..859.4（高 56），两端贴边、无左右 padding。
    marginTop 29 = 22 + 7：抵掉时间行上提的 7dp，控制区绝对位置不变。
  */
  controls: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    height: 56,
    marginTop: 29,
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
  /*
    播放键做成 M3 的实心圆（primary 底 + onPrimary 图标）：
    图标墨迹本来就是 24x29dp，放进 50dp 的圆里留白刚好，位置/间距一点没动。
  */
  playCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center' as const, alignItems: 'center' as const },
  playCircleSmall: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center' as const, alignItems: 'center' as const },

  landBack: {
    position: 'absolute' as const,
    left: 8,
    top: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  landTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingTop: 2,
    paddingBottom: 2,
  },
  iconBtnLand: {
    width: 36,
    height: 36,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginLeft: 4,
  },
  landSeek: {
    marginTop: 2,
  },
  landTimeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    height: 16,
    marginTop: -2,
  },
  landControls: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    height: 52,
    marginTop: 2,
  },

  modalMask: { flex: 1, justifyContent: 'flex-end' as const, backgroundColor: 'rgba(0,0,0,0.45)' },
  queueSheet: { maxHeight: '80%' as const, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 0.5, paddingBottom: 0 },
  queueHandleWrap: {
    alignItems: 'center' as const,
    paddingTop: 8,
    paddingBottom: 2,
  },
  queueHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  queueHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingLeft: 20,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  queueTitleWrap: { flex: 1, flexDirection: 'row' as const, alignItems: 'baseline' as const },
  queueTitle: { fontWeight: '700' as const, marginRight: 8 },
  queueTools: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingLeft: 16, paddingRight: 16, paddingBottom: 8 },
  queueModeBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    height: 30,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: 15,
  },
  queueModeText: { marginLeft: 6 },
  queueClearBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    height: 30,
    paddingLeft: 10,
    paddingRight: 6,
  },
  queueRemove: { width: 32, height: 32, justifyContent: 'center' as const, alignItems: 'center' as const },
  queueList: { paddingLeft: 16, paddingRight: 16 },
  queueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: 58,
  },
  queueCover: { width: 42, height: 42, borderRadius: 12, marginRight: 12 },
  queueInfo: { flexGrow: 1, flexShrink: 1 },
  queueSinger: { marginTop: 2 },
  queueActiveIcon: { marginRight: 6 },
  queueDivider: { position: 'absolute' as const, left: 54, right: 0, bottom: 0, height: 0.5 },
}
