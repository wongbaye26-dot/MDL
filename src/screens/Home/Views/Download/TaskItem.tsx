import { memo, useRef } from 'react'
import { View, TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'
import { QUALITY_LABEL, formatSize } from '@/core/download/utils'

export const ITEM_HEIGHT = scaleSizeH(68)

const getStatusText = (task: LX.Download.ListItem) => {
  switch (task.status) {
    case 'completed':
      return `已完成 · ${formatSize(task.total)}`
    case 'run':
      if (task.statusText) return task.statusText
      return `${task.progress.toFixed(1)}%  ${task.speed ? `${task.speed}  ` : ''}${formatSize(task.downloaded)} / ${formatSize(task.total)}`
    case 'pause':
      return `已暂停 · ${formatSize(task.downloaded)}`
    case 'error':
      return task.errorMessage || '下载失败'
    case 'waiting':
    default:
      return task.errorMessage || '等待下载'
  }
}

const getStatusColorKey = (task: LX.Download.ListItem) => {
  switch (task.status) {
    case 'completed': return 'c-primary'
    case 'error': return 'c-500'
    default: return 'c-450'
  }
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
  const progress = isCompleted ? 100 : Math.max(0, Math.min(100, task.progress || 0))

  return (
    <View style={{ ...styles.container, height: ITEM_HEIGHT }}>
      <TouchableOpacity style={styles.toggleBtn} onPress={() => { onToggle(task) }} disabled={isCompleted}>
        <Icon
          name={isCompleted ? 'checkbox-marked' : isRunning ? 'pause' : 'play'}
          color={isCompleted ? theme['c-primary'] : theme['c-450']}
          size={16}
        />
      </TouchableOpacity>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.name}>{task.metadata.musicInfo.name}</Text>
          <Text size={11} color={theme['c-400']} numberOfLines={1} style={styles.quality}>
            {QUALITY_LABEL[task.metadata.quality] ?? task.metadata.quality}
          </Text>
        </View>
        <Text size={11} color={theme['c-500']} numberOfLines={1}>{task.metadata.musicInfo.singer}</Text>
        <View style={styles.progressRow}>
          <View style={{ ...styles.progressBar, backgroundColor: theme['c-200'] }}>
            <View style={{ ...styles.progressBarInner, width: `${progress}%`, backgroundColor: isCompleted ? theme['c-primary-alpha-500'] : theme['c-primary'] }} />
          </View>
        </View>
        <Text size={11} color={theme[getStatusColorKey(task)]} numberOfLines={1}>{getStatusText(task)}</Text>
      </View>
      <TouchableOpacity onPress={handleShowMenu} ref={moreButtonRef} style={styles.moreButton}>
        <Icon name="dots-vertical" style={{ color: theme['c-350'] }} size={12} />
      </TouchableOpacity>
    </View>
  )
}, (prevProps, nextProps) => {
  return prevProps.task === nextProps.task
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 2,
  },
  toggleBtn: {
    width: 44,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    flexGrow: 0,
    flexShrink: 1,
  },
  quality: {
    marginLeft: 6,
    flexGrow: 0,
    flexShrink: 0,
  },
  progressRow: {
    marginTop: 4,
    marginBottom: 3,
    marginRight: 8,
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    borderRadius: 2,
  },
  moreButton: {
    height: '80%',
    paddingLeft: 16,
    paddingRight: 16,
    justifyContent: 'center',
  },
})
