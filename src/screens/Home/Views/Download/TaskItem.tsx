import { memo, useEffect, useRef } from 'react'
import { Animated, Easing, View, TouchableOpacity, StyleSheet } from 'react-native'
import Text from '@/components/common/Text'
import PicImage from '@/components/common/PicImage'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { QUALITY_LABEL, formatSize } from '@/core/download/utils'
import { SOURCE_LOGO_MAP, isKnownSource } from '@/components/common/SourceLogo'
import { getSourceName } from '@/core/music/utils'
import { useReducedMotion } from '@/utils/hooks'

const SUCCESS = '#34D399'
const DANGER = '#F87171'

/**
 * 音质文案的显式文本宽度（dp）。
 *
 * Android 上 RN 给 Text 的测量宽度比实际渲染窄约一个字符，TextView 又能把超出自身
 * 布局宽度的字形裁掉 —— 所以「320k」最后一个 k 会被裁成「320」（没有省略号，
 * 单纯少一个字），光给外层 View 加宽没用，必须给 **Text 本身** 一个足够宽的布局宽度。
 * 这里按 10sp 字号逐字估算（拉丁/数字 9dp、CJK 12dp、空格 5dp）再留 10dp 余量。
 */
const getQualityTextWidth = (label: string) => {
  let width = 0
  for (const ch of label) {
    if (ch === ' ') width += 5
    else if (/[\u2e80-\u9fff\uff00-\uffef]/.test(ch)) width += 12
    else width += 9
  }
  return Math.ceil(width) + 10
}

/**
 * 下载来源展示名。
 *
 * - 主流音源（kw/kg/tx/wy/mg）用正式品牌名（酷我音乐 / 酷狗音乐 / QQ音乐 / 网易云音乐 / 咪咕音乐），
 *   和搜索页品牌图标共用一份 SOURCE_LOGO_MAP，避免两处文案对不上；
 * - 自定义音源取脚本里注册的音源显示名（musicSdk.sources[].name），取不到时退回 source id。
 */
const getSourceLabel = (source?: string) => {
  if (!source) return ''
  if (isKnownSource(source)) return SOURCE_LOGO_MAP[source].name
  return getSourceName(source as LX.Source)
}

const getStatusText = (task: LX.Download.ListItem) => {
  switch (task.status) {
    case 'completed':
      return `已完成 · ${formatSize(task.total)}`
    case 'run':
      if (task.statusText) return task.statusText
      return `${task.progress.toFixed(1)}%${task.speed ? ` · ${task.speed}` : ''} · ${formatSize(task.downloaded)} / ${formatSize(task.total)}`
    case 'pause':
      return `已暂停 · ${formatSize(task.downloaded)}`
    case 'error':
      return task.errorMessage ?? '下载失败'
    case 'waiting':
    default:
      return task.errorMessage ?? '等待下载'
  }
}

const getStatusColor = (task: LX.Download.ListItem) => {
  if (task.isComplate) return SUCCESS
  if (task.status === 'error') return DANGER
  return undefined
}

