import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  FlatList,
  PanResponder,
  RefreshControl,
  TouchableOpacity,
  View,
  Modal,
  TextInput,
  StyleSheet,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'

import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import DorpDownMenu from '@/components/common/DorpDownMenu'
import Chip from '@/components/common/Chip'
import PageHeader from '@/components/common/PageHeader'
import Menu, { type MenuType } from '@/components/common/Menu'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { formatSize, formatSampleRate } from '@/core/download/utils'
import { getLocalMusicList, scanLocalMusic, getTotalSize, deleteLocalMusic, updateLocalMusicMeta } from '@/core/localMusic'
import { readPic } from '@/utils/localMediaMetadata'
import { overwriteListMusics } from '@/core/list'
import listAction from '@/store/list/action'
import { playList } from '@/core/player/player'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { LIST_IDS, NAV_BAR_SPACE } from '@/config/constant'
import { useWindowSize } from '@/utils/hooks'

const LOCAL_LIST_ID = 'local_music'

/** 封面提取有开销，做一层串行队列 + 内存缓存 */
const picCache = new Map<string, string>()
let picQueue: Promise<unknown> = Promise.resolve()
const loadPic = async(filePath: string): Promise<string> => {
  const cached = picCache.get(filePath)
  if (cached) return cached
  picQueue = picQueue.then(async() => {
    return await readPic(filePath).catch(() => '')
  }).then(pic => {
    if (pic) picCache.set(filePath, pic)
    return pic
  })
  return picQueue as Promise<string>
}

