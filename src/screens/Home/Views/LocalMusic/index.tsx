import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, memo } from 'react'
import {
  Alert,
  Animated,
  FlatList,
  PanResponder,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Clipboard from '@react-native-clipboard/clipboard'
import PageHeader from '@/components/common/PageHeader'
import MiniTag from '@/components/common/MiniTag'
import ListMusicAdd, { type MusicAddModalType } from '@/components/MusicAddModal'
import { useTheme } from '@/store/theme/hook'
import { contrastOn } from '@/theme/solid'
import { createStyle, toast } from '@/utils/tools'
import { formatSize, formatSampleRate } from '@/core/download/utils'
import { getLocalMusicList, getScanPartialList, subscribeScanPartialList, scanLocalMusicInBackground, isScanning, useScanState, getTotalSize, deleteLocalMusic, getScanDirs, getExtraDirs, setExtraDirs, type ScanDir } from '@/core/localMusic'
import { pickDirectory, isDirectoryPickerSupported } from '@/utils/directoryPicker'
import { getData, saveData } from '@/plugins/storage'
import { cleanSongName } from '@/utils/songName'
import { addListMusics, getListMusics, overwriteListMusics, removeListMusics } from '@/core/list'
import listAction from '@/store/list/action'
import settingState from '@/store/setting/state'
import { playList } from '@/core/player/player'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { LIST_IDS, NAV_BAR_SPACE } from '@/config/constant'
import { useWindowSize } from '@/utils/hooks'
import { CoverImage } from './cover'
import SongActionSheet, { type SongAction } from './SongActionSheet'
import SongInfoPage from './SongInfoPage'

const LOCAL_LIST_ID = 'local_music'
/** 列表/卡片偏好的存储键 */
const VIEW_MODE_KEY = '@local_music_view_mode'
/** 授权失效的提示色（主题里没有 warning 语义色，这里固定一个在深浅底上都读得出来的琥珀色） */
const WARN_COLOR = '#E8A33D'
/**
 * 列表初始挂载行数上限。
 *
 * 本工程的 VirtualizedList 有「只渲染 initialNumToRender 这一批、滚动不再补」
 * 的坑（详见 components/OnlineList/List.tsx 里的注释），所以这里按当前行数
 * 给初始批次：233 首一次全挂上，从头滚到尾都不会空白。
 * 曲库可能上千首，一帧挂几千行会把主线程堵死，所以封顶 600 行，
 * 超出的部分交给虚拟化按批补（正常滚动时会补，只是不能指望它兜底）。
 */
const MAX_INITIAL_ROWS = 600
/** 滚动时每批补多少行（比 RN 默认的 10 大，快滑时不容易出现空白） */
const MAX_RENDER_BATCH = 40

/** 浏览层级（Poweramp 那种：最近添加 / 专辑 / 艺人 / 文件夹树 / 全部） */
const TABS = [
  { key: 'song', label: '全部歌曲', icon: 'music-note' },
  { key: 'folder', label: '文件夹', icon: 'folder' },
  { key: 'album', label: '专辑', icon: 'album' },
  { key: 'artist', label: '艺人', icon: 'account' },
  { key: 'recent', label: '最近添加', icon: 'clock-outline' },
] as const

/** 页签按钮单独抽出来：内联渲染时每次切页整排都会重渲染，切起来发涩 */
const TabButton = memo(({ label, active, onPress }: {
  label: string
  active: boolean
  onPress: () => void
}) => {
  const theme = useTheme()
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={{
        ...styles.tabItem,
        backgroundColor: active ? theme['c-primary'] : theme['c-primary-alpha-900'],
        borderColor: active ? theme['c-primary'] : theme['c-primary-alpha-700'],
      }}
      onPress={onPress}
    >
      <Text size={11} color={active ? contrastOn(theme['c-primary']) : theme['c-450']} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  )
})

/**
 * 列表里的封面：真正的实现在 ./cover（更多 Sheet、歌曲信息页也要共用同一份 picCache，
 * 不能各写一份重复抽原生封面）。这里只是保留列表里的固定右边距。
 */
