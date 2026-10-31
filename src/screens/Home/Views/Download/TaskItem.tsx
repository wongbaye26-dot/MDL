import { memo, useRef } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
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

  return (
    <View style={{ ...styles.card, backgroundColor: theme['c-primary-alpha-900'], borderColor: theme['c-primary-alpha-800'] }}>
      <TouchableOpacity
        style={styles.coverWrap}
        activeOpacity={0.8}
        onPress={() => { onOpen(task) }}
        onLongPress={handleShowMenu}
      >
        <Image url={musicInfo.meta?.picUrl} style={styles.cover} />
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

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} size={14} style={styles.name}>{musicInfo.name}</Text>
          <View style={{ ...styles.qualityTag, backgroundColor: theme['c-primary-alpha-800'] }}>
            <Text size={9} color={theme['c-primary-light-200']}>{QUALITY_LABEL[task.metadata.quality] ?? task.metadata.quality}</Text>
          </View>
        </View>
        <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.singer}>{musicInfo.singer || '未知歌手'}</Text>
        <View style={{ ...styles.progressTrack, backgroundColor: theme['c-primary-alpha-700'] }}>
          <View style={{ ...styles.progressBar, width: `${progress}%`, backgroundColor: isCompleted ? SUCCESS : isError ? DANGER : theme['c-primary'] }} />
        </View>
        <Text size={10} color={statusColor ?? theme['c-450']} numberOfLines={1}>{getStatusText(task)}</Text>
      </View>

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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 14,
    marginRight: 14,
    marginBottom: 10,
    paddingLeft: 10,
    paddingRight: 4,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 16,
    borderWidth: 0.5,
  },
  coverWrap: {
    width: 46,
    height: 46,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
  },
  cover: {
    width: 46,
    height: 46,
    borderRadius: 10,
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
  },
  singer: {
    marginTop: 2,
    marginBottom: 6,
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
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
