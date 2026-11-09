import { useCallback, useMemo, useRef, useState } from 'react'
import { View, TouchableOpacity, FlatList, Image } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { contrastOn } from '@/theme/solid'
import { useDownloadList, useDownloadStats } from '@/store/download'
import { useNavActiveId } from '@/store/common/hook'
import { clearCompleted, pauseAll, pauseTask, removeTask, retryTask, startAll, startTask } from '@/core/download'
import { getLocalMusicList } from '@/core/localMusic'
import { overwriteListMusics, addListMusics } from '@/core/list'
import listAction from '@/store/list/action'
import settingState from '@/store/setting/state'
import { playList } from '@/core/player/player'
import { getListMusicSync } from '@/utils/listManage'
import { LIST_IDS, NAV_BAR_SPACE } from '@/config/constant'
import { Icon } from '@/components/common/Icon'
import PageHeader from '@/components/common/PageHeader'
import MiniTag from '@/components/common/MiniTag'
import TaskItem from './TaskItem'
import TaskMenu, { type TaskMenuType, type TaskMenuAction } from './TaskMenu'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const emoLogo = require('@/resources/images/emo-logo.png')

type Filter = 'all' | 'running' | 'done'

export default () => {
  const theme = useTheme()
  const list = useDownloadList()
  const stats = useDownloadStats()
  const navActiveId = useNavActiveId()
  const menuRef = useRef<TaskMenuType>(null)
  const [filter] = useState<Filter>('all')
  /** 多选管理：和本地音乐列表同一套交互（选择/长按进入，底部操作条） */
  const [batchMode, setBatchMode] = useState(false)
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set())

  const runningList = useMemo(() => list.filter(task => !task.isComplate), [list])
  const doneList = useMemo(() => list.filter(task => task.isComplate), [list])
  const shownList = filter === 'running' ? runningList : filter === 'done' ? doneList : list

  const selectedTasks = useMemo(() => list.filter(task => batchSelected.has(task.id)), [list, batchSelected])

  const exitBatch = useCallback(() => {
    setBatchMode(false)
    setBatchSelected(new Set())
  }, [])

  const toggleBatchMode = useCallback(() => {
    setBatchMode(prev => {
      if (prev) setBatchSelected(new Set())
      return !prev
    })
  }, [])

  const toggleBatchItem = useCallback((task: LX.Download.ListItem) => {
    setBatchSelected(prev => {
      const next = new Set(prev)
      if (next.has(task.id)) next.delete(task.id)
      else next.add(task.id)
      return next
    })
  }, [])

  const enterBatch = useCallback((task: LX.Download.ListItem) => {
    setBatchMode(true)
    setBatchSelected(new Set([task.id]))
  }, [])

  const handleBatchPause = useCallback(() => {
    const tasks = selectedTasks.filter(task => !task.isComplate && task.status === 'run')
    tasks.forEach(task => { pauseTask(task.id) })
    toast(tasks.length ? `已暂停 ${tasks.length} 个任务` : '没有正在下载的任务')
    exitBatch()
  }, [selectedTasks, exitBatch])

  const handleBatchResume = useCallback(() => {
    const tasks = selectedTasks.filter(task => !task.isComplate)
    tasks.forEach(task => {
      if (task.status === 'error') void retryTask(task.id)
      else void startTask(task.id)
    })
    toast(tasks.length ? `已开始 ${tasks.length} 个任务` : '没有待开始的任务')
    exitBatch()
  }, [selectedTasks, exitBatch])

  const handleBatchRemoveTasks = useCallback(() => {
    if (!selectedTasks.length) return
    void confirmDialog({
      title: '移除任务',
      message: `从下载中心移除选中的 ${selectedTasks.length} 个任务？只删任务记录，不删除已下载文件。`,
      confirmButtonText: '移除',
    }).then(confirmed => {
      if (!confirmed) return
      selectedTasks.forEach(task => { removeTask(task.id, false) })
      toast(`已移除 ${selectedTasks.length} 个任务`)
      exitBatch()
    })
  }, [selectedTasks, exitBatch])

  const handleBatchRemoveFiles = useCallback(() => {
    const tasks = selectedTasks.filter(task => task.isComplate)
    if (!tasks.length) {
      toast('选中的任务里没有已完成文件')
      return
    }
    void confirmDialog({
      title: '删除文件',
      message: `删除选中 ${tasks.length} 个已完成任务的文件和任务记录？此操作不可恢复。`,
      confirmButtonText: '删除',
      danger: true,
    }).then(confirmed => {
      if (!confirmed) return
      tasks.forEach(task => { removeTask(task.id, true) })
      toast(`已删除 ${tasks.length} 个文件`)
      exitBatch()
    })
  }, [selectedTasks, exitBatch])

  const handleBatchSelectAll = useCallback(() => {
    setBatchSelected(prev => {
      if (prev.size === shownList.length) return new Set()
      return new Set(shownList.map(task => task.id))
    })
  }, [shownList])

  const handleShowMenu = useCallback((task: LX.Download.ListItem, position: { x: number, y: number, w: number, h: number }) => {
    menuRef.current?.show(task, position)
  }, [])

  const handleToggle = useCallback((task: LX.Download.ListItem) => {
    if (task.isComplate) return
    if (task.status === 'run') pauseTask(task.id)
    else if (task.status === 'error') void retryTask(task.id)
    else void startTask(task.id)
  }, [])

  const handleOpen = useCallback((task: LX.Download.ListItem) => {
    if (!task.isComplate) {
      handleToggle(task)
      return
    }
    void getLocalMusicList().then(localList => {
      const index = localList.findIndex(item => item.meta.filePath === task.metadata.filePath)
      if (index < 0) {
        toast('这首歌还没进本地列表，去「本地音乐」重新扫描一次')
        return
      }
      void overwriteListMusics(LIST_IDS.TEMP, localList).then(() => {
        listAction.setTempListMeta({ id: 'local_music' })
        void playList(LIST_IDS.TEMP, index)
      })
    })
  }, [handleToggle])

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
      case 'play':
        handleOpen(task)
        break
      case 'collect': {
        const musicInfo = task.metadata.musicInfo
        const loveList = getListMusicSync(LIST_IDS.LOVE)
        if (loveList.some(m => m.id === musicInfo.id)) {
          toast('已在收藏列表中')
        } else {
          void addListMusics(LIST_IDS.LOVE, [musicInfo], settingState.setting['list.addMusicLocationType'])
          toast('已收藏到「我的收藏」')
        }
        break
      }
    }
  }, [handleOpen])

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
    <TaskItem
      task={item}
      onShowMenu={handleShowMenu}
      onToggle={handleToggle}
      onOpen={handleOpen}
      batchMode={batchMode}
      selected={batchSelected.has(item.id)}
      onToggleSelect={toggleBatchItem}
      onEnterBatch={enterBatch}
    />
  ), [handleShowMenu, handleToggle, handleOpen, batchMode, batchSelected, toggleBatchItem, enterBatch])

  const keyExtractor = useCallback((item: LX.Download.ListItem) => item.id, [])

  return (
    <View style={styles.container}>
      <PageHeader
        glass
        title='下载中心'
        subtitle={(
          <View style={styles.headerTags}>
            <MiniTag text={`共 ${stats.total} 首`} />
            <MiniTag text={`已完成 ${stats.completed}`} />
            <MiniTag text={`下载中 ${stats.running}`} />
          </View>
        )}
        right={(
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={{ ...styles.headerBtn, backgroundColor: theme['c-primary-alpha-900'] }}
              activeOpacity={0.8}
              onPress={handleStartAll}
            >
              <Icon name='play-circle-outline' size={20} color={theme['c-font']} />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ ...styles.headerBtn, backgroundColor: theme['c-primary-alpha-900'] }}
              activeOpacity={0.8}
              onPress={handlePauseAll}
            >
              <Icon name='pause-circle-outline' size={20} color={theme['c-font']} />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ ...styles.headerBtn, backgroundColor: theme['c-primary-alpha-900'] }}
              activeOpacity={0.8}
              onPress={handleClearCompleted}
            >
              <Icon name='delete-sweep-outline' size={20} color={theme['c-font']} />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ ...styles.headerBtn, backgroundColor: batchMode ? theme['c-primary'] : theme['c-primary-alpha-900'] }}
              activeOpacity={0.8}
              onPress={toggleBatchMode}
              accessibilityRole='button'
              accessibilityLabel={batchMode ? '退出批量选择' : '批量选择'}
            >
              <Icon name={batchMode ? 'close' : 'checkbox-multiple-marked-outline'} size={20} color={batchMode ? contrastOn(theme['c-primary']) : theme['c-font']} />
            </TouchableOpacity>
          </View>
        )}
      />

      {
        shownList.length
          ? (
              <FlatList
                data={shownList}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                maxToRenderPerBatch={12}
                windowSize={5}
                contentContainerStyle={styles.listContent}
                extraData={`${batchMode ? 1 : 0}:${batchSelected.size}`}
                removeClippedSubviews={navActiveId !== 'nav_download'}
              />
            )
          : (
              <View style={styles.empty}>
                <Image source={emoLogo} style={styles.emptyLogo} />
                <Text color={theme['c-font']} size={15} style={styles.emptyTitle}>
                  {filter === 'running' ? '没有正在下载的任务' : filter === 'done' ? '还没有已完成的下载' : '还没有下载任务'}
                </Text>
                <Text color={theme['c-450']} size={12} style={styles.emptyTip}>
                  在搜索、歌单、排行榜或我的列表里长按歌曲，选择「下载」，就能在这里排队下载
                </Text>
              </View>
            )
      }
      {
        batchMode
          ? (
            <View style={[styles.batchBar, { backgroundColor: theme['c-content-background'], borderColor: theme['c-primary-alpha-700'] }]}>
              <Text size={12} style={styles.batchCount}>{`已选 ${batchSelected.size}`}</Text>
              <TouchableOpacity style={styles.batchBtn} onPress={handleBatchSelectAll} accessibilityLabel='全选'>
                <Icon name='checkbox-multiple-marked-outline' size={19} color={theme['c-font']} />
                <Text size={9.5} color={theme['c-450']} style={styles.batchLabel}>全选</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.batchBtn} onPress={handleBatchPause} accessibilityLabel='暂停所选'>
                <Icon name='pause' size={19} color={theme['c-font']} />
                <Text size={9.5} color={theme['c-450']} style={styles.batchLabel}>暂停</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.batchBtn} onPress={handleBatchResume} accessibilityLabel='继续所选'>
                <Icon name='play' size={19} color={theme['c-font']} />
                <Text size={9.5} color={theme['c-450']} style={styles.batchLabel}>继续</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.batchBtn} onPress={handleBatchRemoveTasks} accessibilityLabel='移除任务'>
                <Icon name='delete-outline' size={19} color='#F59E0B' />
                <Text size={9.5} color='#F59E0B' style={styles.batchLabel}>移除</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.batchBtn} onPress={handleBatchRemoveFiles} accessibilityLabel='删除文件'>
                <Icon name='delete-forever-outline' size={19} color='#F87171' />
                <Text size={9.5} color='#F87171' style={styles.batchLabel}>删文件</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.batchBtn} onPress={exitBatch} accessibilityLabel='退出批量选择'>
                <Icon name='close' size={19} color={theme['c-font']} />
                <Text size={9.5} color={theme['c-450']} style={styles.batchLabel}>退出</Text>
              </TouchableOpacity>
            </View>
            )
          : null
      }
      <TaskMenu ref={menuRef} onAction={handleMenuAction} />
    </View>
  )
}

const styles = createStyle({
  headerTags: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  listContent: {
    // 任务行已改成无卡片列表样式，这里只留一点与页头的呼吸间距
    paddingTop: 6,
    paddingBottom: NAV_BAR_SPACE,
  },
  batchBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 96,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 0.5,
    paddingLeft: 14,
    paddingRight: 8,
    height: 56,
    elevation: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    zIndex: 20,
  },
  batchCount: {
    flex: 1,
  },
  batchBtn: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batchLabel: {
    marginTop: 2,
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
