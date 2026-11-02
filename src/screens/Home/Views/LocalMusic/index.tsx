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
import CoverPlaceholder from '@/components/common/CoverPlaceholder'
import PageHeader from '@/components/common/PageHeader'
import MiniTag from '@/components/common/MiniTag'
import Menu, { type MenuType } from '@/components/common/Menu'
import { useTheme } from '@/store/theme/hook'
import { contrastOn } from '@/theme/solid'
import { createStyle, toast } from '@/utils/tools'
import { formatSize, formatSampleRate } from '@/core/download/utils'
import { getLocalMusicList, scanLocalMusic, getTotalSize, deleteLocalMusic, updateLocalMusicMeta, getScanDirs, getExtraDirs, setExtraDirs, type ScanDir } from '@/core/localMusic'
import { pickDirectory, isDirectoryPickerSupported, readAudioMeta } from '@/utils/directoryPicker'
import { getData, saveData } from '@/plugins/storage'
import { readPic } from '@/utils/localMediaMetadata'
import { overwriteListMusics } from '@/core/list'
import listAction from '@/store/list/action'
import { playList } from '@/core/player/player'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { LIST_IDS, NAV_BAR_SPACE } from '@/config/constant'
import { useWindowSize } from '@/utils/hooks'

const LOCAL_LIST_ID = 'local_music'
/** 列表/卡片偏好的存储键 */
const VIEW_MODE_KEY = '@local_music_view_mode'
/** 授权失效的提示色（主题里没有 warning 语义色，这里固定一个在深浅底上都读得出来的琥珀色） */
const WARN_COLOR = '#E8A33D'

/** 浏览层级（Poweramp 那种：最近添加 / 专辑 / 艺人 / 文件夹树 / 全部） */
const TABS = [
  { key: 'song', label: '全部歌曲', icon: 'music-note' },
  { key: 'folder', label: '文件夹', icon: 'folder' },
  { key: 'album', label: '专辑', icon: 'album' },
  { key: 'artist', label: '艺人', icon: 'account' },
  { key: 'recent', label: '最近添加', icon: 'clock-outline' },
] as const

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

/** 确认过确实没有内嵌封面的文件，别再反复读 */
const noCoverSet = new Set<string>()

const Cover = ({ item }: { item: LX.Music.MusicInfoLocal }) => {
  const theme = useTheme()
  // MediaStore 条目自带 albumart 的 content:// 地址，直接用它（公共目录读不了文件）
  const [uri, setUri] = useState<string | null>(() => item.meta.picUrl ?? picCache.get(item.meta.filePath) ?? null)
  /** 抽取失败/图片加载失败后标记，用来切到首字占位 */
  const [failed, setFailed] = useState(false)
  /** 本轮是否已经尝试过抽取，避免 effect 反复跑 */
  const tried = useRef(false)
  /** 加载失败后允许重新抽一次（缓存被系统清掉时能自愈） */
  const recovered = useRef(false)

  /**
   * 惰性取封面：扫描时没抽到、或者抽出来的缓存文件已经失效，都在这里补一次。
   * - 应用私有目录：直接读文件
   * - 公共目录：用 SAF 文档 uri 抽内嵌封面（按路径打不开）
   * 抽不到就记进 noCoverSet，滚动重挂载时不再重复调用原生。
   */
  useEffect(() => {
    if (uri) return
    if (failed) return
    if (tried.current) return
    if (noCoverSet.has(item.meta.filePath)) return
    tried.current = true
    let alive = true
    const done = (pic: string | null) => {
      if (!alive) return
      if (pic) {
        picCache.set(item.meta.filePath, pic)
        setUri(pic)
        setFailed(false)
      } else {
        noCoverSet.add(item.meta.filePath)
      }
    }
    if (item.meta.filePath.includes('/Android/data/')) {
      void loadPic(item.meta.filePath).then(pic => { done(pic || null) }).catch(() => { done(null) })
      return () => { alive = false }
    }
    const contentUri = item.meta.contentUri
    if (!contentUri) {
      noCoverSet.add(item.meta.filePath)
      return
    }
    void readAudioMeta(contentUri)
      .then(meta => { done(meta?.cover ?? null) })
      .catch(() => { done(null) })
    return () => { alive = false }
  }, [item.meta.filePath, item.meta.contentUri, uri, failed])

  /** 图片加载失败：先给一次重新抽取的机会，再失败就落到首字占位 */
  const handleError = () => {
    if (!recovered.current) {
      recovered.current = true
      tried.current = false
      setUri(null)
      return
    }
    setFailed(true)
  }

  return (
    <View style={{ ...styles.cover, backgroundColor: theme['c-primary-alpha-900'] }}>
      {
        uri && !failed
          ? <Image url={uri} style={styles.coverImg} onError={handleError} />
          : <CoverPlaceholder name={item.name} size={56} radius={10} />
      }
    </View>
  )
}

