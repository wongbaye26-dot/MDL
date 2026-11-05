import { memo, useRef } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import Text from '@/components/common/Text'
import PicImage from '@/components/common/PicImage'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { QUALITY_LABEL, formatSize } from '@/core/download/utils'

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
  const statusColor = getStatusColor(task)
  const musicInfo = task.metadata.musicInfo
  /** 音质短标签：和「选择下载音质」弹窗同一套文案（320k / 128k 完整显示，不缩成一个字） */
  const qualityLabel = QUALITY_LABEL[task.metadata.quality] ?? task.metadata.quality

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.coverWrap}
        activeOpacity={0.8}
        onPress={() => { onOpen(task) }}
        onLongPress={handleShowMenu}
      >
        <PicImage musicInfo={task} style={styles.cover} />
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
        onPress={() => { onOpen(task) }}
        onLongPress={handleShowMenu}
        delayLongPress={320}
      >
        <View style={styles.titleRow}>
          <Text numberOfLines={1} size={14} style={styles.name}>{musicInfo.name}</Text>
        </View>
        {/*
          音质 badge 单独放在第二行（和歌手同一行）：
          之前塞在歌名同一行里，Android 的 Text 测量比实际渲染窄 0.5~1dp，
          `numberOfLines={1}` 就会把「320k」省成「32...」。挪到第二行后 badge
          不再和歌名抢宽度，auto width 能拿到完整字宽；同时去掉 numberOfLines，
          文案短、不会被省略。样式仍和「选择下载音质」弹窗的标签一致。
        */}
        <View style={styles.metaRow}>
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
          <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.singer}>{musicInfo.singer || '未知歌手'}</Text>
        </View>
        <View style={{ ...styles.progressTrack, backgroundColor: theme['c-primary-alpha-700'] }}>
          <View style={{ ...styles.progressBar, width: `${progress}%`, backgroundColor: isCompleted ? SUCCESS : isError ? DANGER : theme['c-primary'] }} />
        </View>
        <Text size={10} color={statusColor ?? theme['c-450']} numberOfLines={1}>{getStatusText(task)}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleShowMenu}
        ref={moreButtonRef}
        style={styles.moreButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name='dots-vertical' size={15} color={theme['c-350']} />
      </TouchableOpacity>
    </View>
  )
}, (prevProps, nextProps) => {
  return prevProps.task === nextProps.task
})

const styles = createStyle({
  /** 非卡片列表行：透明底 + 行内边距，和本地音乐列表同一套排布 */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 4,
    paddingTop: 8,
    paddingBottom: 8,
  },
  coverWrap: {
    width: 46,
    height: 46,
    borderRadius: 9,
    overflow: 'hidden',
    marginRight: 12,
  },
  cover: {
    width: 46,
    height: 46,
    borderRadius: 9,
  },
  coverMask: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
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
    flexGrow: 1,
    flexShrink: 1,
    fontWeight: '500',
  },
  /** 第二行：音质 badge + 歌手（badge 不和歌名抢宽度，不会再被省略成「32...」） */
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    marginBottom: 6,
  },
  /**
   * 音质标签：放在第二行、auto width（不再和歌名抢宽度）。
   * 右侧 padding 给得比左侧宽（14 vs 6）：Android 上 Text 测量宽度会比实际渲染少
   * 约一个字符，右侧多留的空白正好补偿，badge 里的文案就不会被挤到第二行/裁掉。
   */
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
    marginRight: 6,
  },
  singer: {
    flexGrow: 1,
    flexShrink: 1,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 10,
    marginBottom: 5,
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
  },
  moreButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