export default memo(({
  task,
  onShowMenu,
  onToggle,
  onOpen,
}: {
  task: LX.Download.ListItem
  onShowMenu: (task: LX.Download.ListItem, position: { x: number, y: number, w: number, h: number }) => void
  onToggle: (task: LX.Download.ListItem) => void
  onOpen: (task: LX.Download.ListItem) => void
}) => {
  const theme = useTheme()
  const moreButtonRef = useRef<TouchableOpacity>(null)

  const handleShowMenu = () => {
    moreButtonRef.current?.measure((fx, fy, width, height, px, py) => {
      onShowMenu(task, { x: Math.ceil(px), y: Math.ceil(py), w: Math.ceil(width), h: Math.ceil(height) })
    })
  }

  const isRunning = task.status === 'run'
  const isCompleted = task.isComplate
  const isError = task.status === 'error'
  const progress = isCompleted ? 100 : Math.max(0, Math.min(100, task.progress || 0))
  const reduced = useReducedMotion()
  /** 进度补间：下载 store 每次 percent 变化都跳一格很生硬，这里 300ms 追上去 */
  const progressAnim = useRef(new Animated.Value(progress)).current
  useEffect(() => {
    if (reduced) {
      progressAnim.setValue(progress)
      return
    }
    const animation = Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    })
    animation.start()
    return () => { animation.stop() }
  }, [progress, progressAnim, reduced])
  const statusColor = getStatusColor(task)
  const musicInfo = task.metadata.musicInfo
  /** 音质短标签：和「选择下载音质」弹窗同一套文案（320k / 128k 完整显示，不缩成一个字） */
  const qualityLabel = QUALITY_LABEL[task.metadata.quality] ?? task.metadata.quality
  /** 下载来源：拼在状态行末尾（所有状态都拼，保持单行省略） */
  const sourceLabel = getSourceLabel(task.metadata.musicInfo.source)
  const statusText = getStatusText(task)

  return (
    <View style={[styles.row, {
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.72)',
      borderColor: theme['c-primary-alpha-700'],
    }]}>
      <TouchableOpacity
        style={styles.coverWrap}
        activeOpacity={0.8}
        onPress={() => { onOpen(task) }}
        onLongPress={handleShowMenu}
      >
        <PicImage musicInfo={task} style={styles.cover} />
        {isCompleted ? (
          <View style={styles.doneBadge}>
            <Icon name='check' size={10} color='#FFFFFF' />
          </View>
        ) : null}
        {
          !isCompleted
            ? (
              <TouchableOpacity
                style={{ ...styles.coverMask, backgroundColor: 'rgba(0,0,0,0.42)' }}
                activeOpacity={0.7}
                onPress={() => { onToggle(task) }}
              >
                <Icon
                  name={isError ? 'close' : isRunning ? 'pause' : 'play'}
                  size={16}
                  color={isError ? DANGER : '#FFFFFF'}
                />
              </TouchableOpacity>
              )
            : null
        }
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.info}
        accessibilityRole='button'
        accessibilityLabel={`${musicInfo.name}${musicInfo.singer ? ` ${musicInfo.singer}` : ''}，${statusText}`}
        onPress={() => { onOpen(task) }}
        onLongPress={handleShowMenu}
        delayLongPress={320}
      >
        <View style={styles.titleRow}>
          <Text numberOfLines={1} size={14} style={styles.name}>{musicInfo.name}</Text>
          {/*
            音质 badge 放回歌名后面（用户要求）。
            关键在于「给 badge 里的 Text 本身显式宽度」：Android 上 RN 的文本测量
            比实际渲染窄 0.5~1dp，只给外层 View 加宽时 TextView 仍会裁掉超出自身
            布局宽度的字形；这里用 getQualityTextWidth(label) 直接把 Text 的布局宽度
            给足，配合外层 flexShrink: 0，320k/128k/Hi-Res/FLAC 无损 都能完整显示。
          */}
          <View style={{
            ...styles.qualityTag,
            backgroundColor: theme['c-primary-alpha-900'],
            borderColor: theme['c-primary-alpha-700'],
          }}>
            <Text
              size={10}
              color={theme['c-primary-light-200']}
              style={{ width: getQualityTextWidth(qualityLabel), textAlign: 'center' }}
            >{qualityLabel}</Text>
          </View>
        </View>
        <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.singer}>{musicInfo.singer || '未知歌手'}</Text>
        <View style={{ ...styles.progressTrack, backgroundColor: theme['c-primary-alpha-700'] }}>
          <Animated.View style={{ ...styles.progressBar, width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }), backgroundColor: isCompleted ? SUCCESS : isError ? DANGER : theme['c-primary'] }} />
        </View>
        <Text size={10} color={statusColor ?? theme['c-450']} numberOfLines={1}>
          {sourceLabel ? `${statusText} · ${sourceLabel}` : statusText}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleShowMenu}
        ref={moreButtonRef}
        style={styles.moreButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole='button'
        accessibilityLabel='任务更多操作'
      >
        <Icon name='dots-vertical' size={15} color={theme['c-350']} />
      </TouchableOpacity>
    </View>
  )
}, (prevProps, nextProps) => {
  return prevProps.task === nextProps.task
})

const styles = createStyle({
  /** 卡片式下载行：和设置/本地列表同一套圆角卡片语言 */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    marginRight: 16,
    marginBottom: 8,
    paddingLeft: 10,
    paddingRight: 4,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  coverWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: 12,
  },
  cover: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  coverMask: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBadge: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: SUCCESS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    flexGrow: 0,
    flexShrink: 1,
    fontWeight: '600',
  },
  qualityTag: {
    flexShrink: 0,
    flexGrow: 0,
    minHeight: 17,
    paddingLeft: 6,
    paddingRight: 6,
    borderRadius: 8.5,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  singer: {
    flexGrow: 1,
    flexShrink: 1,
    marginTop: 2,
    marginBottom: 7,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 10,
    marginBottom: 6,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  moreButton: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