export type LocalTab = 'recent' | 'album' | 'artist' | 'folder' | 'song'

export default ({ onClose, initialTab }: { onClose?: () => void, /** 打开时直接落到哪个页签（首页「最近添加歌曲」进来用） */ initialTab?: LocalTab }) => {
  const theme = useTheme()
  const { height: windowHeight } = useWindowSize()
  const [list, setList] = useState<LX.Music.MusicInfoLocal[]>([])
  const [dir, setDir] = useState('')
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [inited, setInited] = useState(false)
  /** 全部扫描根目录（默认下载目录 + 用户添加的） */
  const [dirs, setDirs] = useState<ScanDir[]>([])
  const [dirModal, setDirModal] = useState(false)
  const dirsRef = useRef<ScanDir[]>([])
  /** 浏览层级：最近添加 / 专辑 / 艺人 / 文件夹树 / 全部歌曲 */
  const [tab, setTab] = useState<LocalTab>(initialTab ?? 'song')
  /** 专辑 / 艺人的二级页 */
  const [detail, setDetail] = useState<{ type: 'album' | 'artist', title: string } | null>(null)
  /** 文件夹树当前目录（null = 根） */
  const [folderPath, setFolderPath] = useState<string | null>(null)
  /** 授权失效、需要用户重新选一次的目录 */
  const [needAuth, setNeedAuth] = useState<ScanDir[]>([])
  /** 歌曲行的呈现方式：列表 / 卡片（持久化，重进页面保持上次选择） */
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    void getData<'list' | 'card'>(VIEW_MODE_KEY).then(mode => {
      if (mode === 'list' || mode === 'card') setViewMode(mode)
    })
  }, [])

  const changeViewMode = useCallback((mode: 'list' | 'card') => {
    setViewMode(mode)
    void saveData(VIEW_MODE_KEY, mode)
  }, [])

  const handleScan = useCallback(async() => {
    if (scanning) return
    setScanning(true)
    setProgress(0)
    try {
      const result = await scanLocalMusic(
        count => {
          if (mountedRef.current) setProgress(count)
        },
        dirsRef.current.length ? dirsRef.current : undefined,
        // 列表边扫边出：先出文件名兜底版，标签补齐过程中持续刷新
        partial => {
          if (mountedRef.current) setList(partial)
        },
      )
      if (!mountedRef.current) return
      setList(result.list)
      setDir(result.dir)
      setDirs(result.dirs)
      setNeedAuth(result.needAuth)
      if (result.needAuth.length) {
        // 授权失效 / 从没授权过，扫出来永远是 0 首，只能让用户重选一次
        toast(`「${result.needAuth.map(d => baseNameOf(d.path) || d.path).join('、')}」需要重新授权才能扫描`)
      } else {
        toast(result.list.length ? `扫描完成，共 ${result.list.length} 首` : '没有找到音频文件')
      }
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
    void getScanDirs().then(list => {
      if (!mountedRef.current) return
      dirsRef.current = list
      setDirs(list)
    })
  }, [])

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

  const parentOf = (p: string) => {
    const i = p.lastIndexOf('/')
    return i <= 0 ? '/' : p.slice(0, i)
  }
  const baseNameOf = (p: string) => p.slice(p.lastIndexOf('/') + 1) || p

  /** 文件夹树：path -> { 本层歌曲, 子目录 } */
  const folderTree = useMemo(() => {
    const map = new Map<string, { songs: LX.Music.MusicInfoLocal[], children: Set<string> }>()
    const ensure = (p: string) => {
      let node = map.get(p)
      if (!node) {
        node = { songs: [], children: new Set() }
        map.set(p, node)
      }
      return node
    }
    for (const item of list) {
      const dir = parentOf(item.meta.filePath)
      ensure(dir).songs.push(item)
      let p = dir
      while (p && p !== '/') {
        const parent = parentOf(p)
        if (parent === p) break
        ensure(parent).children.add(p)
        p = parent
      }
    }
    return map
  }, [list])

  const rows = useMemo(() => {
    type Row =
      | { type: 'song', key: string, item: LX.Music.MusicInfoLocal, index: number }
      | { type: 'album', key: string, title: string, count: number, cover?: LX.Music.MusicInfoLocal }
      | { type: 'artist', key: string, title: string, count: number }
      | { type: 'folder', key: string, title: string, count: number, path: string }

    const toSongRow = (item: LX.Music.MusicInfoLocal, position?: number): Row => ({
      type: 'song',
      key: item.id,
      item,
      // 「全部歌曲」直接用数组下标，避免排序/刷新过程中 map 与列表顺序对不上导致序号错位
      index: position ?? indexOfId.get(item.id) ?? 0,
    })

    // 二级页：某张专辑 / 某个艺人的歌
    if (detail) {
      return list
        .filter(it => (detail.type === 'album'
          ? (it.meta.albumName || '未知专辑')
          : (it.singer || '未知歌手')) === detail.title)
        .map(item => toSongRow(item))
    }

    // 最近添加：按文件修改时间倒序
    if (tab === 'recent') {
      return [...list].sort((a, b) => (b.meta.mtime ?? 0) - (a.meta.mtime ?? 0)).map(item => toSongRow(item))
    }

    if (tab === 'song') return list.map((item, i) => toSongRow(item, i))

    // 文件夹：只列「直接装了歌」的目录（不再逐层钻），点进去就是这一层的歌
    if (tab === 'folder') {
      if (folderPath && folderTree.has(folderPath)) {
        return (folderTree.get(folderPath)?.songs ?? []).map(item => toSongRow(item))
      }
      return [...folderTree.entries()]
        .filter(([, node]) => node.songs.length > 0)
        .sort((a, b) => a[0].localeCompare(b[0], 'zh-Hans-CN'))
        .map(([path, node]): Row => ({
          type: 'folder',
          key: path,
          title: baseNameOf(path),
          count: node.songs.length,
          path,
        }))
    }

    // 专辑 / 艺人：先列分组，点进去看二级页
    const map = new Map<string, LX.Music.MusicInfoLocal[]>()
    for (const item of list) {
      const key = tab === 'album' ? (item.meta.albumName || '未知专辑') : (item.singer || '未知歌手')
      const arr = map.get(key)
      if (arr) arr.push(item)
      else map.set(key, [item])
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'zh-Hans-CN'))
      .map(([key, items]): Row => tab === 'album'
        ? { type: 'album', key, title: key, count: items.length, cover: items[0] }
        : { type: 'artist', key, title: key, count: items.length })
  }, [detail, tab, list, indexOfId, folderTree, folderPath])

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

  /** 添加一个扫描目录（系统目录选择器） */
  const handleAddDir = useCallback(async() => {
    try {
      const picked = await pickDirectory()
      if (!picked) return
      const extra = await getExtraDirs()
      const exist = extra.find(d => d.path === picked.path)
      if (exist?.treeUri) {
        toast('这个文件夹已经在扫描列表里了')
        return
      }
      // 老版本加进来的目录只有路径、没有 SAF 授权 —— 系统不索引它就永远扫不到，
      // 所以这里不拒绝，而是把授权补上
      await setExtraDirs(exist
        ? extra.map(d => d.path === picked.path ? { ...d, treeUri: picked.treeUri } : d)
        : [...extra, { path: picked.path, treeUri: picked.treeUri }])
      const next = await getScanDirs()
      dirsRef.current = next
      setDirs(next)
      toast(`已${exist ? '重新授权' : '添加'}「${picked.name}」，开始扫描…`)
      setDirModal(false)
      setScanning(false)
      void handleScan()
    } catch (e) {
      toast((e as Error)?.message ?? '选择文件夹失败')
    }
  }, [handleScan])

  /** 移除一个额外目录（默认下载目录不能删） */
  const handleRemoveDir = useCallback(async(path: string) => {
    const extra = await getExtraDirs()
    await setExtraDirs(extra.filter(d => d.path !== path))
    const next = await getScanDirs()
    dirsRef.current = next
    setDirs(next)
    toast('已移除，重新扫描中…')
    setScanning(false)
    void handleScan()
  }, [handleScan])

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

  const renderItem = useCallback(({ item: row }: { item:
  | { type: 'song', key: string, item: LX.Music.MusicInfoLocal, index: number }
  | { type: 'album', key: string, title: string, count: number, cover?: LX.Music.MusicInfoLocal }
  | { type: 'artist', key: string, title: string, count: number }
  | { type: 'folder', key: string, title: string, count: number, path: string } }) => {
    if (row.type === 'album') {
      return (
        <TouchableOpacity
          style={styles.groupRowItem}
          activeOpacity={0.7}
          onPress={() => { setDetail({ type: 'album', title: row.title }) }}
        >
          {row.cover ? <Cover item={row.cover} /> : <View style={styles.groupIcon}><Icon name='album' size={20} color={theme['c-primary']} /></View>}
          <View style={styles.groupInfo}>
            <Text size={14} numberOfLines={1}>{row.title}</Text>
            <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.groupMeta}>{row.count} 首</Text>
          </View>
          <Icon name='chevron-right' size={18} color={theme['c-350']} />
        </TouchableOpacity>
      )
    }
    if (row.type === 'artist') {
      return (
        <TouchableOpacity
          style={styles.groupRowItem}
          activeOpacity={0.7}
          onPress={() => { setDetail({ type: 'artist', title: row.title }) }}
        >
          <View style={{ ...styles.artistAvatar, backgroundColor: theme['c-primary-alpha-900'] }}>
            <Text size={17} color={theme['c-primary']} style={styles.artistInitial}>{row.title.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.groupInfo}>
            <Text size={14} numberOfLines={1}>{row.title}</Text>
            <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.groupMeta}>{row.count} 首</Text>
          </View>
          <Icon name='chevron-right' size={18} color={theme['c-350']} />
        </TouchableOpacity>
      )
    }
    if (row.type === 'folder') {
      return (
        <TouchableOpacity
          style={styles.groupRowItem}
          activeOpacity={0.7}
          onPress={() => { setFolderPath(row.path) }}
        >
          <View style={{ ...styles.folderIcon, backgroundColor: theme['c-primary-alpha-900'] }}>
            <Icon name='folder' size={22} color={theme['c-primary']} />
          </View>
          <View style={styles.groupInfo}>
            <Text size={14} numberOfLines={1}>{row.title}</Text>
            {/* 同名目录（比如两个 Download）光看名字分不清，把父目录一起带上 */}
            <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.groupMeta}>
              {row.count} 首 · {parentOf(row.path)}
            </Text>
          </View>
          <Icon name='chevron-right' size={18} color={theme['c-350']} />
        </TouchableOpacity>
      )
    }

    const { item, index } = row
    return (
      <LocalRow
        item={item}
        index={index}
        card={viewMode === 'card'}
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
  }, [theme, handlePlay, handlePlayLater, handleDelete, handleEdit, viewMode])

  /** 二级页「播放全部」：从这一组的第一首开始播 */
  const handlePlayGroup = useCallback(() => {
    const first = rows.find(r => r.type === 'song')
    if (first && first.type === 'song') void handlePlay(first.index)
  }, [rows, handlePlay])

  return (
    <Animated.View
      style={{ flex: 1, transform: [{ translateY: panY }] }}
      {...(hasClose ? panResponder.panHandlers : null)}
    >
      <View style={styles.container}>
      {/* 作为主 Tab 用时补一个统一页头；从下载中心弹出来时不需要（那个是整屏子页） */}
      {hasClose ? null : (
        <PageHeader
          title='本地音乐'
          subtitle={(
            <View style={styles.headerTags}>
              {list.length ? <MiniTag text={`${list.length} 首`} /> : null}
              {totalSize ? <MiniTag text={totalSize} /> : null}
            </View>
          )}
          right={(
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={{ ...styles.headerBtn, backgroundColor: theme['c-primary-alpha-900'] }}
                activeOpacity={0.8}
                onPress={() => { setDirModal(true) }}
              >
                <Icon name='folder-cog' size={20} color={theme['c-font']} />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ ...styles.headerBtn, backgroundColor: theme['c-primary-alpha-900'] }}
                activeOpacity={0.8}
                onPress={() => { void handleScan() }}
              >
                <Icon name='refresh' size={20} color={theme['c-font']} />
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  ...styles.headerBtn,
                  backgroundColor: viewMode === 'list' ? theme['c-primary'] : theme['c-primary-alpha-900'],
                }}
                activeOpacity={0.8}
                onPress={() => { changeViewMode('list') }}
              >
                <Icon name='format-list-bulleted' size={20} color={viewMode === 'list' ? contrastOn(theme['c-primary']) : theme['c-font']} />
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  ...styles.headerBtn,
                  backgroundColor: viewMode === 'card' ? theme['c-primary'] : theme['c-primary-alpha-900'],
                }}
                activeOpacity={0.8}
                onPress={() => { changeViewMode('card') }}
              >
                <Icon name='view-grid-outline' size={20} color={viewMode === 'card' ? contrastOn(theme['c-primary']) : theme['c-font']} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
      {
        (scanning || needAuth.length > 0)
          ? <View style={{
            ...styles.scanCard,
            backgroundColor: theme['c-primary-alpha-900'],
            borderColor: theme['c-primary-alpha-700'],
          }}>
        <View style={styles.scanInfo}>
          <Text size={12} numberOfLines={1}>
            {dirs.length > 1 ? `${dirs.length} 个目录` : (dir || '下载目录')}
          </Text>
          <Text
            size={11}
            color={needAuth.length ? WARN_COLOR : theme['c-450']}
            numberOfLines={1}
            style={styles.scanMeta}
          >
            {scanning
              ? `扫描中，已找到 ${progress} 首…`
              : needAuth.length
                ? `${list.length} 首 · ${needAuth.length} 个文件夹需重新授权`
                : `${list.length} 首 · ${totalSize}`}
          </Text>
        </View>
        <TouchableOpacity
          style={{
            ...styles.scanBtn,
            ...styles.scanBtnIconOnly,
            backgroundColor: theme['c-primary-alpha-800'],
            borderWidth: 0.5,
            borderColor: theme['c-primary-alpha-600'],
          }}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          activeOpacity={0.8}
          onPress={() => { setDirModal(true) }}
        >
          {/* 只放图标：「文件夹」三个字会把左边的目录数/统计挤到只剩 4 个字 */}
          <Icon name='folder-cog' size={14} color={theme['c-primary']} />
          {needAuth.length ? <View style={{ ...styles.warnDot, backgroundColor: WARN_COLOR }} /> : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={{ ...styles.scanBtn, backgroundColor: theme['c-primary'], opacity: scanning ? 0.6 : 1, marginLeft: 8 }}
          disabled={scanning}
          onPress={() => { void handleScan() }}
        >
          <Icon name='refresh' size={12} color={contrastOn(theme['c-primary'])} />
          <Text size={11} color={contrastOn(theme['c-primary'])} style={styles.scanBtnText}>{scanning ? '扫描中' : '扫描'}</Text>
        </TouchableOpacity>
      </View>
          : null
      }

      {
        detail
          ? (
            <View style={styles.detailBar}>
              <TouchableOpacity
                onPress={() => { setDetail(null) }}
                style={styles.detailBack}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name='chevron-left' size={20} color={theme['c-font']} />
              </TouchableOpacity>
              <View style={styles.detailInfo}>
                <Text size={15} numberOfLines={1} style={styles.detailTitle}>{detail.title}</Text>
                <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.groupMeta}>
                  {detail.type === 'album' ? '专辑' : '艺人'} · {rows.length} 首
                </Text>
              </View>
              <TouchableOpacity
                onPress={handlePlayGroup}
                style={{ ...styles.playAll, backgroundColor: theme['c-primary'] }}
                activeOpacity={0.85}
              >
                <Icon name='play' size={12} color={contrastOn(theme['c-primary'])} />
                <Text size={11} color={contrastOn(theme['c-primary'])} style={styles.playAllText}>播放全部</Text>
              </TouchableOpacity>
            </View>
            )
          : (
            <View style={styles.tabBar}>
              <View style={styles.tabRow}>
                {
                  TABS.map(item => {
                    const active = tab === item.key
                    return (
                      <TouchableOpacity
                        key={item.key}
                        activeOpacity={0.8}
                        style={{
                          ...styles.tabItem,
                          backgroundColor: active ? theme['c-primary'] : theme['c-primary-alpha-900'],
                          borderColor: active ? theme['c-primary'] : theme['c-primary-alpha-700'],
                        }}
                        onPress={() => {
                          if (active) return
                          setTab(item.key)
                          setFolderPath(null)
                        }}
                      >
                        <Text size={11} color={active ? contrastOn(theme['c-primary']) : theme['c-450']} numberOfLines={1}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })
                }
              </View>
            </View>
            )
      }

      {
        !detail && tab === 'folder' && folderPath
          ? (
            <View style={styles.crumbRow}>
              <TouchableOpacity
                onPress={() => { setFolderPath(null) }}
                style={styles.crumbBack}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name='chevron-left' size={16} color={theme['c-primary']} />
              </TouchableOpacity>
              <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.crumbText}>{folderPath}</Text>
            </View>
            )
          : null
      }

      <FlatList
        data={rows}
        renderItem={renderItem}
        keyExtractor={row => row.key}
        contentContainerStyle={styles.listContent}
        /*
          FlatList 默认只渲染 10 条（initialNumToRender 默认值），列表长了就会出现
          「只显示 10 首、往下滑是空的」—— 这个列表最多几百条，直接一次渲染完。
        */
        initialNumToRender={Math.max(20, rows.length)}
        maxToRenderPerBatch={Math.max(20, rows.length)}
        windowSize={41}
        removeClippedSubviews={false}
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

      {/* 扫描文件夹管理 */}
      <Modal visible={dirModal} transparent animationType='slide' onRequestClose={() => { setDirModal(false) }}>
        <TouchableOpacity
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}
          activeOpacity={1}
          onPress={() => { setDirModal(false) }}
        >
          <View
            style={{ ...editStyles.sheet, backgroundColor: theme['c-content-background'] }}
            onStartShouldSetResponder={() => true}
          >
            <Text size={15} style={editStyles.title}>扫描文件夹</Text>
            {
              dirs.map(d => {
                const invalid = needAuth.some(n => n.path === d.path)
                return (
                  <TouchableOpacity
                    key={d.path}
                    style={styles.dirRow}
                    activeOpacity={invalid ? 0.6 : 1}
                    disabled={!invalid}
                    onPress={() => { void handleAddDir() }}
                  >
                    <Icon
                      name={invalid ? 'folder-alert-outline' : 'folder'}
                      size={16}
                      color={invalid ? WARN_COLOR : theme['c-primary']}
                    />
                    <View style={styles.dirInfo}>
                      <Text size={13} numberOfLines={1}>{baseNameOf(d.path) || d.path}</Text>
                      <Text
                        size={10}
                        color={invalid ? WARN_COLOR : theme['c-450']}
                        numberOfLines={1}
                        style={styles.dirPath}
                      >
                        {invalid
                          ? '授权已失效，点这里重新选择'
                          : `${d.path}${d.treeUri ? '' : '（仅系统索引）'}`}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => { void handleRemoveDir(d.path) }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon name='close-circle' size={18} color={theme['c-450']} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )
              })
            }
            {
              isDirectoryPickerSupported
                ? (
                  <TouchableOpacity
                    style={{ ...styles.addDirBtn, backgroundColor: theme['c-primary'] }}
                    activeOpacity={0.85}
                    onPress={() => { void handleAddDir() }}
                  >
                    <Icon name='folder-plus' size={14} color={contrastOn(theme['c-primary'])} />
                    <Text size={13} color={contrastOn(theme['c-primary'])} style={styles.addDirText}>添加文件夹</Text>
                  </TouchableOpacity>
                  )
                : <Text size={11} color={theme['c-450']} style={styles.dirTip}>当前版本不支持选择目录</Text>
            }
            <Text size={10} color={theme['c-450']} style={styles.dirTip}>
              添加的目录会和默认下载目录一起扫描；如果提示目录不可读，请在系统设置里给本应用「音乐和音频」权限。
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
      </View>
    </Animated.View>
  )
}

