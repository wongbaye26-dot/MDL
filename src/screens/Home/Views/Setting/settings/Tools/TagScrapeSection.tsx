import { memo, useCallback, useEffect, useRef, useState } from 'react'

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
  const [metaSummary, setMetaSummary] = useState<{ done: number, notFound: number, stopped: boolean } | null>(null)
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
      toast(`补全完成：成功 ${result.done} 首${result.notFound ? `，未找到 ${result.notFound} 首` : ''}`)
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
        label='语言 / 年份 / 风格可补全'
        desc='联网匹配歌曲：从搜索结果取年份/风格，拉歌词判断语言；写文件并回写曲库'
        value={scanning ? '—' : metaItems.length}
        tone={metaItems.length ? 'warning' : undefined}
      />
      {metaRunning ? <ProgressLine label='正在补全语言/年份/风格' done={metaProgress.done} total={metaProgress.total} /> : null}
      {metaSummary ? <SummaryChips chips={[
        { key: 'metaDone', label: '已补全', value: metaSummary.done, tone: 'primary' as const },
        { key: 'metaNotFound', label: '未找到', value: metaSummary.notFound, tone: metaSummary.notFound ? 'warning' as const : 'muted' as const },
      ]} /> : null}
      <ButtonRow>
        {
          metaRunning
            ? <SecondaryButton label={stopping ? '正在停止…' : '停止'} icon='stop' disabled={stopping} onPress={handleStop} />
            : <SecondaryButton label='补全语言/年份/风格' icon='tag-outline' disabled={scanning || !metaItems.length} onPress={() => { void handleMetaStart() }} />
        }
      </ButtonRow>
    </Card>
  )
})