const Cover = ({ item, size = 56, round = false }: {
  item: LX.Music.MusicInfoLocal
  size?: number
  /** 艺人头像用圆形 */
  round?: boolean
}) => <CoverImage item={item} size={size} round={round} style={{ marginRight: 12 }} />

export type LocalTab = 'recent' | 'album' | 'artist' | 'folder' | 'song'

export default ({ onClose, initialTab }: { onClose?: () => void, /** 打开时直接落到哪个页签（首页「最近添加歌曲」进来用） */ initialTab?: LocalTab }) => {
  const theme = useTheme()
  const { height: windowHeight } = useWindowSize()
  const [list, setList] = useState<LX.Music.MusicInfoLocal[]>([])
  const [dir, setDir] = useState('')
  // 扫描状态来自 core（后台扫描，组件卸载也不中断）
  const { scanning, progress } = useScanState()
  const [inited, setInited] = useState(false)
  /** 全部扫描根目录（默认下载目录 + 用户添加的） */
  const [dirs, setDirs] = useState<ScanDir[]>([])
  const [dirModal, setDirModal] = useState(false)
  const dirsRef = useRef<ScanDir[]>([])
  /** 浏览层级：最近添加 / 专辑 / 艺人 / 文件夹树 / 全部歌曲 */
  const [tab, setTab] = useState<LocalTab>(initialTab ?? 'song')
  /**
   * 列表用「延迟版」的页签：
   * 切页签要重建几百行 + 拉几十张封面，同步做会把主线程占满（点了像卡住）。
   * 页签高亮走即时状态，列表重建走低优先级渲染，点下去先看到按钮变化。
   */
  const deferredTab = useDeferredValue(tab)
  /** 专辑 / 艺人的二级页 */
  const [detail, setDetail] = useState<{ type: 'album' | 'artist', title: string } | null>(null)
  /** 文件夹树当前目录（null = 根） */
  const [folderPath, setFolderPath] = useState<string | null>(null)
  /** 授权失效、需要用户重新选一次的目录 */
  const [needAuth, setNeedAuth] = useState<ScanDir[]>([])
  /** 歌曲行的呈现方式：列表 / 卡片（持久化，重进页面保持上次选择） */
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list')
  const mountedRef = useRef(true)
  /**
   * 是否已经从「事件 / 扫描结果」拿到过比缓存读取更新的列表。
   * 挂载时读缓存是异步的，可能比扫描结束的事件还晚返回；
   * 没有这个标记的话，慢一步的旧缓存会把刚刷新的新列表覆盖回去。
   */
  const freshListRef = useRef(false)
  /** 挂载时那次「读缓存」是否已经有结果（在此之前不能拿扫描中的半成品覆盖它） */
  const cacheReadDoneRef = useRef(false)
  /** 当前列表是不是「本次扫描的半成品」（是的话就要继续跟着半成品刷新标签） */
  const partialOwnedRef = useRef(false)

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
    if (isScanning()) return
    try {
      /*
        后台静默扫描：扫描过程完全在 core 层跑，不依赖这个组件是否挂载。
        之前是组件里 setState + 每补完一首就推一次全量列表（186 首 = 186 次重渲染），
        扫到一半滑到别的页就卡死黑屏。
        现在 core 在扫描期间通过本地订阅节流推送「文件名兜底版 + 补标签进度」（见下面的 effect），
        扫描结束 / 失败 / 被打断时 cachedList 都不会被半成品覆盖。
      */
      // 每次扫描前重新取目录：下载目录改到别处后，这里要自动跟上，
      // 不能继续用页面挂载时缓存的旧目录
      const currentDirs = await getScanDirs()
      dirsRef.current = currentDirs
      setDirs(currentDirs)
      const result = await scanLocalMusicInBackground(currentDirs)
      if (!result) return
      if (!mountedRef.current) return
      // 复制一份再进 state：result.list 是 core 的内部数组，
      // 直接塞进 state 的话 core 后续原地改它，页面就不会重渲染了
      freshListRef.current = true
      partialOwnedRef.current = false
      setList([...result.list])
      setDir(result.dir)
      setDirs(result.dirs)
      setNeedAuth(result.needAuth)
      setInited(true)
      if (result.needAuth.length) {
        // 授权失效 / 从没授权过，扫出来永远是 0 首，只能让用户重选一次
        toast(`「${result.needAuth.map(d => baseNameOf(d.path) || d.path).join('、')}」需要重新授权才能扫描`)
      } else {
        toast(result.list.length ? `扫描完成，共 ${result.list.length} 首` : '没有找到音频文件')
      }
    } catch {
      if (!mountedRef.current) return
      toast('扫描失败，请检查目录权限')
      // 扫描失败 / 被打断时 core 里仍然是上一次的完整列表，
      // 读回来覆盖掉页面上可能已经刷成半成品的增量数据
      const cached = await getLocalMusicList()
      if (!mountedRef.current) return
      freshListRef.current = true
      partialOwnedRef.current = false
      setList(cached)
      setInited(true)
    }
  }, [])

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
      cacheReadDoneRef.current = true
      // 扫描结束 / 工具补封面等事件可能已经先把新列表推进来了，别用慢一步的旧缓存盖回去
      if (freshListRef.current) return
      if (cached.length) {
        // 这里拿到的已经是副本（core 保证），直接进 state 不会被 core 后续原地改动影响
        partialOwnedRef.current = false
        setList(cached)
        setInited(true)
      } else {
        void handleScan()
      }
    })
  }, [handleScan])

  // 音乐工具补封面 / 其他页面改元信息 / 后台扫描完成都会发这个事件，
  // 页面挂载着的时候直接跟着刷新，不用等用户手动重扫
  useEffect(() => {
    const handleUpdated = (updated: LX.Music.MusicInfoLocal[]) => {
      if (!mountedRef.current) return
      /*
        复制后再 setList。两个原因：
        1. 事件里的数组虽然 core 已经复制过一层，但页面 state 绝不持有 core 的数组
           （两段式扫描补标签期间会原地改它，等于隔空改 state，React 收不到通知）；
        2. 必须是**新引用**：`setList(和当前 state 相同的数组)` 会被 React 判为没变、
           直接 bail out 不重渲染 —— 这正是扫描结束后列表停在半成品的原因。
      */
      freshListRef.current = true
      partialOwnedRef.current = false
      setList([...updated])
    }
    global.state_event.on('localMusicUpdated', handleUpdated)
    return () => {
      global.state_event.off('localMusicUpdated', handleUpdated)
    }
  }, [])

  /**
   * 扫描中的「半成品」列表：core 专门的本地订阅，不走全局事件
   * （全局事件首页也在听，扫描期间每 800ms 广播一次会让首页跟着重渲染，
   *   上一版「扫描中切页黑屏」就是那么来的）。
   *
   * 只在曲库还是空的时候才用半成品：首次扫描要能边扫边出歌，
   * 但「重新扫描 / 新加了目录」时（已有完整列表）不要用缺标签的半成品打断用户，
   * 等扫描结束那一次事件把完整结果推上来即可。
   */
  useEffect(() => {
    const applyPartial = () => {
      if (!mountedRef.current || !cacheReadDoneRef.current) return
      const partial = getScanPartialList()
      if (!partial) return
      setList(prev => {
        // 只有「曲库还是空的」或者「当前显示的就是本次扫描的半成品」才吃半成品：
        // - 首次扫描：边扫边出歌，标签补上一条就刷一条；
        // - 重新扫描 / 新加目录（已有完整列表）：不要用缺标签的半成品打断用户，
        //   等扫描结束那一次事件把完整结果推上来；
        // - 返回同一个引用时 React 直接 bail out，这种情况下零成本。
        if (prev.length && !partialOwnedRef.current) return prev
        partialOwnedRef.current = true
        freshListRef.current = true
        return [...partial]
      })
    }
    // 挂载时如果扫描已经跑到一半（比如从首页弹层重新打开），先对齐当前进度
    applyPartial()
    return subscribeScanPartialList(applyPartial)
  }, [])

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
      | { type: 'artist', key: string, title: string, count: number, cover?: LX.Music.MusicInfoLocal }
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
    if (deferredTab === 'recent') {
      return [...list].sort((a, b) => (b.meta.mtime ?? 0) - (a.meta.mtime ?? 0)).map(item => toSongRow(item))
    }

    if (deferredTab === 'song') return list.map((item, i) => toSongRow(item, i))

    // 文件夹：只列「直接装了歌」的目录（不再逐层钻），点进去就是这一层的歌
    if (deferredTab === 'folder') {
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
      const key = deferredTab === 'album' ? (item.meta.albumName || '未知专辑') : (item.singer || '未知歌手')
      const arr = map.get(key)
      if (arr) arr.push(item)
      else map.set(key, [item])
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'zh-Hans-CN'))
      .map(([key, items]): Row => deferredTab === 'album'
        ? { type: 'album', key, title: key, count: items.length, cover: items[0] }
        // 艺人头像直接借这个艺人第一首有封面的歌，没有封面就用首字圆形占位
        : { type: 'artist', key, title: key, count: items.length, cover: items.find(it => it.meta.picUrl) ?? items[0] })
  }, [detail, deferredTab, list, indexOfId, folderTree, folderPath])

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
    void handleScan()
  }, [handleScan])

  const handleDelete = useCallback(async(item: LX.Music.MusicInfoLocal, deleteFile: boolean) => {
    try {
      await deleteLocalMusic(item, deleteFile)
      const newList = await getLocalMusicList()
      setList(newList)
      toast(deleteFile ? '已删除文件和记录' : '已从列表移除')
    } catch (err) {
      // 文件删不掉时不要把记录也删了，否则列表和磁盘对不上
      toast(`删除失败：${(err as Error)?.message ?? '文件被占用或无权限'}`)
    }
  }, [])

  /**
   * 「更多」Sheet / 歌曲信息页的当前歌曲。
   *
   * 不再用旧的 DorpDownMenu + Menu 两条弹窗路径：飞牛音乐的更多菜单是底部 Sheet，
   * 点行尾 ⋮ 和长按都走这里（见 LocalRow 的 onMore）。
   */
  const [sheetItem, setSheetItem] = useState<LX.Music.MusicInfoLocal | null>(null)
  const [sheetVisible, setSheetVisible] = useState(false)
  /** 打开 Sheet 时异步查一次「是否已收藏」，菜单里的文案要在收藏/取消收藏之间切换 */
  const [sheetLoved, setSheetLoved] = useState(false)
  /** 歌曲信息页当前歌曲（null = 关闭） */
  const [infoItem, setInfoItem] = useState<LX.Music.MusicInfoLocal | null>(null)
  /** 「添加到歌单」弹窗（复用全局的 MusicAddModal） */
  const musicAddRef = useRef<MusicAddModalType>(null)

  /**
   * 行的点击 / 菜单回调做成稳定引用，
   * 这样 LocalRow 的 memo 才生效（否则每次渲染都传新闭包，等于没 memo）。
   */
  const handleRowPress = useCallback((item: LX.Music.MusicInfoLocal, index: number) => {
    void handlePlay(index)
  }, [handlePlay])

  const handleOpenSheet = useCallback((item: LX.Music.MusicInfoLocal) => {
    setSheetItem(item)
    setSheetVisible(true)
    void getListMusics(LIST_IDS.LOVE)
      .then(list => { setSheetLoved(list.some(music => music.id === item.id)) })
      .catch(() => { setSheetLoved(false) })
  }, [])

  const handleSheetAction = useCallback((action: SongAction) => {
    const item = sheetItem
    if (!item) return
    setSheetVisible(false)
    const index = indexOfId.get(item.id) ?? 0
    switch (action) {
      case 'play':
        void handlePlay(index)
        break
      case 'playNext':
        // isTop 会插到「稍后播放」列表头部，playNext 取头部 → 就是下一首播放
        addTempPlayList([{ listId: '', musicInfo: item, isTop: true }])
        toast('已设为下一首播放')
        break
      case 'addToPlaylist':
        addTempPlayList([{ listId: '', musicInfo: item }])
        toast('已加入播放列表')
        break
      case 'toggleLove':
        void (async() => {
          try {
            if (sheetLoved) {
              await removeListMusics(LIST_IDS.LOVE, [item.id])
              toast('已取消收藏')
            } else {
              await addListMusics(LIST_IDS.LOVE, [item], settingState.setting['list.addMusicLocationType'])
              toast('已收藏')
            }
            setSheetLoved(!sheetLoved)
          } catch {
            toast('操作失败，请稍后重试')
          }
        })()
        break
      case 'addToSonglist':
        musicAddRef.current?.show({ musicInfo: item, listId: '', isMove: false })
        break
      case 'album':
        setTab('album')
        setFolderPath(null)
        setDetail({ type: 'album', title: item.meta.albumName || '未知专辑' })
        break
      case 'artist':
        setTab('artist')
        setFolderPath(null)
        setDetail({ type: 'artist', title: item.singer || '未知歌手' })
        break
      case 'songInfo':
        setInfoItem(item)
        break
      case 'showPath': {
        const path = item.meta.filePath ?? ''
        if (!path) { toast('这首歌没有文件路径'); return }
        Clipboard.setString(path)
        toast(`路径已复制：${path}`)
        break
      }
      case 'removeFromList':
        void handleDelete(item, false)
        break
      case 'deleteFile':
        Alert.alert(
          '删除文件',
          `确定删除「${cleanSongName(item.name, item.singer)}」的文件吗？此操作不可恢复。`,
          [
            { text: '取消', style: 'cancel' },
            { text: '删除', style: 'destructive', onPress: () => { void handleDelete(item, true) } },
          ],
        )
        break
    }
  }, [sheetItem, sheetLoved, indexOfId, handlePlay, handleDelete])

  const renderItem = useCallback(({ item: row }: { item:
  | { type: 'song', key: string, item: LX.Music.MusicInfoLocal, index: number }
  | { type: 'album', key: string, title: string, count: number, cover?: LX.Music.MusicInfoLocal }
  | { type: 'artist', key: string, title: string, count: number, cover?: LX.Music.MusicInfoLocal }
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
          {
            row.cover
              ? <Cover item={row.cover} size={46} round />
              : (
                <View style={{ ...styles.artistAvatar, backgroundColor: theme['c-primary-alpha-900'] }}>
                  <Text size={17} color={theme['c-primary']} style={styles.artistInitial}>{row.title.slice(0, 1).toUpperCase()}</Text>
                </View>
                )
          }
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
        onPress={handleRowPress}
        onMore={handleOpenSheet}
      />
    )
  }, [theme, handleRowPress, handleOpenSheet, viewMode])

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
              {totalSize ? <MiniTag text={totalSize.replace(/\s+/g, '')} /> : null}
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
                accessibilityLabel='扫描'
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
                  TABS.map(item => (
                    <TabButton
                      key={item.key}
                      label={item.label}
                      active={tab === item.key}
                      onPress={() => {
                        if (tab === item.key) return
                        setTab(item.key)
                        setFolderPath(null)
                        setDetail(null)
                      }}
                    />
                  ))
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
          本工程 VirtualizedList 有「只渲染初始批次、滚动不补」的坑
          （见 components/OnlineList/List.tsx 的注释，线上已经踩过一次），
          所以初始批次直接按当前行数给：233 首一次挂载完，从头滚到尾都不会空白，
          切页签 / 扫描完成 / 补封面之后也不会「只显示十几首」。

          性能取舍：全量挂载的那一帧要建几百个行组件，但封面是懒加载
          （picCache + 同时最多 2 个原生抽取），不会一次压上几百个原生任务；
          旧版把 initialNumToRender 设成 rows.length 会卡，根因不在初始批次本身，
          而在「扫描期间推全量新数组」让整表反复重建 —— 那个已经在 core 里修掉
          （快照节流 800ms、只给本地音乐页、行组件 memo 靠对象引用跳过没变的行）。
          曲库上千首时封顶 600 行，剩下的交给虚拟化按批补，
          避免一帧挂几千行把主线程堵死。
        */
        initialNumToRender={Math.min(rows.length, MAX_INITIAL_ROWS)}
        maxToRenderPerBatch={MAX_RENDER_BATCH}
        updateCellsBatchingPeriod={40}
        windowSize={21}
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

      {/* 单曲「更多」：飞牛音乐风格底部 Sheet */}
      <SongActionSheet
        visible={sheetVisible}
        item={sheetItem}
        loved={sheetLoved}
        onClose={() => { setSheetVisible(false); setSheetItem(null) }}
        onAction={handleSheetAction}
      />

      {/* 歌曲信息（查看 / 编辑） */}
      <SongInfoPage
        item={infoItem}
        onClose={() => {
          setInfoItem(null)
          // 保存成功后曲库会通过 localMusicUpdated 推新数据，这里再兜一次
          void getLocalMusicList().then(newList => { setList(newList) })
        }}
      />

      {/* 添加到歌单 */}
      <ListMusicAdd ref={musicAddRef} />

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