const LocalRow = ({ item, index, card = false, onPress, onMenu }: {
  item: LX.Music.MusicInfoLocal
  index: number
  /** 卡片模式：带边框底色的独立卡片（和搜索/排行榜的「卡片」同一套 token） */
  card?: boolean
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

  /** 第二行：歌手 - 专辑 */
  const subLine = useMemo(() => {
    return [item.singer || '未知歌手', item.meta.albumName].filter(Boolean).join(' - ')
  }, [item])
  /** 第三行：采样率（精简成 44.1k，小标签放得下） */
  const rate = useMemo(() => {
    return item.meta.sampleRate
      ? formatSampleRate(item.meta.sampleRate)
      : ''
  }, [item])

  return (
    <View style={card
      ? {
          ...styles.cardRow,
          backgroundColor: theme['c-primary-alpha-900'],
          borderColor: theme['c-primary-alpha-700'],
        }
      : styles.row}>
      <TouchableOpacity
        style={card ? styles.cardMain : styles.rowMain}
        activeOpacity={0.7}
        onPress={onPress}
        onLongPress={handleLongPress}
        delayLongPress={320}
      >
        {card ? null : <Text size={11} color={theme['c-350']} style={styles.index}>{index + 1}</Text>}
        <Cover item={item} />
        <View style={styles.info}>
          <Text size={15} numberOfLines={1} style={styles.name}>{item.name}</Text>
          <Text size={11.5} color={theme['c-450']} numberOfLines={1} style={styles.meta}>{subLine}</Text>
          <View style={styles.thirdRow}>
            {item.interval ? <MiniTag text={item.interval} /> : null}
            <MiniTag text={item.meta.ext.toUpperCase()} />
            {rate ? <MiniTag text={rate} /> : null}
            {item.meta.bitrate ? <MiniTag text={`${item.meta.bitrate}kbps`} /> : null}
          </View>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTags: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
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
    // flexBasis: 0 + minWidth: 0 才能让中间那行文字真正让位，
    // 否则 auto 基准宽度会把右边的两个按钮顶出屏幕
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    paddingRight: 10,
  },
  scanMeta: {
    marginTop: 5,
  },
  scanBtn: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingLeft: 11,
    paddingRight: 12,
    borderRadius: 14,
  },
  /** 纯图标按钮：正方形，给左边的文字让出宽度 */
  scanBtnIconOnly: {
    paddingLeft: 8,
    paddingRight: 8,
    width: 30,
    justifyContent: 'center',
  },
  scanBtnText: {
    marginLeft: 5,
    fontWeight: '600',
  },
  /** 「文件夹」按钮上的授权失效小红点 */
  warnDot: {
    position: 'absolute',
    top: 3,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  /** 页签 + 列表/卡片分段控件同处一行 */
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmentWrap: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
    marginRight: 16,
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 2,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    paddingLeft: 8,
    paddingRight: 9,
    borderRadius: 12,
  },
  segmentText: {
    marginLeft: 3,
    fontWeight: '600',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 14,
    marginRight: 14,
    marginTop: 5,
    marginBottom: 5,
    paddingRight: 6,
    borderRadius: 14,
    borderWidth: 0.5,
  },
  cardMain: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  tabScroll: {
    // 和右侧的「列表/卡片」同处一行，所以要能横向伸缩
    flexGrow: 1,
    flexShrink: 1,
  },
  tabItem: {
    flex: 1,
    height: 28,
    marginHorizontal: 2,
    borderRadius: 14,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  detailBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  detailBack: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailInfo: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 8,
  },
  detailTitle: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  playAll: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: 14,
  },
  playAllText: {
    marginLeft: 4,
    fontWeight: '600',
  },
  crumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 16,
    paddingBottom: 2,
  },
  crumbBack: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crumbText: {
    flexShrink: 1,
    marginLeft: 2,
  },
  groupRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 14,
    paddingTop: 8,
    paddingBottom: 8,
  },
  groupInfo: {
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 12,
    paddingRight: 8,
  },
  groupMeta: {
    marginTop: 3,
  },
  groupIcon: {
    width: 46,
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artistAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artistInitial: {
    fontWeight: '800',
  },
  folderIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dirRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
  },
  dirInfo: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 10,
    marginRight: 10,
  },
  dirPath: {
    marginTop: 2,
  },
  addDirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 22,
    marginTop: 12,
  },
  addDirText: {
    marginLeft: 6,
    fontWeight: '600',
  },
  dirTip: {
    marginTop: 10,
    lineHeight: 16,
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
    width: 56,
    height: 56,
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
  name: {
    fontWeight: '600',
  },
  thirdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  third: {
    marginLeft: 4,
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
