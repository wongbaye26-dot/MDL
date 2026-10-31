import { memo, useRef } from 'react'
import { View, TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { QUALITY_LABEL, formatSize } from '@/core/download/utils'

const SUCCESS = '#34D399'
const DANGER = '#F87171'

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
      return task.errorMessage || '下载失败'
    case 'waiting':
    default:
      return task.errorMessage || '等待下载'
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
}: {
  task: LX.Download.ListItem
  onShowMenu: (task: LX.Download.ListItem, position: { x: number, y: number, w: number, h: number }) => void
  onToggle: (task: LX.Download.ListItem) => void
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

  return (
    <View style={{ ...styles.card, backgroundColor: theme['c-primary-alpha-900'], borderColor: theme['c-primary-alpha-800'] }}>
      <TouchableOpacity
        style={styles.left}
        activeOpacity={0.7}
        onPress={() => { onToggle(task) }}
        onLongPress={handleShowMenu}
        disabled={isCompleted}
      >
        <View style={{ ...styles.avatar, backgroundColor: isCompleted ? 'rgba(52, 211, 153, 0.14)' : theme['c-primary-alpha-700'] }}>
          <Icon
            name={isCompleted ? 'checkbox-marked' : isError ? 'close' : isRunning ? 'pause' : 'play'}
            color={isCompleted ? SUCCESS : isError ? DANGER : theme['c-primary-light-200']}
            size={16}
          />
        </View>
      </TouchableOpacity>

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.name}>{task.metadata.musicInfo.name}</Text>
          <View style={{ ...styles.qualityTag, backgroundColor: theme['c-primary-alpha-800'] }}>
            <Text size={10} color={theme['c-primary-light-200']}>{QUALITY_LABEL[task.metadata.quality] ?? task.metadata.quality}</Text>
          </View>
        </View>
        <Text size={11} color={theme['c-400']} numberOfLines={1} style={styles.singer}>{task.metadata.musicInfo.singer}</Text>
        <View style={{ ...styles.progressTrack, backgroundColor: theme['c-primary-alpha-700'] }}>
          <View style={{ ...styles.progressBar, width: `${progress}%`, backgroundColor: isCompleted ? SUCCESS : isError ? DANGER : theme['c-primary'] }} />
        </View>
        <Text size={11} color={statusColor ?? theme['c-450']} numberOfLines={1}>{getStatusText(task)}</Text>
      </View>

      <TouchableOpacity onPress={handleShowMenu} ref={moreButtonRef} style={styles.moreButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Icon name="dots-vertical" style={{ color: theme['c-400'] }} size={13} />
      </TouchableOpacity>
    </View>
  )
}, (prevProps, nextProps) => {
  return prevProps.task === nextProps.task
})

const styles = createStyle({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    marginRight: 12,
    marginBottom: 10,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: 16,
    borderWidth: 0.5,
  },
  left: {
    marginRight: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    flexGrow: 0,
    flexShrink: 1,
    fontWeight: '500',
  },
  qualityTag: {
    marginLeft: 6,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 1,
    paddingBottom: 1,
    borderRadius: 4,
    flexGrow: 0,
    flexShrink: 0,
  },
  singer: {
    marginTop: 2,
    marginBottom: 6,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 10,
    marginBottom: 5,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  moreButton: {
    height: '80%',
    paddingLeft: 12,
    paddingRight: 12,
    justifyContent: 'center',
  },
})
