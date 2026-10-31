import { useCallback, useRef, useState } from 'react'
import { View, FlatList, Image } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { useDownloadList, useDownloadStats } from '@/store/download'
import { useNavActiveId } from '@/store/common/hook'
import { clearCompleted, pauseAll, pauseTask, removeTask, retryTask, startAll, startTask } from '@/core/download'
import Toolbar from './Toolbar'
import TaskItem from './TaskItem'
import TaskMenu, { type TaskMenuType, type TaskMenuAction } from './TaskMenu'
import PageModal from '../../Vertical/PageModal'
import LocalMusic from '../LocalMusic'

const emoLogo = require('@/resources/images/emo-logo.png')

export default () => {
  const theme = useTheme()
  const list = useDownloadList()
  const stats = useDownloadStats()
  const navActiveId = useNavActiveId()
  const menuRef = useRef<TaskMenuType>(null)
  const [localVisible, setLocalVisible] = useState(false)

  const handleShowMenu = useCallback((task: LX.Download.ListItem, position: { x: number, y: number, w: number, h: number }) => {
    menuRef.current?.show(task, position)
  }, [])

  const handleToggle = useCallback((task: LX.Download.ListItem) => {
    if (task.isComplate) return
    if (task.status === 'run') pauseTask(task.id)
    else if (task.status === 'error') void retryTask(task.id)
    else void startTask(task.id)
  }, [])

  const handleMenuAction = useCallback((action: TaskMenuAction, task: LX.Download.ListItem) => {
    switch (action) {
      case 'start':
        void startTask(task.id)
        break
      case 'pause':
        pauseTask(task.id)
        break
      case 'retry':
        void retryTask(task.id)
        break
      case 'remove':
        removeTask(task.id, false)
        break
      case 'removeWithFile':
        removeTask(task.id, true)
        toast('已删除任务')
        break
    }
  }, [])

  const handleStartAll = useCallback(() => {
    startAll()
    toast('已开始下载')
  }, [])

  const handlePauseAll = useCallback(() => {
    pauseAll()
    toast('已暂停全部下载')
  }, [])

  const handleClearCompleted = useCallback(() => {
    clearCompleted()
    toast('已清空已完成任务')
  }, [])

  const renderItem = useCallback(({ item }: { item: LX.Download.ListItem }) => (
    <TaskItem task={item} onShowMenu={handleShowMenu} onToggle={handleToggle} />
  ), [handleShowMenu, handleToggle])

  const keyExtractor = useCallback((item: LX.Download.ListItem) => item.id, [])

  return (
    <View style={styles.container}>
      <Toolbar
        stats={stats}
        onStartAll={handleStartAll}
        onPauseAll={handlePauseAll}
        onClearCompleted={handleClearCompleted}
        onOpenLocal={() => { setLocalVisible(true) }}
      />
      {
        list.length
          ? (
              <FlatList
                data={list}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                maxToRenderPerBatch={12}
                windowSize={5}
                contentContainerStyle={styles.listContent}
                removeClippedSubviews={navActiveId !== 'nav_download'}
              />
            )
          : (
              <View style={styles.empty}>
                <Image source={emoLogo} style={styles.emptyLogo} />
                <Text color={theme['c-font']} size={15} style={styles.emptyTitle}>还没有下载任务</Text>
                <Text color={theme['c-450']} size={12} style={styles.emptyTip}>
                  在搜索、歌单、排行榜或我的列表里长按歌曲，选择「下载」，就能在这里排队下载
                </Text>
              </View>
            )
      }
      <TaskMenu ref={menuRef} onAction={handleMenuAction} />
      {
        localVisible
          ? <PageModal title='本地音乐' onClose={() => { setLocalVisible(false) }}><LocalMusic /></PageModal>
          : null
      }
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 40,
    paddingRight: 40,
  },
  emptyLogo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    marginBottom: 16,
    opacity: 0.9,
  },
  emptyTitle: {
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  emptyTip: {
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 19,
  },
})