const Cover = ({ item }: { item: LX.Music.MusicInfoLocal }) => {
  const theme = useTheme()
  const [uri, setUri] = useState<string | null>(() => picCache.get(item.meta.filePath) ?? null)

  useEffect(() => {
    let alive = true
    if (uri) return
    void loadPic(item.meta.filePath).then(pic => {
      if (alive && pic) setUri(pic)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.meta.filePath])

  return (
    <View style={{ ...styles.cover, backgroundColor: theme['c-primary-alpha-900'] }}>
      {
        uri
          ? <Image url={uri} style={styles.coverImg} />
          : <Icon name='music_time' size={18} color={theme['c-primary-light-200']} />
      }
    </View>
  )
}

export default ({ onClose }: { onClose?: () => void }) => {
  const theme = useTheme()
  const { height: windowHeight } = useWindowSize()
  const [list, setList] = useState<LX.Music.MusicInfoLocal[]>([])
  const [dir, setDir] = useState('')
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [inited, setInited] = useState(false)
  /** 分类方式：歌曲 / 专辑 / 歌手 / 文件夹（Poweramp 那种） */
  const [group, setGroup] = useState<'song' | 'album' | 'artist' | 'folder'>('song')
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

  /** id → 在原列表里的下标（分组后仍然按原列表播放） */
  const indexOfId = useMemo(() => {
    const map = new Map<string, number>()
    list.forEach((item, i) => { map.set(item.id, i) })
    return map
  }, [list])

  /** 文件夹名：取路径最后两段，够认又不至于太长 */
  const folderOf = (path: string) => {
    const idx = path.lastIndexOf('/')
    if (idx <= 0) return '根目录'
    const segs = path.slice(0, idx).split('/').filter(Boolean)
    return segs.slice(-2).join('/') || '根目录'
  }

  /** 扁平化成 [分组头, 歌曲, 歌曲, 分组头, ...]，同一个 FlatList 直接渲染 */
  const rows = useMemo(() => {
    type Row =
      | { type: 'header', key: string, title: string, count: number }
      | { type: 'song', key: string, item: LX.Music.MusicInfoLocal, index: number }

    if (group === 'song') {
      return list.map((item, i): Row => ({ type: 'song', key: item.id, item, index: i }))
    }

    const map = new Map<string, LX.Music.MusicInfoLocal[]>()
    for (const item of list) {
      const key = group === 'album'
        ? (item.meta.albumName || '未知专辑')
        : group === 'artist'
          ? (item.singer || '未知歌手')
          : folderOf(item.meta.filePath)
      const arr = map.get(key)
      if (arr) arr.push(item)
      else map.set(key, [item])
    }

    const out: Row[] = []
    const keys = [...map.keys()].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
    for (const key of keys) {
      const items = map.get(key)!
      out.push({ type: 'header', key: `h:${key}`, title: key, count: items.length })
      for (const item of items) {
        out.push({ type: 'song', key: item.id, item, index: indexOfId.get(item.id) ?? 0 })
      }
    }
    return out
  }, [group, list, indexOfId])

  // 下滑关闭：回到下载中心。
  // onClose 放进 ref：外层每次重渲染都会传新闭包，如果进 useMemo 依赖，
  // PanResponder 会在拖拽过程中被重建 → 手势直接失效（之前「怎么滑都没反应」的原因）
  const panY = useRef(new Animated.Value(0)).current
  const scrollY = useRef(0)
  const windowHeightRef = useRef(windowHeight)
  windowHeightRef.current = windowHeight
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const hasClose = !!onClose

  const closeWithSlide = useCallback(() => {
    Animated.timing(panY, {
      toValue: windowHeightRef.current,
      duration: 190,
      useNativeDriver: true,
    }).start(() => {
      panY.setValue(0)
      onCloseRef.current?.()
    })
  }, [panY])

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) => {
      if (!onCloseRef.current) return false
      if (g.dy <= 5 || Math.abs(g.dy) <= Math.abs(g.dx) * 1.1) return false
      // 列表在顶部 → 直接接管；任意位置快速下滑也接管
      return scrollY.current <= 2 || g.vy > 0.5
    },
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) panY.setValue(g.dy)
    },
    onPanResponderRelease: (_, g) => {
      if (!onCloseRef.current) return
      if (g.dy > 80 || g.vy > 0.4) {
        closeWithSlide()
      } else {
        Animated.spring(panY, { toValue: 0, useNativeDriver: true, friction: 9, tension: 120 }).start()
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start()
    },
  }), [closeWithSlide, panY])

  // 原生下拉手势：Android 的 ScrollView 会抢走 JS 侧的 responder，PanResponder 经常收不到，
  // 用 RefreshControl 兜住「列表顶部下拉 = 关闭」这条最常用的路径（指示器设成全透明）
  const refreshControl = useMemo(() => (
    hasClose
      ? (
        <RefreshControl
          refreshing={false}
          onRefresh={() => { closeWithSlide() }}
          colors={['transparent']}
          progressBackgroundColor='transparent'
          tintColor='transparent'
        />
        )
      : undefined
  ), [closeWithSlide, hasClose])

  // 兜底：列表顶部的快速下滑由原生滚动事件判定（PanResponder 在部分机型上抢不到手势）
  const handleScrollEndDrag = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!onCloseRef.current) return
    const { contentOffset, velocity } = e.nativeEvent
    if (contentOffset.y <= 0 && (velocity?.y ?? 0) < -0.3) closeWithSlide()
  }, [closeWithSlide])

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

  const handleDelete = useCallback(async(item: LX.Music.MusicInfoLocal, deleteFile: boolean) => {
    await deleteLocalMusic(item, deleteFile)
    const newList = await getLocalMusicList()
    setList(newList)
    toast(deleteFile ? '已删除文件和记录' : '已从列表移除')
  }, [])

  const [editingItem, setEditingItem] = useState<LX.Music.MusicInfoLocal | null>(null)

  const handleEdit = useCallback((item: LX.Music.MusicInfoLocal) => {
    setEditingItem(item)
  }, [])

  const handleSaveEdit = useCallback(async(name: string, singer: string, albumName: string) => {
    if (!editingItem) return
    await updateLocalMusicMeta(editingItem, { name, singer, albumName })
    const newList = await getLocalMusicList()
    setList(newList)
    setEditingItem(null)
    toast('已更新音乐信息')
  }, [editingItem])

  const renderItem = useCallback(({ item: row }: { item: { type: 'header', key: string, title: string, count: number } | { type: 'song', key: string, item: LX.Music.MusicInfoLocal, index: number } }) => {
    if (row.type === 'header') {
      return (
        <View style={styles.groupHeader}>
          <Icon name={group === 'album' ? 'album' : group === 'artist' ? 'account' : 'folder'} size={12} color={theme['c-primary']} />
          <Text size={12} numberOfLines={1} style={styles.groupTitle}>{row.title}</Text>
          <Text size={10} color={theme['c-450']} style={styles.groupCount}>{row.count} 首</Text>
        </View>
      )
    }
    const { item, index } = row
    return (
      <LocalRow
        item={item}
        index={index}
        onPress={() => { void handlePlay(index) }}
        onMenu={action => {
          if (action === 'play') void handlePlay(index)
          else if (action === 'playLater') handlePlayLater(item)
          else if (action === 'delete') void handleDelete(item, false)
          else if (action === 'deleteFile') void handleDelete(item, true)
          else if (action === 'edit') handleEdit(item)
        }}
      />
    )
  }, [group, theme, handlePlay, handlePlayLater, handleDelete, handleEdit])

  return (
    <Animated.View
      style={{ flex: 1, transform: [{ translateY: panY }] }}
      {...(hasClose ? panResponder.panHandlers : null)}
    >
      <View style={styles.container}>
      {/* 作为主 Tab 用时补一个统一页头；从下载中心弹出来时不需要（那个是整屏子页） */}
      {hasClose ? null : <PageHeader title='本地音乐' />}
      <View style={{
        ...styles.scanCard,
        backgroundColor: theme['c-primary-alpha-900'],
        borderColor: theme['c-primary-alpha-700'],
      }}>
        <View style={styles.scanInfo}>
          <View style={styles.scanTitleRow}>
            <Icon name='folder' size={13} color={theme['c-primary-light-200']} />
            <Text size={12} numberOfLines={1} style={styles.scanTitle}>{dir || '下载目录'}</Text>
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
          <Icon name='refresh' size={12} color='#FFFFFF' />
          <Text size={11} color='#FFFFFF' style={styles.scanBtnText}>{scanning ? '扫描中' : '重新扫描'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.groupRow}>
        {
          ([
            { key: 'song', label: '歌曲', icon: 'music-note' },
            { key: 'album', label: '专辑', icon: 'album' },
            { key: 'artist', label: '歌手', icon: 'account' },
            { key: 'folder', label: '文件夹', icon: 'folder' },
          ] as const).map(item => (
            <Chip
              key={item.key}
              size='sm'
              icon={item.icon}
              label={item.label}
              active={group === item.key}
              onPress={() => { if (group !== item.key) setGroup(item.key) }}
            />
          ))
        }
      </View>

      <FlatList
        data={rows}
        renderItem={renderItem}
        keyExtractor={row => row.key}
        contentContainerStyle={styles.listContent}
        scrollEventThrottle={32}
        onScroll={e => { scrollY.current = e.nativeEvent.contentOffset.y }}
        onScrollEndDrag={handleScrollEndDrag}
        refreshControl={refreshControl}
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

      <EditMusicModal
        item={editingItem}
        onClose={() => { setEditingItem(null) }}
        onSave={handleSaveEdit}
      />
      </View>
    </Animated.View>
  )
}

