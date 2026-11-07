import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, startTransition, memo } from 'react'
import {
  Animated,
  FlatList,
  PanResponder,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
  Modal,
  Pressable,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Input from '@/components/common/Input'
import Clipboard from '@react-native-clipboard/clipboard'
import PageHeader from '@/components/common/PageHeader'
import ActionSheet from '@/components/common/ActionSheet'
import { useStatusbarHeight } from '@/store/common/hook'
import Tag from '@/components/common/Tag'
import ListMusicAdd, { type MusicAddModalType } from '@/components/MusicAddModal'
import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import MusicMultiAddModal, { type MusicMultiAddModalType } from '@/components/MusicMultiAddModal'
import { useTheme } from '@/store/theme/hook'
import { contrastOn } from '@/theme/solid'
import { setNavActiveId } from '@/core/common'
import LiquidGlass from '@/components/common/LiquidGlass'
import { useSettingValue } from '@/store/setting/hook'
import { confirmDialog, createStyle, tipDialog, toast } from '@/utils/tools'
import { formatSize, formatSampleRate } from '@/core/download/utils'
import { getLocalMusicList, getScanPartialList, subscribeScanPartialList, scanLocalMusicInBackground, isScanning, useScanState, getTotalSize, deleteLocalMusic, getScanDirs, getExtraDirs, setExtraDirs, getLastScanReport, type ScanDir, type ScanReport } from '@/core/localMusic'
import { pickDirectory, isDirectoryPickerSupported } from '@/utils/directoryPicker'
import { cleanSongName } from '@/utils/songName'
import { initialOfText } from '@/utils/pinyinInitial'
import { normalizeGroupKey, useLocalLibraryIndex } from '@/core/localMusic/libraryIndex'
import { hideFolder, hideSong, isHiddenItem, useHidden } from '@/core/localMusic/hidden'
import { isLikelyUnsupportedLocal } from '@/core/localMusic/formats'
import { moveSongToRecycle } from '@/core/localMusic/recycle'
import { buildM3U8, matchM3UEntries, parseM3U } from '@/core/localMusic/m3u'
import { parseCue } from '@/core/localLibrary/cue'
import { buildCueVirtualTracks } from '@/core/localLibrary/cueTracks'
import { existsFile, readFile, selectManagedFolder, stat, writeFile } from '@/utils/fs'
import {
  COVER_OPTIONS,
  FORMAT_OPTIONS,
  SORT_OPTIONS,
  defaultViewPrefs,
  loadViewPrefs,
  saveViewPrefs,
  type LocalSortKey,
  type LocalViewPrefs,
} from '@/core/localMusic/viewPrefs'
import LetterIndexBar from './LetterIndexBar'
import { addListMusics, createList, getListMusics, overwriteListMusics, removeListMusics } from '@/core/list'
import listAction from '@/store/list/action'
import settingState from '@/store/setting/state'
import { playList } from '@/core/player/player'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { LIST_IDS, NAV_BAR_SPACE } from '@/config/constant'
import { useWindowSize } from '@/utils/hooks'
import { setSpText } from '@/utils/pixelRatio'
import { CoverImage } from './cover'
import SongActionSheet, { type SongAction } from './SongActionSheet'
import SongInfoPage from './SongInfoPage'

const LOCAL_LIST_ID = 'local_music'
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
/** 浏览层级（Poweramp 那种：最近添加 / 专辑 / 艺人 / 文件夹树 / 全部） */
const TABS = [
  { key: 'song', label: '全部歌曲', icon: 'music-note' },
  { key: 'folder', label: '文件夹', icon: 'folder' },
  { key: 'album', label: '专辑', icon: 'album' },
  { key: 'artist', label: '艺人', icon: 'account' },
  { key: 'recent', label: '最近添加', icon: 'clock-outline' },
] as const

/** 胶囊内文字居中样式：和 components/common/Tag 同一套规则（render 时按当前字号算 lineHeight） */
/**
 * 页签栏独立组件：点击只重渲染这一排（立即高亮），把列表重建排到下一帧。
 * 父组件切 tab 会重建几百行，如果和页签状态同一次 render，用户会看到「点了没反应」。
 */
const LocalTabs = memo(({ active, onChange }: {
  active: LocalTab
  onChange: (tab: LocalTab) => void
}) => {
  const [visual, setVisual] = useState<LocalTab>(active)
  useEffect(() => { setVisual(active) }, [active])
  return (
    <View style={styles.tabRow}>
      {
        TABS.map(item => (
          <TabButton
            key={item.key}
            label={item.label}
            active={visual === item.key}
            onPress={() => {
              if (visual === item.key) return
              setVisual(item.key)
              requestAnimationFrame(() => { onChange(item.key) })
            }}
          />
        ))
      }
    </View>
  )
})

const chipText = (fontSize: number) => ({
  includeFontPadding: false,
  textAlignVertical: 'center' as const,
  lineHeight: setSpText(fontSize + 2),
})

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
      <Text
        size={11}
        color={active ? contrastOn(theme['c-primary']) : theme['c-450']}
        numberOfLines={1}
        style={[styles.tabText, chipText(11)]}
      >{label}</Text>
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
}) => <CoverImage item={item} size={size} round={round} inset={0} radius={9} style={{ marginRight: 12 }} />

/** '03:55' → 秒；用于时长排序 */
const secondsOfInterval = (interval?: string | null) => {
  if (!interval) return 0
  const parts = interval.split(':').map(part => Number.parseInt(part, 10))
  if (!parts.length || parts.some(Number.isNaN)) return 0
  let seconds = 0
  for (const part of parts) seconds = seconds * 60 + part
  return seconds
}

export type LocalTab = 'recent' | 'album' | 'artist' | 'folder' | 'song'

