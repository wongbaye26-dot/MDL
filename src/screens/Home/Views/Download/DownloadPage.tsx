import { useCallback, useMemo, useRef, useState } from 'react'
import { View, TouchableOpacity, FlatList, Image } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
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

  const runningList = useMemo(() => list.filter(task => !task.isComplate), [list])
  const doneList = useMemo(() => list.filter(task => task.isComplate), [list])
  const shownList = filter === 'running' ? runningList : filter === 'done' ? doneList : list

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
    <TaskItem task={item} onShowMenu={handleShowMenu} onToggle={handleToggle} onOpen={handleOpen} />
  ), [handleShowMenu, handleToggle, handleOpen])

  const keyExtractor = useCallback((item: LX.Download.ListItem) => item.id, [])

  return (
    <View style={styles.container}>
      <PageHeader
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