const LocalRow = ({ item, index, onPress, onMenu }: {
  item: LX.Music.MusicInfoLocal
  index: number
  onPress: () => void
  onMenu: (action: string) => void
}) => {
  const theme = useTheme()
  const menuRef = useRef<MenuType>(null)
  const menus = useMemo(() => [
    { action: 'play', label: '播放' },
    { action: 'playLater', label: '稍后播放' },
    { action: 'edit', label: '编辑信息' },
    { action: 'delete', label: '从列表移除' },
    { action: 'deleteFile', label: '删除文件' },
  ], [])

  const handleLongPress = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent
    // 直接用手指标记位置，让 Menu 自己夹到屏幕内（之前手动减 180 会把菜单推出屏幕左侧）
    menuRef.current?.show({ x: pageX, y: pageY, w: 0, h: 0 })
  }

  const meta = useMemo(() => {
    const rate = item.meta.sampleRate
      ? formatSampleRate(item.meta.sampleRate)
      : ''
    return [
      item.singer || '未知歌手',
      item.meta.ext.toUpperCase(),
      rate,
      item.meta.bitrate ? `${item.meta.bitrate} kbps` : '',
      item.interval,
      item.meta.size ? formatSize(item.meta.size) : '',
    ].filter(Boolean).join(' · ')
  }, [item])

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.rowMain}
        activeOpacity={0.7}
        onPress={onPress}
        onLongPress={handleLongPress}
        delayLongPress={320}
      >
        <Text size={11} color={theme['c-350']} style={styles.index}>{index + 1}</Text>
        <Cover item={item} />
        <View style={styles.info}>
          <Text size={14} numberOfLines={1}>{item.name}</Text>
          <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.meta}>{meta}</Text>
        </View>
      </TouchableOpacity>
      <DorpDownMenu menus={menus} onPress={menu => { onMenu(menu.action) }} btnStyle={styles.moreBtn}>
        <Icon name='dots-vertical' size={14} color={theme['c-350']} />
      </DorpDownMenu>
      <Menu ref={menuRef} menus={menus} onPress={menu => { onMenu(menu.action) }} />
    </View>
  )
}

