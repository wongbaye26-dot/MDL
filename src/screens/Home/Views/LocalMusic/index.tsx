import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import DorpDownMenu from '@/components/common/DorpDownMenu'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { formatSize } from '@/core/download/utils'
import { getLocalMusicList, scanLocalMusic, getTotalSize } from '@/core/localMusic'
import { overwriteListMusics } from '@/core/list'
import listAction from '@/store/list/action'
import { playList } from '@/core/player/player'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { LIST_IDS } from '@/config/constant'

const LOCAL_LIST_ID = 'local_music'

export default () => {
  const theme = useTheme()
  const [list, setList] = useState<LX.Music.MusicInfoLocal[]>([])
  const [dir, setDir] = useState('')
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [inited, setInited] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleScan = useCallback(async() => {
    if (scanning) return
    setScanning(true)
    setProgress(0)
    try {
      const result = await scanLocalMusic(count => {
        if (mountedRef.current) setProgress(count)
      })
      if (!mountedRef.current) return
      setList(result.list)
      setDir(result.dir)
      toast(result.list.length ? `扫描完成，共 ${result.list.length} 首` : '没有找到音频文件')
    } catch {
      if (mountedRef.current) toast('扫描失败，请检查目录权限')
    } finally {
      if (mountedRef.current) {
        setScanning(false)
        setInited(true)
      }
    }
  }, [scanning])

  useEffect(() => {
    void getLocalMusicList().then(cached => {
      if (!mountedRef.current) return
      if (cached.length) {
        setList(cached)
        setInited(true)
      } else {
        void handleScan()
      }
    })
  }, [handleScan])

  const totalSize = useMemo(() => formatSize(getTotalSize(list)), [list])

  const handlePlay = useCallback(async(index: number) => {
    if (!list.length) return
    await overwriteListMusics(LIST_IDS.TEMP, list)
    listAction.setTempListMeta({ id: LOCAL_LIST_ID })
    void playList(LIST_IDS.TEMP, index)
  }, [list])

  const handlePlayLater = useCallback((item: LX.Music.MusicInfoLocal) => {
    addTempPlayList([{ listId: '', musicInfo: item }])
    toast('已加入稍后播放')
  }, [])

  const renderItem = useCallback(({ item, index }: { item: LX.Music.MusicInfoLocal, index: number }) => (
    <LocalRow
      item={item}
      onPress={() => { void handlePlay(index) }}
      onMenu={action => {
        if (action === 'play') void handlePlay(index)
        else handlePlayLater(item)
      }}
    />
  ), [handlePlay, handlePlayLater])

  return (
    <View style={styles.container}>
      <View style={{
        ...styles.scanCard,
        backgroundColor: theme['c-primary-alpha-900'],
        borderColor: theme['c-primary-alpha-700'],
      }}>
        <View style={styles.scanInfo}>
          <View style={styles.scanTitleRow}>
            <Icon name='folder' size={14} color={theme['c-primary-light-200']} />
            <Text size={13} numberOfLines={1} style={styles.scanTitle}>{dir || '下载目录'}</Text>
          </View>
          <Text size={11} color={theme['c-450']} style={styles.scanMeta}>
            {scanning
              ? `扫描中，已找到 ${progress} 首…`
              : `${list.length} 首 · ${totalSize}`}
          </Text>
        </View>
        <TouchableOpacity
          style={{ ...styles.scanBtn, backgroundColor: theme['c-primary'], opacity: scanning ? 0.6 : 1 }}
          disabled={scanning}
          onPress={() => { void handleScan() }}
        >
          <Icon name='refresh' size={13} color='#FFFFFF' />
          <Text size={11} color='#FFFFFF' style={styles.scanBtnText}>{scanning ? '扫描中' : '重新扫描'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={list}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <View style={{ ...styles.emptyIcon, backgroundColor: theme['c-primary-alpha-900'] }}>
              <Icon name='music_time' size={26} color={theme['c-400']} />
            </View>
            <Text size={13} style={styles.emptyTitle}>
              {inited && !scanning ? '下载目录里还没有音乐' : '正在扫描下载目录…'}
            </Text>
            <Text size={11} color={theme['c-450']} style={styles.emptyTip}>
              下载完成的歌曲会自动保存在这里，扫描后即可离线播放
            </Text>
          </View>
        )}
      />
    </View>
  )
}

const LocalRow = ({ item, onPress, onMenu }: {
  item: LX.Music.MusicInfoLocal
  onPress: () => void
  onMenu: (action: string) => void
}) => {
  const theme = useTheme()
  const menus = useMemo(() => [
    { action: 'play', label: '播放' },
    { action: 'playLater', label: '稍后播放' },
  ], [])

  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.rowMain} activeOpacity={0.7} onPress={onPress}>
        <View style={{ ...styles.cover, backgroundColor: theme['c-primary-alpha-900'] }}>
          <Icon name='music_time' size={17} color={theme['c-primary-light-200']} />
        </View>
        <View style={styles.info}>
          <Text size={14} numberOfLines={1}>{item.name}</Text>
          <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.meta}>
            {[item.singer || '未知歌手', item.meta.ext.toUpperCase(), item.interval, item.meta.size ? formatSize(item.meta.size) : ''].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </TouchableOpacity>
      <DorpDownMenu menus={menus} onPress={menu => { onMenu(menu.action) }} btnStyle={styles.moreBtn}>
        <Icon name='dots-vertical' size={14} color={theme['c-350']} />
      </DorpDownMenu>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    marginRight: 16,
    marginTop: 8,
    paddingLeft: 14,
    paddingRight: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 16,
    borderWidth: 0.5,
  },
  scanInfo: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 10,
  },
  scanTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanTitle: {
    marginLeft: 6,
    flexShrink: 1,
  },
  scanMeta: {
    marginTop: 5,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    paddingLeft: 12,
    paddingRight: 13,
    borderRadius: 15,
  },
  scanBtnText: {
    marginLeft: 5,
    fontWeight: '600',
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  rowMain: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
  },
  meta: {
    marginTop: 3,
  },
  moreBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingLeft: 32,
    paddingRight: 32,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 14,
    fontWeight: '600',
  },
  emptyTip: {
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 16,
  },
})