export default ({ onClose, initialTab, initialAlbum, onOpenFavorites }: { onClose?: () => void, /** 打开时直接落到哪个页签（首页「最近添加歌曲」进来用） */ initialTab?: LocalTab, /** 直接打开某张专辑的歌曲列表（首页最近添加专辑） */ initialAlbum?: string | null, /** 标题后的收藏入口（打开我的收藏） */ onOpenFavorites?: () => void }) => {
  const theme = useTheme()
  const { width: windowWidth, height: windowHeight } = useWindowSize()
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
  /** 页签高亮立即切换；列表数据延迟一帧构建，避免点击时同步重建几百行 */
  const deferredTab = useDeferredValue(tab)
  /** 歌名首字母筛选：null = 全部；'#' = 数字/符号/无法识别 */
  /** 右侧字母栏：当前高亮字母（跟随滚动，不参与筛选） */
  const [activeLetter, setActiveLetter] = useState<string | null>(null)
  const flatListRef = useRef<FlatList<any>>(null)
  /** 搜索改为页头按钮触发：不打开时列表保持满宽（不再常驻搜索条） */
  const [searchOpen, setSearchOpen] = useState(false)
  const statusBarHeight = useStatusbarHeight()
  const glassStyle = useSettingValue('common.navGlassStyle') ?? 'liquid'
  useEffect(() => {
    if (!initialAlbum) return
    setTab('album')
    setDetail({ type: 'album', title: initialAlbum })
  }, [initialAlbum])
  /** 专辑 / 艺人的二级页 */
  const [detail, setDetail] = useState<{ type: 'album' | 'artist', title: string } | null>(null)
  /** 文件夹树当前目录（null = 根） */
  const [folderPath, setFolderPath] = useState<string | null>(null)
  /** 授权失效、需要用户重新选一次的目录 */
  const [needAuth, setNeedAuth] = useState<ScanDir[]>([])
  /** 上次扫描报告（新增/更新/移除/失败/失权），用于 banner 与扫描面板 */
  const [lastReport, setLastReport] = useState<ScanReport | null>(null)
  const [reportDismissed, setReportDismissed] = useState(false)
  /** 浏览偏好：排序 / 筛选（D-05 / D-06，按 tab 记忆） */
  const [viewPrefs, setViewPrefs] = useState<LocalViewPrefs>(() => defaultViewPrefs())
  const [sortSheet, setSortSheet] = useState(false)
  const [filterSheet, setFilterSheet] = useState(false)
  /** 隐藏歌曲/文件夹（D-11） */
  const hidden = useHidden()
  /** M3U 导入/导出（D-17） */
  const choosePathRef = useRef<ChoosePathType>(null)
  const cueImportRef = useRef(false)
  /** 批量管理（D-19） */
  const [batchMode, setBatchMode] = useState(false)
  const [batchSelected, setBatchSelected] = useState<Set<string>>(() => new Set())
  const multiAddRef = useRef<MusicMultiAddModalType>(null)
  /**
   * 页内搜索关键词。
   *
   * 输入框里边的值（立即回显）和真正用于过滤的关键词分开：曲库上千首时
   * 每敲一个字都全量 filter 会把输入法卡住，过滤走 deferred 值（低优先级）。
   */
  const [searchText, setSearchText] = useState('')
  const deferredSearchText = useDeferredValue(searchText)
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
    if (scanning) return
    void getLastScanReport().then(report => { if (report) setLastReport(report) })
  }, [scanning])

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
      if (result.report) {
        setLastReport(result.report)
        setReportDismissed(false)
      }
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

  useEffect(() => {
    void loadViewPrefs().then(setViewPrefs)
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => { void saveViewPrefs(viewPrefs) }, 400)
    return () => { clearTimeout(timer) }
  }, [viewPrefs])

  /** 当前页签的排序状态 */
  const tabSort = useMemo(
    () => viewPrefs.sort[tab] ?? defaultViewPrefs().sort[tab] ?? { key: 'name', dir: 'asc' },
    [viewPrefs.sort, tab],
  )
  const tabSortLabel = SORT_OPTIONS.find(option => option.key === tabSort.key)?.label ?? '歌名'
  const tabFilterFormat = viewPrefs.filter.format
  const tabFilterCover = viewPrefs.filter.cover
  const hasActiveFilter = tabFilterFormat !== 'all' || tabFilterCover !== 'all'
  const filterLabel = hasActiveFilter
    ? [tabFilterFormat !== 'all' ? tabFilterFormat.toUpperCase() : null, tabFilterCover === 'has' ? '有封面' : tabFilterCover === 'none' ? '无封面' : null].filter(Boolean).join(' · ')
    : '筛选'

  /** 筛选只作用于浏览列表；页头统计/扫描统计仍用完整 list */
  const filteredList = useMemo(() => {
    const visible = list.filter(item => !isHiddenItem(item, hidden))
    if (!hasActiveFilter) return visible
    return visible.filter(item => {
      if (tabFilterFormat !== 'all') {
        const ext = item.meta.ext?.toLowerCase() ?? ''
        const matched = tabFilterFormat === 'ogg'
          ? (ext === 'ogg' || ext === 'opus')
          : tabFilterFormat === 'm4a'
            ? (ext === 'm4a' || ext === 'aac')
            : ext === tabFilterFormat
        if (!matched) return false
      }
      if (tabFilterCover === 'has' && !item.meta.picUrl) return false
      if (tabFilterCover === 'none' && item.meta.picUrl) return false
      return true
    })
  }, [list, hidden, hasActiveFilter, tabFilterFormat, tabFilterCover])

  const compareSongs = useCallback((a: LX.Music.MusicInfoLocal, b: LX.Music.MusicInfoLocal) => {
    let result = 0
    switch (tabSort.key) {
      case 'singer': result = (a.singer ?? '').localeCompare(b.singer ?? '', 'zh-Hans-CN'); break
      case 'album': result = (a.meta.albumName ?? '').localeCompare(b.meta.albumName ?? '', 'zh-Hans-CN'); break
      case 'duration': result = secondsOfInterval(a.interval) - secondsOfInterval(b.interval); break
      case 'added': result = (a.meta.mtime ?? 0) - (b.meta.mtime ?? 0); break
      case 'path': result = a.meta.filePath.localeCompare(b.meta.filePath, 'zh-Hans-CN'); break
      case 'name':
      default: result = cleanSongName(a.name, a.singer).localeCompare(cleanSongName(b.name, b.singer), 'zh-Hans-CN')
    }
    return tabSort.dir === 'asc' ? result : -result
  }, [tabSort])
  const sortSongs = useCallback((songs: LX.Music.MusicInfoLocal[]) => [...songs].sort(compareSongs), [compareSongs])

  const totalSize = useMemo(() => formatSize(getTotalSize(list)), [list])
  const visibleCount = useMemo(() => list.filter(item => !isHiddenItem(item, hidden)).length, [list, hidden])
  /** 派生索引：专辑/艺人聚合封面、数量、文件夹统计与最近添加（D-01/D-02） */
  const libraryIndex = useLocalLibraryIndex(filteredList)

  /** 输入框里的即时关键词（控制「搜索模式」UI，立即回显） */
  const searchKeyword = searchText.trim()
  const searching = searchKeyword.length > 0
  /** 真正用于过滤的小写关键词（延迟值：曲库上千首时逐字全量 filter 会卡住输入法） */
  const filterKeyword = deferredSearchText.trim().toLowerCase()
  /**
   * 页内搜索结果：跨页签在全部歌曲里按「歌名 / 歌手 / 专辑」实时过滤。
   * null 表示不在搜索态，列表继续走页签逻辑。
   */
  const searchResults = useMemo(() => {
    if (!filterKeyword) return null
    return filteredList.filter(item => {
      const fileName = item.meta.filePath.slice(item.meta.filePath.lastIndexOf('/') + 1).toLowerCase()
      const initial = initialOfText(cleanSongName(item.name, item.singer)).toLowerCase()
      return cleanSongName(item.name, item.singer).toLowerCase().includes(filterKeyword) ||
        (item.singer ?? '').toLowerCase().includes(filterKeyword) ||
        (item.meta.albumName ?? '').toLowerCase().includes(filterKeyword) ||
        fileName.includes(filterKeyword) ||
        item.meta.filePath.toLowerCase().includes(filterKeyword) ||
        initial === filterKeyword
    })
  }, [filteredList, filterKeyword])

  /** id → 在原列表里的下标（分组后仍然按原列表播放） */
  const indexOfId = useMemo(() => {
    const map = new Map<string, number>()
    filteredList.forEach((item, i) => { map.set(item.id, i) })
    return map
  }, [filteredList])

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
    for (const item of filteredList) {
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
  }, [filteredList])

  const rows = useMemo(() => {
    // 首字母筛选只作用于「全部歌曲 / 最近添加」的平铺列表；专辑/艺人/文件夹分组不受影响
    const songSource = sortSongs(filteredList)

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

    // 搜索：直接平铺命中结果，不受当前页签 / 二级页限制
    if (searchResults) return searchResults.map((item, i) => toSongRow(item, i))

    // 二级页：某张专辑 / 某个艺人的歌（用索引的 songIds，兼容大小写/空格差异与多歌手拆分）
    if (detail) {
      const group = detail.type === 'album'
        ? libraryIndex.albums[normalizeGroupKey(detail.title)]
        : libraryIndex.artists[normalizeGroupKey(detail.title)]
      if (group) {
        const byId = new Map(filteredList.map(item => [item.id, item]))
        return group.songIds
          .map(id => byId.get(id))
          .filter((item): item is LX.Music.MusicInfoLocal => !!item)
          .map(item => toSongRow(item))
      }
      return filteredList
        .filter(it => (detail.type === 'album'
          ? (it.meta.albumName || '未知专辑')
          : (it.singer || '未知歌手')) === detail.title)
        .map(item => toSongRow(item))
    }

    // 最近添加：按文件修改时间倒序
    if (deferredTab === 'recent') {
      return [...songSource].sort(compareSongs).map(item => toSongRow(item))
    }

    if (deferredTab === 'song') return songSource.map((item, i) => toSongRow(item, i))

    // 文件夹：只列「直接装了歌」的目录（不再逐层钻），点进去就是这一层的歌
    if (deferredTab === 'folder') {
      if (folderPath && folderTree.has(folderPath)) {
        return sortSongs(folderTree.get(folderPath)?.songs ?? []).map(item => toSongRow(item))
      }
      return Object.values(libraryIndex.folders)
        .sort((a, b) => {
          const result = tabSort.key === 'duration'
            ? a.count - b.count
            : a.path.localeCompare(b.path, 'zh-Hans-CN')
          return tabSort.dir === 'asc' ? result : -result
        })
        .map((folder): Row => ({
          type: 'folder',
          key: folder.path,
          title: folder.name,
          count: folder.count,
          path: folder.path,
        }))
    }

    // 专辑 / 艺人：用派生索引聚合（封面取该组内第一张有效封面，数量为真实曲目数）
    const coverOf = (coverId?: string): LX.Music.MusicInfoLocal | undefined => {
      if (!coverId) return undefined
      const position = indexOfId.get(coverId)
      return position == null ? undefined : list[position]
    }
    if (deferredTab === 'album') {
      return Object.values(libraryIndex.albums)
        .sort((a, b) => {
          let result = 0
          switch (tabSort.key) {
            case 'singer': result = a.singer.localeCompare(b.singer, 'zh-Hans-CN'); break
            case 'duration': result = a.totalSeconds - b.totalSeconds; break
            case 'album':
            case 'name':
            case 'added':
            case 'path':
            default: result = a.name.localeCompare(b.name, 'zh-Hans-CN')
          }
          return tabSort.dir === 'asc' ? result : -result
        })
        .map((album): Row => ({
          type: 'album',
          key: album.key,
          title: album.name,
          count: album.count,
          cover: coverOf(album.coverId),
        }))
    }
    return Object.values(libraryIndex.artists)
      .sort((a, b) => {
        let result = 0
        switch (tabSort.key) {
          case 'duration': result = a.totalSeconds - b.totalSeconds; break
          case 'name':
          case 'singer':
          case 'album':
          case 'added':
          case 'path':
          default: result = a.name.localeCompare(b.name, 'zh-Hans-CN')
        }
        return tabSort.dir === 'asc' ? result : -result
      })
      .map((artist): Row => ({
        type: 'artist',
        key: artist.key,
        title: artist.name,
        count: artist.count,
        cover: coverOf(artist.coverId),
      }))
  }, [detail, deferredTab, filteredList, list, indexOfId, folderTree, folderPath, searchResults, libraryIndex, tabSort, compareSongs, sortSongs])

  const letterBarVisible = tab === 'song' && !detail && !searchKeyword && !searchOpen

  interface LetterRow { type?: string, item?: LX.Music.MusicInfoLocal }
  const activeLetterOfRow = (row: LetterRow | null): string | null => {
    if (row?.type !== 'song' || !row.item) return null
    return initialOfText(cleanSongName(row.item.name, row.item.singer))
  }

  const handleLetterSelect = (letter: string) => {
    const index = rows.findIndex(row => activeLetterOfRow(row as LetterRow) === letter)
    if (index < 0) return
    setActiveLetter(letter)
    flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 })
  }

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: any, isViewable: boolean }> }) => {
    const first = viewableItems.find(item => item.isViewable)
    const letter = first ? activeLetterOfRow(first.item as LetterRow) : null
    if (letter) setActiveLetter(letter)
  }).current
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 10 }).current

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
  const openM3U = useCallback((action: 'import' | 'export') => {
    setDirModal(false)
    if (action === 'export') {
      /*
        导出走系统 SAF 目录授权：Android 10+ 的旧 WRITE_EXTERNAL_STORAGE 已被
        系统忽略，内置目录选择器会拿到「拒绝」；SAF 授权目录后写 content uri
        才在 Android 13+ 上稳定可用。
      */
      void (async() => {
        try {
          const dir = await selectManagedFolder(true)
          if (!dir?.isDirectory) return
          const content = buildM3U8(filteredList)
          const stamp = new Date().toISOString().slice(0, 10)
          const target = `${dir.path.replace(/\/+$/, '')}/emo_local_${stamp}.m3u8`
          await writeFile(target, content)
          toast(`已导出 ${filteredList.length} 首到所选目录`)
        } catch {
          toast('导出失败，请换一个目录重试')
        }
      })()
      return
    }
    choosePathRef.current?.show({
      title: '选择 M3U / M3U8 文件',
      dirOnly: false,
      filter: ['m3u', 'm3u8'],
    })
  }, [filteredList])

  const openCueImport = useCallback(() => {
    cueImportRef.current = true
    setDirModal(false)
    choosePathRef.current?.show({
      title: '选择 CUE 文件',
      dirOnly: false,
      filter: ['cue'],
    })
  }, [])

  const importCueFile = useCallback((cuePath: string) => {
    void (async() => {
      try {
        const text = await readFile(cuePath)
        const sheet = parseCue(text)
        if (!sheet.tracks.length) { toast('CUE 里没有解析到分段'); return }
        const dir = cuePath.slice(0, cuePath.lastIndexOf('/'))
        const audioPath = sheet.file.startsWith('/')
          ? sheet.file
          : `${dir}/${sheet.file}`
        if (!await existsFile(audioPath).catch(() => false)) {
          toast(`找不到整轨文件：${sheet.file || '(未声明 FILE)'}`)
          return
        }
        const info = await stat(audioPath).catch(() => null)
        const virtual = buildCueVirtualTracks(sheet, audioPath)
        const list = virtual.map(track => ({
          id: track.id,
          name: track.title,
          singer: track.performer,
          source: 'local' as const,
          interval: track.interval || null,
          meta: {
            filePath: audioPath,
            ext: audioPath.split('.').pop() ?? '',
            size: info?.size ?? 0,
            mtime: info?.lastModified ?? 0,
            albumName: sheet.album,
            songId: audioPath,
            cuePath: audioPath,
            cueTrack: track.trackNumber,
            cueStartMs: track.startMs,
            cueEndMs: track.endMs,
          },
        })) as LX.Music.MusicInfoLocal[]
        const name = cuePath.slice(cuePath.lastIndexOf('/') + 1).replace(/\.cue$/i, '')
        await createList({ name: `CUE ${name}`, list })
        toast(`已导入 ${list.length} 段到「CUE ${name}」`)
      } catch {
        toast('导入 CUE 失败，请检查文件是否可读')
      }
    })()
  }, [])

  const handleM3UPath = useCallback((path: string) => {
    if (cueImportRef.current) {
      cueImportRef.current = false
      importCueFile(path)
      return
    }
    void (async() => {
      try {
        const text = await readFile(path)
        const entries = parseM3U(text)
        if (!entries.length) {
          toast('没有解析到歌曲，请确认是 M3U/M3U8 文件')
          return
        }
        const result = matchM3UEntries(entries, list)
        if (!result.matched.length) {
          toast(`解析到 ${entries.length} 行，但没有匹配到本地曲库`)
          return
        }
        const stamp = new Date().toLocaleString('zh-CN')
        await createList({ name: `导入歌单 ${stamp}`, list: result.matched })
        toast(`已导入 ${result.matched.length} 首${result.unmatched ? `，${result.unmatched} 首未匹配` : ''}`)
      } catch {
        toast('导入失败，请检查文件是否可读')
      }
    })()
  }, [list, importCueFile])

  const batchItems = useMemo(
    () => filteredList.filter(item => batchSelected.has(item.id)),
    [filteredList, batchSelected],
  )

  const toggleBatchMode = useCallback(() => {
    setBatchMode(prev => {
      if (prev) setBatchSelected(new Set())
      return !prev
    })
  }, [])

  const toggleBatchItem = useCallback((item: LX.Music.MusicInfoLocal) => {
    setBatchSelected(prev => {
      const next = new Set(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      return next
    })
  }, [])

  const runBatch = useCallback((action: 'queue' | 'playlist' | 'hide' | 'remove' | 'deleteFiles') => {
    const items = batchItems
    if (!items.length) return
    if (action === 'queue') {
      addTempPlayList(items.map(item => ({ listId: '', musicInfo: item })))
      toast(`已把 ${items.length} 首加入播放队列`)
    } else if (action === 'playlist') {
      multiAddRef.current?.show({ selectedList: items, listId: '', isMove: false })
      return
    } else if (action === 'hide') {
      void Promise.all(items.map(async item => hideSong(item.id))).then(() => {
        toast(`已隐藏 ${items.length} 首`)
        setBatchSelected(new Set())
        setBatchMode(false)
      })
      return
    } else if (action === 'remove') {
      void confirmDialog({
        title: '从曲库移除',
        message: `从曲库移除 ${items.length} 首歌？只删除曲库记录，不会删除磁盘文件。`,
        confirmButtonText: '移除',
        danger: true,
      }).then(confirmed => {
        if (!confirmed) return
        void Promise.all(items.map(async item => deleteLocalMusic(item, false))).then(() => {
          toast(`已从曲库移除 ${items.length} 首`)
          setBatchSelected(new Set())
          setBatchMode(false)
        })
      })
      return
    } else {
      void confirmDialog({
        title: '删除文件到回收站',
        message: `把 ${items.length} 首歌的文件移入回收站（音乐工具可恢复），并从曲库移除？`,
        confirmButtonText: '移入回收站',
        danger: true,
      }).then(confirmed => {
        if (!confirmed) return
        void Promise.all(items.map(async item => moveSongToRecycle(item))).then(results => {
          const ok = results.filter(result => result.ok).length
          const failed = results.length - ok
          toast(failed ? `已移入回收站 ${ok} 首，${failed} 首失败` : `已移入回收站 ${ok} 首`)
          setBatchSelected(new Set())
          setBatchMode(false)
        })
      })
      return
    }
    setBatchSelected(new Set())
  }, [batchItems])

  // 切页签/进二级页/进搜索时退出批量，避免选择集和列表对不上
  useEffect(() => {
    setBatchMode(false)
    setBatchSelected(new Set())
  }, [tab, detail, searching])

  const showScanReport = useCallback(() => {
    const report = lastReport
    if (!report) return
    const lines = [
      `时间：${new Date(report.finishedAt).toLocaleString()}`,
      `耗时：${(report.durationMs / 1000).toFixed(1)} 秒`,
      `曲库：${report.total} 首`,
      `新增 ${report.added} · 更新 ${report.updated} · 未变化 ${report.unchanged} · 移除 ${report.removed}`,
      report.failed ? `读取失败：${report.failed} 首` : '读取失败：0 首',
    ]
    if (report.needAuth.length) lines.push(`需重新授权：\n${report.needAuth.join('\n')}`)
    void tipDialog({ title: '扫描报告', message: lines.join('\n'), btnText: '知道了' })
  }, [lastReport])

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
      : (
        <RefreshControl
          refreshing={scanning}
          onRefresh={() => { void handleScan() }}
          colors={[theme['c-primary']]}
          progressBackgroundColor={theme['c-content-background']}
          tintColor={theme['c-primary']}
        />
        )
  ), [closeWithSlide, hasClose, scanning, handleScan, theme])

  // 兜底：列表顶部的快速下滑由原生滚动事件判定（PanResponder 在部分机型上抢不到手势）
  const handleScrollEndDrag = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!onCloseRef.current) return
    const { contentOffset, velocity } = e.nativeEvent
    if (contentOffset.y <= 0 && (velocity?.y ?? 0) < -0.3) closeWithSlide()
  }, [closeWithSlide])

  /** 清空搜索（回到当前页签） */
  const clearSearch = useCallback(() => { setSearchText('') }, [])

  /**
   * 播放某一首。
   *
   * 以「当前列表队列」为准：搜索态用命中结果当临时播放列表，
   * 非搜索态用完整曲库（页签/二级页只是展示顺序不同，播放队列始终是整库）。
   * index 通过 id 在队列里定位，避免分组/排序后下标对不上播错歌。
   */
  const handlePlay = useCallback(async(item: LX.Music.MusicInfoLocal) => {
    const queue = searchResults ?? list
    if (!queue.length) return
    const index = queue.findIndex(music => music.id === item.id)
    if (index < 0) return
    await overwriteListMusics(LIST_IDS.TEMP, queue)
    listAction.setTempListMeta({ id: LOCAL_LIST_ID })
    void playList(LIST_IDS.TEMP, index)
  }, [list, searchResults])

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
  const handleRowPress = useCallback((item: LX.Music.MusicInfoLocal) => {
    void handlePlay(item)
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
    switch (action) {
      case 'play':
        void handlePlay(item)
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
        // 从搜索结果跳专辑/艺人时先退出搜索态，否则列表还停在搜索结果上
        setSearchText('')
        setTab('album')
        setFolderPath(null)
        setDetail({ type: 'album', title: item.meta.albumName || '未知专辑' })
        break
      case 'artist':
        setSearchText('')
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
      case 'hide':
        void hideSong(item.id).then(() => { toast('已隐藏，可在 设置 → 音乐工具 → 隐藏内容 恢复') })
        break
      case 'removeFromList':
        void handleDelete(item, false)
        break
      case 'deleteFile':
        // App 内 Material You 确认弹窗（危险色按钮）；语义与原 Alert.alert 一致：
        // 取消/点遮罩什么都不做，只有确认才删文件
        void confirmDialog({
          title: '删除文件',
          message: `确定删除「${cleanSongName(item.name, item.singer)}」的文件吗？此操作不可恢复。`,
          cancelButtonText: '取消',
          confirmButtonText: '删除',
          danger: true,
        }).then(confirmed => {
          if (confirmed) void handleDelete(item, true)
        })
        break
    }
  }, [sheetItem, sheetLoved, handlePlay, handleDelete])

  /** 网格视图：专辑/艺人在无二级页、无搜索时用 3 列卡片（D-08） */
  const isGrid = (tab === 'album' || tab === 'artist') && detail === null && !searching
  const gridSize = Math.max(88, Math.floor((windowWidth - 24 - 20) / 3))

  const renderItem = useCallback(({ item: row }: { item:
  | { type: 'song', key: string, item: LX.Music.MusicInfoLocal, index: number }
  | { type: 'album', key: string, title: string, count: number, cover?: LX.Music.MusicInfoLocal }
  | { type: 'artist', key: string, title: string, count: number, cover?: LX.Music.MusicInfoLocal }
  | { type: 'folder', key: string, title: string, count: number, path: string } }) => {
    if (row.type === 'album' || row.type === 'artist') {
      const openGroup = () => { setDetail({ type: row.type, title: row.title }) }
      if (isGrid) {
        return (
          <TouchableOpacity style={{ width: gridSize, marginBottom: 16 }} activeOpacity={0.75} onPress={openGroup}>
            {
              row.cover
                ? <CoverImage item={row.cover} size={gridSize} radius={14} inset={0} />
                : (
                  <View style={{
                    width: gridSize,
                    height: gridSize,
                    borderRadius: 14,
                    backgroundColor: theme['c-primary-alpha-900'],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon name={row.type === 'album' ? 'album' : 'account'} size={28} color={theme['c-primary']} />
                  </View>
                  )
            }
            <Text size={12.5} numberOfLines={1} style={{ marginTop: 6 }}>{row.title}</Text>
            <Text size={10} color={theme['c-450']} numberOfLines={1} style={{ marginTop: 1 }}>{`${row.count} 首`}</Text>
          </TouchableOpacity>
        )
      }
      if (row.type === 'album') {
        return (
          <TouchableOpacity
            style={styles.groupRowItem}
            activeOpacity={0.7}
            onPress={openGroup}
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
    }
    if (row.type === 'artist') {
      // 列表模式下艺人用圆形头像（网格模式已在上面的统一分支处理）
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
          onLongPress={() => {
            void confirmDialog({
              title: '隐藏文件夹',
              message: `隐藏「${row.title}」及其子目录里的歌？\n只影响本地音乐列表显示，不删除文件，可在 设置 → 音乐工具 → 隐藏内容 恢复。`,
              confirmButtonText: '隐藏',
            }).then(confirmed => {
              if (!confirmed) return
              void hideFolder(row.path).then(() => { toast('已隐藏文件夹，可在音乐工具里恢复') })
            })
          }}
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
        onPress={handleRowPress}
        onMore={handleOpenSheet}
        batchMode={batchMode}
        selected={batchSelected.has(item.id)}
        onToggle={toggleBatchItem}
      />
    )
  }, [theme, handleRowPress, handleOpenSheet, isGrid, gridSize, batchMode, batchSelected, toggleBatchItem])

  /** 二级页「播放全部」：从这一组的第一首开始播 */
  const handlePlayGroup = useCallback(() => {
    const first = rows.find(r => r.type === 'song')
    if (first && first.type === 'song') void handlePlay(first.item)
  }, [rows, handlePlay])


  const applySort = useCallback((key: LocalSortKey) => {
    setViewPrefs(prev => {
      const current = prev.sort[tab] ?? defaultViewPrefs().sort[tab] ?? { key: 'name', dir: 'asc' }
      const dir = current.key === key ? (current.dir === 'asc' ? 'desc' : 'asc') : 'asc'
      return { ...prev, sort: { ...prev.sort, [tab]: { key, dir } } }
    })
  }, [tab])
  const applyFilter = useCallback((patch: Partial<LocalViewPrefs['filter']>) => {
    setViewPrefs(prev => ({ ...prev, filter: { ...prev.filter, ...patch } }))
  }, [])

  const sortSheetItems = [
    ...SORT_OPTIONS.map(option => ({
      key: option.key,
      label: option.label,
      icon: 'sort',
      active: tabSort.key === option.key,
      value: tabSort.key === option.key ? (tabSort.dir === 'asc' ? '升序 ↑' : '降序 ↓') : undefined,
      onPress: () => { applySort(option.key) },
    })),
    {
      key: 'reset',
      label: '恢复默认排序',
      icon: 'restore',
      onPress: () => { applySort(defaultViewPrefs().sort[tab]?.key ?? 'name') },
    },
  ]
  const filterSheetItems = [
    ...FORMAT_OPTIONS.map(option => ({
      key: `format_${option.value}`,
      label: option.label,
      icon: 'music-note',
      active: tabFilterFormat === option.value,
      onPress: () => { applyFilter({ format: option.value }) },
    })),
    ...COVER_OPTIONS.map(option => ({
      key: `cover_${option.value}`,
      label: option.label,
      icon: 'image-outline',
      active: tabFilterCover === option.value,
      onPress: () => { applyFilter({ cover: option.value }) },
    })),
    ...(hasActiveFilter
      ? [{
          key: 'clear',
          label: '清除全部筛选',
          icon: 'filter-off-outline',
          onPress: () => { applyFilter({ format: 'all', cover: 'all' }) },
        }]
      : []),
  ]

  return (
    <Animated.View
      style={{ flex: 1, transform: [{ translateY: panY }] }}
      {...(hasClose ? panResponder.panHandlers : null)}
    >
      <View style={styles.container}>
      <View style={styles.glassTop}>
        <LiquidGlass mode={glassStyle} blurRadius={24} radius={0} tint={theme.isDark ? 'rgba(20,16,28,0.42)' : 'rgba(255,255,255,0.34)'} isDark={theme.isDark} seamless />
      {/* 作为主 Tab 用时补一个统一页头；从下载中心弹出来时不需要（那个是整屏子页） */}
      {hasClose ? null : (
        <PageHeader
          title='本地音乐'
          subtitle={(
            <View style={styles.headerTags}>
              {list.length ? <Tag label={`${list.length} 首`} style={styles.headerTag} /> : null}
              {totalSize ? <Tag label={totalSize.replace(/\s+/g, '')} style={styles.headerTag} /> : null}
            </View>
          )}
          right={(
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={{ ...styles.headerBtn, backgroundColor: theme['c-primary-alpha-900'] }}
                activeOpacity={0.8}
                accessibilityRole='button'
                accessibilityLabel='我的收藏'
                onPress={() => {
                  if (onOpenFavorites) onOpenFavorites()
                  else {
                    setNavActiveId('nav_home')
                    setTimeout(() => { global.app_event.openFavorites() }, 180)
                  }
                }}
              >
                <Icon name='heart-outline' size={19} color={theme['c-font']} />
              </TouchableOpacity>
              {/* 文件夹图标回归：直接进「扫描文件夹」面板，不用先展开搜索 */}
              <TouchableOpacity
                style={{ ...styles.headerBtn, backgroundColor: theme['c-primary-alpha-900'] }}
                activeOpacity={0.8}
                accessibilityRole='button'
                accessibilityLabel='扫描文件夹'
                onPress={() => { setDirModal(true) }}
              >
                <Icon name='folder-cog' size={19} color={theme['c-font']} />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ ...styles.headerBtn, backgroundColor: theme['c-primary-alpha-900'] }}
                activeOpacity={0.8}
                accessibilityRole='button'
                accessibilityLabel='搜索本地音乐'
                onPress={() => { setSearchOpen(true) }}
              >
                <Icon name='search-2' size={20} color={theme['c-font']} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/*
        搜索框改成「点搜索键后顶部弹出的悬浮框」：
        独立 Modal 覆盖在当前页上，列表不位移；点空白/返回/关闭按钮都收起，
        收起后搜索框不占布局（旧版会在页头下面留一条输入框）。
      */}
      <Modal
        visible={searchOpen}
        transparent
        animationType='fade'
        statusBarTranslucent
        onRequestClose={() => { setSearchOpen(false); setSearchText('') }}
      >
        <Pressable
          style={styles.searchBackdrop}
          onPress={() => { setSearchOpen(false); setSearchText('') }}
          accessibilityRole='button'
          accessibilityLabel='关闭搜索'
        >
          <Pressable
            style={{
              ...styles.searchFloat,
              // 必须用不透明底：半透明会和页头「本地音乐」文字叠在一起
              backgroundColor: theme['c-content-background'],
              borderColor: theme['c-primary-alpha-700'],
              top: statusBarHeight + 10,
            }}
            onPress={() => {}}
          >
            <Icon name='search-2' size={16} color={theme['c-450']} style={styles.searchIcon} />
            <Input
              value={searchText}
              autoFocus
              onChangeText={text => { setSearchText(text) }}
              placeholder='搜索本地歌曲、歌手或专辑'
              style={styles.searchInput}
              clearBtn={searchText.length > 0}
              returnKeyType='search'
              accessibilityLabel='搜索本地音乐'
            />
            <TouchableOpacity
              style={styles.searchClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole='button'
              accessibilityLabel='关闭搜索'
              onPress={() => { setSearchOpen(false); setSearchText('') }}
            >
              <Icon name='close' size={16} color={theme['c-450']} />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

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
          <Text size={11} color={contrastOn(theme['c-primary'])} style={[styles.scanBtnText, chipText(11)]}>{scanning ? '扫描中' : '扫描'}</Text>
        </TouchableOpacity>
      </View>
          : null
      }

      {
        // 扫描报告 banner：有新增/移除/失败/失权时提示，可查看详情或关闭
        !scanning && lastReport && !reportDismissed && (
          lastReport.failed > 0 || lastReport.needAuth.length > 0 || lastReport.removed > 0 || lastReport.added > 0
        )
          ? (
            <View style={{
              ...styles.scanCard,
              marginTop: 6,
              backgroundColor: theme['c-primary-alpha-900'],
              borderColor: theme['c-primary-alpha-700'],
            }}>
              <Icon name='clipboard-text-outline' size={16} color={theme['c-primary']} />
              <View style={[styles.scanInfo, { marginLeft: 8 }]}>
                <Text size={12} numberOfLines={1}>{`上次扫描：新增 ${lastReport.added} · 更新 ${lastReport.updated} · 移除 ${lastReport.removed}`}</Text>
                <Text
                  size={11}
                  color={lastReport.failed || lastReport.needAuth.length ? WARN_COLOR : theme['c-450']}
                  numberOfLines={1}
                  style={styles.scanMeta}
                >
                  {lastReport.failed
                    ? `${lastReport.failed} 首读取失败`
                    : lastReport.needAuth.length
                      ? `${lastReport.needAuth.length} 个目录需重新授权`
                      : `用时 ${(lastReport.durationMs / 1000).toFixed(1)} 秒`}
                </Text>
              </View>
              {
                lastReport.needAuth.length
                  ? (
                    <TouchableOpacity
                      onPress={() => { setDirModal(true) }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ paddingHorizontal: 8 }}
                    >
                      <Text size={11} color={WARN_COLOR}>重新授权</Text>
                    </TouchableOpacity>
                    )
                  : null
              }
              <TouchableOpacity
                onPress={showScanReport}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ paddingHorizontal: 8 }}
              >
                <Text size={11} color={theme['c-primary']}>详情</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setReportDismissed(true) }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name='close' size={14} color={theme['c-450']} />
              </TouchableOpacity>
            </View>
            )
          : null
      }

      {
        // 搜索态：页签让位给结果说明（搜索范围永远是全部歌曲，避免「搜了却搜不到当前页签外」）
        searching
          ? (
            <View style={styles.searchSummary}>
              <Icon name='search-2' size={13} color={theme['c-450']} />
              <Text size={11} color={theme['c-450']} numberOfLines={1} style={[styles.searchSummaryText, chipText(11)]}>
                {searchResults
                  ? `在全部歌曲中搜到 ${searchResults.length} 首`
                  : '正在搜索…'}
              </Text>
              <TouchableOpacity
                onPress={clearSearch}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text size={11} color={theme['c-primary']} style={[styles.searchClearText, chipText(11)]}>清除搜索</Text>
              </TouchableOpacity>
            </View>
            )
          : detail
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
                  <Text size={11} color={contrastOn(theme['c-primary'])} style={[styles.playAllText, chipText(11)]}>播放全部</Text>
                </TouchableOpacity>
              </View>
              )
            : (
              <View style={styles.tabBar}>
                <LocalTabs
                  active={tab}
                  onChange={key => {
                    startTransition(() => {
                      setTab(key)
                      setFolderPath(null)
                      setDetail(null)
                    })
                  }}
                />
              </View>
              )
      }

      {
        !searching && !detail && tab === 'folder' && folderPath
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

      {
        // 排序 / 筛选工具行（D-05 / D-06）；搜索和二级页不显示，避免抢层级
        !searching && !detail
          ? (
            <View style={styles.viewTools}>
              <TouchableOpacity
                style={styles.viewToolBtn}
                activeOpacity={0.75}
                onPress={() => { setSortSheet(true) }}
                accessibilityRole='button'
                accessibilityLabel={`排序方式：${tabSortLabel}`}
              >
                <Icon name='sort' size={14} color={theme['c-primary']} />
                <Text size={11} color={theme['c-font']} style={styles.viewToolText}>{`${tabSortLabel} ${tabSort.dir === 'asc' ? '↑' : '↓'}`}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.viewToolBtn}
                activeOpacity={0.75}
                onPress={() => { setFilterSheet(true) }}
                accessibilityRole='button'
                accessibilityLabel={`筛选：${filterLabel}`}
              >
                <Icon name={hasActiveFilter ? 'filter-variant' : 'filter-variant'} size={14} color={hasActiveFilter ? theme['c-primary'] : theme['c-font']} />
                <Text size={11} color={hasActiveFilter ? theme['c-primary'] : theme['c-font']} style={styles.viewToolText}>{filterLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewToolBtn, batchMode ? { backgroundColor: theme['c-primary-alpha-800'] } : null]}
                activeOpacity={0.75}
                onPress={toggleBatchMode}
                accessibilityRole='button'
                accessibilityLabel={batchMode ? '退出批量选择' : '批量选择'}
              >
                <Icon name={batchMode ? 'close' : 'checkbox-multiple-marked-outline'} size={14} color={batchMode ? theme['c-primary'] : theme['c-font']} />
                <Text size={11} color={batchMode ? theme['c-primary'] : theme['c-font']} style={styles.viewToolText}>{batchMode ? '取消' : '选择'}</Text>
              </TouchableOpacity>
              {hidden.ids.length || hidden.folders.length
                ? <Text size={10} color={theme['c-450']} style={styles.viewToolCount}>{`已隐藏 ${hidden.ids.length + hidden.folders.length}`}</Text>
                : null}
              {hasActiveFilter
                ? <Text size={10} color={theme['c-450']} style={styles.viewToolCount}>{`${filteredList.length}/${visibleCount} 首`}</Text>
                : null}
            </View>
            )
          : null
      }

      </View>

      <FlatList
        ref={flatListRef}
        key={isGrid ? 'grid' : 'list'}
        data={rows}
        renderItem={renderItem}
        keyExtractor={row => row.key}
        numColumns={isGrid ? 3 : 1}
        columnWrapperStyle={isGrid ? styles.gridRow : undefined}
        contentContainerStyle={[styles.listContent, letterBarVisible ? styles.listContentWithIndex : null]}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollToIndexFailed={info => {
          flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true })
        }}
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
        initialNumToRender={tab === 'song' ? Math.min(rows.length, 24) : 15}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={40}
        windowSize={4}
        removeClippedSubviews={false}
        scrollEventThrottle={32}
        onScroll={e => { scrollY.current = e.nativeEvent.contentOffset.y }}
        onScrollEndDrag={handleScrollEndDrag}
        refreshControl={refreshControl}
        // 搜索时键盘开着也要能直接点结果播放（默认会先吃掉一次点击去收键盘）
        keyboardShouldPersistTaps='handled'
        ListEmptyComponent={(
          searching && searchResults
            ? (
              <View style={styles.empty}>
                <View style={{ ...styles.emptyIcon, backgroundColor: theme['c-primary-alpha-900'] }}>
                  <Icon name='music-note-off' size={26} color={theme['c-400']} />
                </View>
                <Text size={13} style={styles.emptyTitle} numberOfLines={2}>
                  {`没有找到「${searchKeyword}」`}
                </Text>
                <Text size={11} color={theme['c-450']} style={styles.emptyTip}>
                  试试歌名、歌手或专辑名里的其他关键词
                </Text>
                <TouchableOpacity
                  style={{ ...styles.emptyBtn, backgroundColor: theme['c-primary'] }}
                  activeOpacity={0.85}
                  onPress={clearSearch}
                >
                  <Text size={12} color={contrastOn(theme['c-primary'])} style={[styles.emptyBtnText, chipText(12)]}>清空搜索</Text>
                </TouchableOpacity>
              </View>
              )
            : (
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
              )
        )}
      />

      {
        letterBarVisible
          ? <LetterIndexBar active={activeLetter} onSelect={handleLetterSelect} />
          : null
      }

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
      <ActionSheet
        visible={sortSheet}
        onClose={() => { setSortSheet(false) }}
        header={{ title: '排序', subtitle: '再次点击当前项切换升序/降序' }}
        items={sortSheetItems}
      />
      <ActionSheet
        visible={filterSheet}
        onClose={() => { setFilterSheet(false) }}
        header={{ title: '筛选', subtitle: '只影响本地音乐浏览列表' }}
        items={filterSheetItems}
      />

      {
        batchMode
          ? (
            <View style={[styles.batchBar, { backgroundColor: theme['c-content-background'], borderColor: theme['c-primary-alpha-700'] }]}>
              <Text size={12} style={styles.batchCount}>{`已选 ${batchSelected.size}`}</Text>
              <TouchableOpacity style={styles.batchBtn} onPress={() => { runBatch('queue') }} accessibilityLabel='加入播放队列'>
                <Icon name='playlist-plus' size={19} color={theme['c-font']} />
                <Text size={9.5} color={theme['c-450']} style={styles.batchLabel}>队列</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.batchBtn} onPress={() => { runBatch('playlist') }} accessibilityLabel='添加到歌单'>
                <Icon name='playlist-music' size={19} color={theme['c-font']} />
                <Text size={9.5} color={theme['c-450']} style={styles.batchLabel}>歌单</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.batchBtn} onPress={() => { runBatch('hide') }} accessibilityLabel='隐藏所选'>
                <Icon name='eye-off-outline' size={19} color={theme['c-font']} />
                <Text size={9.5} color={theme['c-450']} style={styles.batchLabel}>隐藏</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.batchBtn} onPress={() => { runBatch('deleteFiles') }} accessibilityLabel='删除文件到回收站'>
                <Icon name='delete-forever-outline' size={19} color={WARN_COLOR} />
                <Text size={9.5} color={WARN_COLOR} style={styles.batchLabel}>删文件</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.batchBtn} onPress={() => { runBatch('remove') }} accessibilityLabel='从曲库移除'>
                <Icon name='delete-outline' size={19} color={WARN_COLOR} />
                <Text size={9.5} color={WARN_COLOR} style={styles.batchLabel}>移除</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.batchBtn} onPress={toggleBatchMode} accessibilityLabel='退出批量选择'>
                <Icon name='close' size={19} color={theme['c-font']} />
                <Text size={9.5} color={theme['c-450']} style={styles.batchLabel}>退出</Text>
              </TouchableOpacity>
            </View>
            )
          : null
      }
      <MusicMultiAddModal ref={multiAddRef} onAdded={() => { setBatchSelected(new Set()); setBatchMode(false) }} />

      <ChoosePath ref={choosePathRef} onConfirm={handleM3UPath} />

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
            {lastReport
              ? (
                <Text size={10} color={theme['c-450']} style={{ marginTop: 2, marginBottom: 6 }}>
                  {`上次扫描：新增 ${lastReport.added} · 更新 ${lastReport.updated} · 未变化 ${lastReport.unchanged} · 移除 ${lastReport.removed} · 失败 ${lastReport.failed}（${(lastReport.durationMs / 1000).toFixed(1)}s）`}
                </Text>
                )
              : null}
            <TouchableOpacity
              style={styles.dirRow}
              activeOpacity={0.7}
              accessibilityRole='button'
              accessibilityLabel='导入 M3U 歌单'
              onPress={() => { openM3U('import') }}
            >
              <Icon name='file-import-outline' size={16} color={theme['c-primary']} />
              <View style={styles.dirInfo}>
                <Text size={13}>导入歌单</Text>
                <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.dirPath}>
                  从 M3U / M3U8 匹配本地曲库，导入为新歌单
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dirRow}
              activeOpacity={0.7}
              accessibilityRole='button'
              accessibilityLabel='导出当前列表为 M3U8'
              onPress={() => { openM3U('export') }}
            >
              <Icon name='file-export-outline' size={16} color={theme['c-primary']} />
              <View style={styles.dirInfo}>
                <Text size={13}>导出当前列表</Text>
                <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.dirPath}>
                  导出为 M3U8（含歌名/歌手/时长/路径）
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dirRow}
              activeOpacity={0.7}
              accessibilityRole='button'
              accessibilityLabel='导入 CUE 分段'
              onPress={openCueImport}
            >
              <Icon name='album' size={16} color={theme['c-primary']} />
              <View style={styles.dirInfo}>
                <Text size={13}>导入 CUE</Text>
                <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.dirPath}>
                  整轨 + .cue → 生成分段歌单（按段起止播放）
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dirRow}
              activeOpacity={0.7}
              accessibilityRole='button'
              accessibilityLabel='重新扫描全部目录'
              onPress={() => { setDirModal(false); void handleScan() }}
            >
              <Icon name='refresh' size={16} color={theme['c-primary']} />
              <View style={styles.dirInfo}>
                <Text size={13}>重新扫描</Text>
                <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.dirPath}>
                  重新读取所有已授权目录；也可以直接在列表顶部下拉扫描
                </Text>
              </View>
            </TouchableOpacity>
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
                    <Text size={13} color={contrastOn(theme['c-primary'])} style={[styles.addDirText, chipText(13)]}>添加文件夹</Text>
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