const EditMusicModal = ({ item, onClose, onSave }: {
  item: LX.Music.MusicInfoLocal | null
  onClose: () => void
  onSave: (name: string, singer: string, albumName: string) => void
}) => {
  const theme = useTheme()
  const [name, setName] = useState('')
  const [singer, setSinger] = useState('')
  const [albumName, setAlbumName] = useState('')

  useEffect(() => {
    if (item) {
      setName(item.name || '')
      setSinger(item.singer || '')
      setAlbumName(item.meta.albumName || '')
    }
  }, [item])

  if (!item) return null

  return (
    <Modal visible transparent animationType='slide' onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={onClose}>
        <View style={{ ...editStyles.sheet, backgroundColor: theme['c-content-background'] }} onStartShouldSetResponder={() => true}>
          <Text size={15} style={editStyles.title}>编辑音乐信息</Text>
          <View style={editStyles.field}>
            <Text size={12} color={theme['c-450']} style={editStyles.label}>歌名</Text>
            <TextInput
              style={{ ...editStyles.input, backgroundColor: theme['c-primary-alpha-900'], color: theme['c-font'] }}
              value={name}
              onChangeText={setName}
              placeholder='输入歌名'
              placeholderTextColor={theme['c-350']}
            />
          </View>
          <View style={editStyles.field}>
            <Text size={12} color={theme['c-450']} style={editStyles.label}>歌手</Text>
            <TextInput
              style={{ ...editStyles.input, backgroundColor: theme['c-primary-alpha-900'], color: theme['c-font'] }}
              value={singer}
              onChangeText={setSinger}
              placeholder='输入歌手'
              placeholderTextColor={theme['c-350']}
            />
          </View>
          <View style={editStyles.field}>
            <Text size={12} color={theme['c-450']} style={editStyles.label}>专辑</Text>
            <TextInput
              style={{ ...editStyles.input, backgroundColor: theme['c-primary-alpha-900'], color: theme['c-font'] }}
              value={albumName}
              onChangeText={setAlbumName}
              placeholder='输入专辑名'
              placeholderTextColor={theme['c-350']}
            />
          </View>
          <View style={editStyles.btnRow}>
            <TouchableOpacity style={editStyles.btn} onPress={onClose}>
              <Text size={14} color={theme['c-450']}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ ...editStyles.btn, ...editStyles.saveBtn }} onPress={() => { onSave(name, singer, albumName) }}>
              <Text size={14} color='#FFFFFF'>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

const editStyles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  title: {
    fontWeight: '700',
    marginBottom: 18,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    marginBottom: 6,
  },
  input: {
    height: 42,
    borderRadius: 10,
    paddingLeft: 12,
    paddingRight: 12,
    fontSize: 14,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  btn: {
    paddingLeft: 18,
    paddingRight: 18,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 10,
  },
  saveBtn: {
    backgroundColor: '#6C5CE7',
    marginLeft: 10,
  },
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    marginRight: 16,
    marginTop: 4,
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
    height: 28,
    paddingLeft: 11,
    paddingRight: 12,
    borderRadius: 14,
  },
  scanBtnText: {
    marginLeft: 5,
    fontWeight: '600',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  groupTitle: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 6,
    fontWeight: '700',
  },
  groupCount: {
    marginLeft: 8,
  },
  listContent: {
    paddingTop: 10,
    // 悬浮导航会盖在列表上，内容滚动到底时要能露出最后一项
    paddingBottom: NAV_BAR_SPACE,
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
  index: {
    width: 22,
    textAlign: 'center',
    fontWeight: '600',
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  coverImg: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
  },
  meta: {
    marginTop: 4,
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