const LocalRow = memo(({ item, index, card = false, onPress, onMore }: {
  item: LX.Music.MusicInfoLocal
  index: number
  /** 卡片模式：带边框底色的独立卡片（和搜索/排行榜的「卡片」同一套 token） */
  card?: boolean
  onPress: (item: LX.Music.MusicInfoLocal, index: number) => void
  /** 打开「更多」底部 Sheet（点行尾 ⋮ 或长按整行） */
  onMore: (item: LX.Music.MusicInfoLocal) => void
}) => {
  const theme = useTheme()

  /** 歌名：标签里可能带着「歌手 - 」前缀，这里只显示歌名 */
  const songName = useMemo(() => cleanSongName(item.name, item.singer), [item.name, item.singer])
  /** 第二行：歌手 - 专辑 */
  const subLine = useMemo(() => {
    return [item.singer || '未知歌手', item.meta.albumName].filter(Boolean).join(' - ')
  }, [item.singer, item.meta.albumName])
  /** 第三行：采样率（精简成 44.1k，小标签放得下） */
  const rate = useMemo(() => {
    // 去掉空格：4 个标签挤在一行，多一个空格就会把最后一个挤成省略号
    return item.meta.sampleRate
      ? formatSampleRate(item.meta.sampleRate).replace(/\s+/g, '')
      : ''
  }, [item.meta.sampleRate])

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
        onPress={() => { onPress(item, index) }}
        onLongPress={() => { onMore(item) }}
        delayLongPress={320}
      >
        {card ? null : <Text size={11} color={theme['c-350']} style={styles.index}>{index + 1}</Text>}
        <Cover item={item} />
        <View style={styles.info}>
          <Text size={15} numberOfLines={1} style={styles.name}>{songName}</Text>
          <Text size={11.5} color={theme['c-450']} numberOfLines={1} style={styles.meta}>{subLine}</Text>
          <View style={styles.thirdRow}>
            {item.interval ? <MiniTag text={item.interval} /> : null}
            <MiniTag text={item.meta.ext.toUpperCase()} />
            {rate ? <MiniTag text={rate} /> : null}
            {item.meta.bitrate ? <MiniTag text={`${item.meta.bitrate}kbps`} /> : null}
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.moreBtn}
        activeOpacity={0.6}
        hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
        onPress={() => { onMore(item) }}
      >
        <Icon name='dots-vertical' size={16} color={theme['c-350']} />
      </TouchableOpacity>
    </View>
  )
})

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
})

const styles = createStyle({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTags: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
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
    flexWrap: 'wrap',
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