const LocalRow = memo(({ item, index, onPress, onMore, batchMode = false, selected = false, onToggle }: {
  item: LX.Music.MusicInfoLocal
  index: number
  onPress: (item: LX.Music.MusicInfoLocal) => void
  /** 打开「更多」底部 Sheet（点行尾 ⋮ 或长按整行） */
  onMore: (item: LX.Music.MusicInfoLocal) => void
  batchMode?: boolean
  selected?: boolean
  onToggle?: (item: LX.Music.MusicInfoLocal) => void
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
    <View style={[styles.row, selected ? { backgroundColor: theme['c-primary-alpha-900'] } : null]}>
      <TouchableOpacity
        style={styles.rowMain}
        activeOpacity={0.7}
        onPress={() => { batchMode ? onToggle?.(item) : onPress(item) }}
        onLongPress={() => { batchMode ? onToggle?.(item) : onMore(item) }}
        delayLongPress={320}
      >
        {
          batchMode
            ? (
              <View style={styles.batchCheck}>
                <Icon
                  name={selected ? 'check-circle' : 'circle-outline'}
                  size={19}
                  color={selected ? theme['c-primary'] : theme['c-350']}
                />
              </View>
              )
            : <Text size={11} color={theme['c-350']} style={styles.index}>{index + 1}</Text>
        }
        <Cover item={item} />
        <View style={styles.info}>
          <Text size={15} numberOfLines={1} style={styles.name}>{songName}</Text>
          <Text size={11.5} color={theme['c-450']} numberOfLines={1} style={styles.meta}>{subLine}</Text>
          <View style={styles.thirdRow}>
            {item.interval ? <Tag label={item.interval} style={styles.thirdTag} /> : null}
            <Tag label={item.meta.ext.toUpperCase()} style={styles.thirdTag} />
            {rate ? <Tag label={rate} style={styles.thirdTag} /> : null}
            {item.meta.bitrate ? <Tag label={`${item.meta.bitrate}kbps`} style={styles.thirdTag} /> : null}
            {isLikelyUnsupportedLocal(item)
              ? (
                <View style={styles.unsupportedTag}>
                  <Icon name='alert-circle-outline' size={11} color={WARN_COLOR} />
                  <Text size={9.5} color={WARN_COLOR} style={styles.unsupportedText}>可能不支持</Text>
                </View>
                )
              : null}
          </View>
        </View>
      </TouchableOpacity>
      {
        batchMode
          ? null
          : (
            <TouchableOpacity
              style={styles.moreBtn}
              activeOpacity={0.6}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
              onPress={() => { onMore(item) }}
            >
              <Icon name='dots-vertical' size={16} color={theme['c-350']} />
            </TouchableOpacity>
            )
      }
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
  titleFavBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTags: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  /** 页头小标签：Tag 已经保证垂直居中，这里只补原来的右边距 */
  headerTag: {
    marginRight: 5,
  },
  /** 页签胶囊文字（居中细节由 chipText() 在渲染时补，这里只留字重） */
  tabText: {
    fontWeight: '500',
  },
  /** 歌曲行第三行的小标签（Tag 组件） */
  thirdTag: {
    marginRight: 5,
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
  /** 页内搜索：和搜索页/歌单页的搜索框同一套圆角语言 */
  searchBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  // 顶部悬浮搜索框：圆角 + 投影，独立于列表布局
  searchFloat: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 46,
    borderRadius: 23,
    borderWidth: 0.5,
    paddingLeft: 16,
    paddingRight: 4,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    height: 34,
    paddingLeft: 0,
    fontSize: 13,
  },
  /** 搜索态下代替页签的结果说明行 */
  searchSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  searchSummaryText: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 5,
  },
  /** 摘要行右侧「清除搜索」 */
  searchClearText: {
    fontWeight: '500',
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
  /** 页签行（列表/卡片切换已移除，只剩页签） */
  glassTop: {
    zIndex: 20,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
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
  searchClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContentWithIndex: {
    // 右侧 A-Z 索引栏占位，避免行尾 ⋮ 被压住
    paddingRight: 24,
  },
  viewTools: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 12,
    paddingTop: 4,
    paddingBottom: 2,
  },
  viewToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: 'rgba(127,127,127,0.10)',
  },
  viewToolText: {
    marginLeft: 4,
  },
  viewToolCount: {
    marginLeft: 2,
  },
  unsupportedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 2,
  },
  unsupportedText: {
    marginLeft: 2,
  },
  gridRow: {
    gap: 10,
    paddingHorizontal: 12,
  },
  batchCheck: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
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
  /** 搜索无结果时的「清空搜索」按钮 */
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    paddingLeft: 18,
    paddingRight: 18,
    borderRadius: 16,
    marginTop: 16,
  },
  emptyBtnText: {
    fontWeight: '600',
  },
})
