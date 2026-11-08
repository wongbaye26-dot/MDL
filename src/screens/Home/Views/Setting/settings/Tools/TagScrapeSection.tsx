import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Modal, ScrollView, Text as RNText, TouchableOpacity, View } from 'react-native'
import { getScrapeDebug, type ScrapeDebugEntry } from '@/core/localMusic/scrapeDebug'

import { toast } from '@/utils/tools'
import { cleanSongName } from '@/utils/songName'
import type { LibraryHealth } from './health'
import { runMetaScrape, runTagScrape, type TagScrapeSummary } from './tagScrape'
import { acquireToolsBusy, releaseToolsBusy } from './taskLock'
import {
  ButtonRow,
  Card,
  EmptyState,
  InfoLine,
  PrimaryButton,
  PreviewList,
  ProgressLine,
  ReportButtons,
  SecondaryButton,
  SummaryChips,
  type PreviewRow,
} from './parts'

interface Props {
  health: LibraryHealth
  scanning: boolean
  onChanged: () => void
}

/** 设置 → 音乐工具 → 批量刮削标签（统计来自父级曲库体检） */
export default memo(({ health, scanning, onChanged }: Props) => {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [stopping, setStopping] = useState(false)
  const [summary, setSummary] = useState<TagScrapeSummary | null>(null)

  const aliveRef = useRef(true)
  const runningRef = useRef(false)
  const failuresRef = useRef<string[]>([])
  const [failures, setFailures] = useState<string[]>([])
  /** 用户点了停止：批量循环在每首歌开始前检查一次 */
  const stopRef = useRef(false)

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const items = health.tagIncomplete
  const metaItems = health.metaIncomplete
  const [metaRunning, setMetaRunning] = useState(false)
  const [metaProgress, setMetaProgress] = useState({ done: 0, total: 0 })
  const [metaSummary, setMetaSummary] = useState<{ done: number, notFound: number, file: number, libraryOnly: number, skipped: number, stopped: boolean } | null>(null)
  const [debugVisible, setDebugVisible] = useState(false)
  const [debugEntries, setDebugEntries] = useState<ScrapeDebugEntry[]>([])
  const [hostVisible, setHostVisible] = useState(false)
  const [httpHosts, setHttpHosts] = useState<string[]>([])
  const metaRunningRef = useRef(false)

  const handleStart = useCallback(async() => {
    if (runningRef.current || !items.length) return
    if (!acquireToolsBusy()) {
      toast('另一个批量任务正在运行，请稍候')
      return
    }
    runningRef.current = true
    stopRef.current = false
    setRunning(true)
    setStopping(false)
    setSummary(null)
    failuresRef.current = []
    setFailures([])
    try {
      const result = await runTagScrape(items, {
        onProgress: setProgress,
        shouldStop: () => stopRef.current,
        isAlive: () => aliveRef.current,
        onItemResult: (item, status) => {
          if (status !== 'notFound') return
          failuresRef.current.push(`${cleanSongName(item.name, item.singer)} - ${item.singer || '未知歌手'}`)
        },
      })
      if (!aliveRef.current) return
      setSummary(result)
      setFailures([...failuresRef.current])
      const done = result.file + result.libraryOnly
      toast(result.stopped
        ? `已停止：处理 ${done} 首（写入文件 ${result.file} / 仅曲库 ${result.libraryOnly}）`
        : `刮削完成：写入文件 ${result.file} 首` +
          `${result.libraryOnly ? `，仅曲库 ${result.libraryOnly} 首` : ''}` +
          `${result.notFound ? `，未找到 ${result.notFound} 首` : ''}`)
      onChanged()
    } finally {
      releaseToolsBusy()
      runningRef.current = false
      if (aliveRef.current) {
        setRunning(false)
        setStopping(false)
      }
    }
  }, [items, onChanged])

  const handleStop = useCallback(() => {
    if (!runningRef.current || stopRef.current) return
    stopRef.current = true
    setStopping(true)
    toast('正在停止，已处理的结果会保留')
  }, [])

  const rows: PreviewRow[] = items.slice(0, 30).map(({ item, issues }) => ({
    key: item.id,
    item,
    title: cleanSongName(item.name, item.singer),
    sub: item.singer || '未知歌手',
    tags: issues.join(' · '),
  }))

  const chips = summary
    ? [
        ...(summary.stopped ? [{ key: 'stopped', label: '已停止', value: '', tone: 'warning' as const }] : []),
        { key: 'file', label: '写入文件', value: summary.file, tone: 'primary' as const },
        { key: 'library', label: '仅曲库', value: summary.libraryOnly },
        { key: 'notFound', label: '未找到', value: summary.notFound, tone: summary.notFound ? 'warning' as const : 'muted' as const },
        ...(summary.cover ? [{ key: 'cover', label: '顺带补封面', value: summary.cover }] : []),
      ]
    : []

  const handleMetaStart = useCallback(async() => {
    if (metaRunningRef.current || !metaItems.length) return
    if (!acquireToolsBusy()) {
      toast('另一个批量任务正在运行，请稍候')
      return
    }
    metaRunningRef.current = true
    stopRef.current = false
    setMetaRunning(true)
    setMetaSummary(null)
    try {
      const result = await runMetaScrape(metaItems, {
        onProgress: setMetaProgress,
        shouldStop: () => stopRef.current,
        isAlive: () => aliveRef.current,
      })
      if (!aliveRef.current) return
      setMetaSummary(result)
      toast(`补全完成：写入文件 ${result.file} 首，仅曲库 ${result.libraryOnly} 首，跳过 ${result.skipped} 首${result.notFound ? `，未找到 ${result.notFound} 首` : ''}`)
      onChanged()
    } finally {
      metaRunningRef.current = false
      setMetaRunning(false)
      releaseToolsBusy()
    }
  }, [metaItems, onChanged])

  return (
    <Card title='标签刮削' desc='联网核对歌名 / 歌手后写入歌名、歌手、专辑，尽量写进音频文件'>
      <InfoLine
        label='标签可补全的歌曲'
        desc={scanning
          ? '正在体检曲库…'
          : items.length
            ? '缺歌手 / 缺专辑 / 歌名混着歌手名；刮削会先核对，对不上不写'
            : '标签都完整'}
        value={scanning ? '—' : items.length}
        tone={items.length ? 'warning' : undefined}
      />

      {running ? <ProgressLine label='正在刮削' done={progress.done} total={progress.total} /> : null}

      {summary ? <SummaryChips chips={chips} /> : null}
      {summary ? <ReportButtons getTitle={() => '标签刮削结果'} getLines={() => [
        `写入文件 ${summary.file} 首，仅曲库 ${summary.libraryOnly} 首，未找到 ${summary.notFound} 首，顺带补封面 ${summary.cover} 首`,
        ...(failures.length ? ['未找到清单：', ...failures] : []),
      ]} /> : null}

      {!scanning && rows.length ? <PreviewList rows={rows} /> : null}

      {
        !running && !scanning && !items.length
          ? <EmptyState text='标签都完整，没有需要刮削的歌曲' />
          : null
      }

      <ButtonRow>
        {
          running
            ? (
              <SecondaryButton
                label={stopping ? '正在停止…' : '停止'}
                icon='stop'
                disabled={stopping}
                onPress={handleStop}
              />
              )
            : (
              <PrimaryButton
                label={scanning ? '正在体检曲库…' : '开始刮削'}
                icon='tag-multiple'
                disabled={scanning || !items.length}
                onPress={() => { void handleStart() }}
              />
              )
        }
      </ButtonRow>

      <InfoLine
        label='曲库字段诊断'
        desc={`有语言 ${health.metaStats.language} / 有年份 ${health.metaStats.year} / 有风格 ${health.metaStats.genre}（共 ${health.metaStats.total} 首）`}
        value={health.metaStats.total}
      />
      <InfoLine
        label='语言 / 年份 / 风格可补全'
        desc='联网匹配歌曲：从搜索结果取年份/风格，拉歌词判断语言；写文件并回写曲库'
        value={scanning ? '—' : metaItems.length}
        tone={metaItems.length ? 'warning' : undefined}
      />
      {metaRunning ? <ProgressLine label='正在补全语言/年份/风格' done={metaProgress.done} total={metaProgress.total} /> : null}
      {metaSummary ? <SummaryChips chips={[
        { key: 'metaFile', label: '写入文件', value: metaSummary.file, tone: 'primary' as const },
        { key: 'metaDone', label: '已补全', value: metaSummary.done },
        { key: 'metaLibrary', label: '仅曲库', value: metaSummary.libraryOnly },
        { key: 'metaSkipped', label: '跳过(无变化)', value: metaSummary.skipped },
        { key: 'metaNotFound', label: '未找到', value: metaSummary.notFound, tone: metaSummary.notFound ? 'warning' as const : 'muted' as const },
      ]} /> : null}
      <ButtonRow>
        {
          metaRunning
            ? <SecondaryButton label={stopping ? '正在停止…' : '停止'} icon='stop' disabled={stopping} onPress={handleStop} />
            : <SecondaryButton label='补全语言/年份/风格' icon='tag-outline' disabled={scanning || !metaItems.length} onPress={() => { void handleMetaStart() }} />
        }
      </ButtonRow>
      <ButtonRow>
        <SecondaryButton label='查看刮削请求' icon='tag-outline' onPress={() => { setDebugEntries(getScrapeDebug().reverse()); setDebugVisible(true) }} />
        <SecondaryButton label='请求域名' icon='web' onPress={() => {
          const hosts = (global.lx as unknown as { requestHosts?: Set<string> }).requestHosts
          const http = (global.lx as unknown as { httpHosts?: Set<string> }).httpHosts
          const merged = new Set<string>()
          http?.forEach(host => merged.add(`http://${host}`))
          hosts?.forEach(host => merged.add(host))
          setHttpHosts([...merged].sort())
          setHostVisible(true)
        }} />
      </ButtonRow>

      <Modal visible={hostVisible} transparent animationType='slide' onRequestClose={() => { setHostVisible(false) }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ maxHeight: '75%', backgroundColor: '#1b1b1f', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <RNText style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>请求域名（{httpHosts.length}）</RNText>
              <TouchableOpacity onPress={() => { setHostVisible(false) }}><RNText style={{ color: '#ff8a80', fontSize: 14 }}>关闭</RNText></TouchableOpacity>
            </View>
            <RNText style={{ color: '#9e9e9e', fontSize: 11, marginBottom: 8 }}>运行时实际请求过的域名；http:// 开头的需要后续做明文白名单</RNText>
            <ScrollView>
              {httpHosts.length
                ? httpHosts.map(host => <RNText key={host} selectable style={{ color: '#b0bec5', fontSize: 11, paddingVertical: 3 }}>{host}</RNText>)
                : <RNText style={{ color: '#9e9e9e', fontSize: 12 }}>暂无记录（先播放/搜索/刮削几次）</RNText>}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={debugVisible} transparent animationType='slide' onRequestClose={() => { setDebugVisible(false) }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ maxHeight: '80%', backgroundColor: '#1b1b1f', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <RNText style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>刮削请求诊断（{debugEntries.length}）</RNText>
              <TouchableOpacity onPress={() => { setDebugVisible(false) }}><RNText style={{ color: '#ff8a80', fontSize: 14 }}>关闭</RNText></TouchableOpacity>
            </View>
            <ScrollView>
              {debugEntries.map((entry, index) => (
                <View key={`${entry.at}_${index}`} style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', paddingVertical: 8 }}>
                  <RNText style={{ color: '#fff', fontSize: 13 }}>{entry.name}{entry.singer ? ` - ${entry.singer}` : ''}</RNText>
                  <RNText style={{ color: '#9e9e9e', fontSize: 11, marginTop: 2 }}>{entry.note}</RNText>
                  <RNText style={{ color: '#b0bec5', fontSize: 10, marginTop: 2 }}>
                    {`源: ${entry.source || '-'} | 返回: ${entry.matchTitle || '-'} / ${entry.matchSinger || '-'} / ${entry.matchAlbum || '-'}`}
                    {`
albumId: ${entry.albumId || '-'} | songmid: ${entry.songmid || '-'}`}
                    {`
年份: ${entry.year || '-'} | 风格: ${entry.genre || '-'} | 语言: ${entry.language || '-'}`}
                  </RNText>
                  {entry.raw ? <RNText style={{ color: '#78909c', fontSize: 9, marginTop: 2 }} selectable>{entry.raw}</RNText> : null}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Card>
  )
})
