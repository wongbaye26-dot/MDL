import { memo, useCallback, useEffect, useRef, useState } from 'react'

import { toast } from '@/utils/tools'
import { cleanSongName } from '@/utils/songName'
import type { LibraryHealth } from './health'
import { runLyricFix, type LyricFixSummary } from './lyricFix'
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

/** 设置 → 音乐工具 → 歌词补全（只检测真实路径旁边的同名 .lrc，SAF 条目跳过） */
export default memo(({ health, scanning, onChanged }: Props) => {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [stopping, setStopping] = useState(false)
  const [summary, setSummary] = useState<LyricFixSummary | null>(null)

  const aliveRef = useRef(true)
  const runningRef = useRef(false)
  const stopRef = useRef(false)
  const failuresRef = useRef<string[]>([])
  const [failures, setFailures] = useState<string[]>([])

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const items = health.missingLyrics

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
      const result = await runLyricFix(items, {
        onProgress: setProgress,
        shouldStop: () => stopRef.current,
        isAlive: () => aliveRef.current,
        onItemResult: (item, status) => {
          if (status === 'written') return
          failuresRef.current.push(`${cleanSongName(item.name, item.singer)} - ${item.singer || '未知歌手'}（${status === 'notFound' ? '无歌词' : '失败'}）`)
        },
      })
      if (!aliveRef.current) return
      setSummary(result)
      setFailures([...failuresRef.current])
      toast(result.stopped
        ? `已停止：写入 ${result.written} 首（无歌词 ${result.notFound} / 失败 ${result.failed}）`
        : `歌词补全完成：写入 ${result.written} 首` +
          `${result.notFound ? `，无歌词 ${result.notFound} 首` : ''}` +
          `${result.failed ? `，失败 ${result.failed} 首` : ''}`)
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
    toast('正在停止，已写入的歌词会保留')
  }, [])

  const rows: PreviewRow[] = items.slice(0, 30).map(item => ({
    key: item.id,
    item,
    title: cleanSongName(item.name, item.singer),
    sub: item.singer || '未知歌手',
  }))

  const chips = summary
    ? [
        ...(summary.stopped ? [{ key: 'stopped', label: '已停止', value: '', tone: 'warning' as const }] : []),
        { key: 'written', label: '写入', value: summary.written, tone: 'primary' as const },
        { key: 'notFound', label: '无歌词', value: summary.notFound },
        { key: 'failed', label: '失败', value: summary.failed, tone: summary.failed ? 'warning' as const : 'muted' as const },
      ]
    : []

  const desc = scanning
    ? '正在体检曲库…'
    : items.length
      ? (health.lyricsUnknown
          ? `另有 ${health.lyricsUnknown} 首 content:// 条目无法判断同目录 .lrc，已跳过`
          : '首旁边的同名 .lrc 缺失；补全时会先读内嵌歌词 / 缓存，再联网')
      : health.lyricsUnknown
        ? `${health.lyricsUnknown} 首 content:// 条目无法检测，其余歌曲歌词都齐了`
        : '歌词都齐了'

  return (
    <Card title='歌词补全' desc='检测同目录同名 .lrc，缺歌词时联网补全并写入文件'>
      <InfoLine
        label='缺少歌词（.lrc）的歌曲'
        desc={desc}
        value={scanning ? '—' : items.length}
        tone={items.length ? 'warning' : undefined}
      />

      {running ? <ProgressLine label='正在补歌词' done={progress.done} total={progress.total} /> : null}

      {summary ? <SummaryChips chips={chips} /> : null}
      {summary ? <ReportButtons getTitle={() => '歌词补全结果'} getLines={() => [
        `写入 ${summary.written} 首，无歌词 ${summary.notFound} 首，失败 ${summary.failed} 首`,
        ...(failures.length ? ['明细：', ...failures] : []),
      ]} /> : null}

      {!scanning && rows.length ? <PreviewList rows={rows} /> : null}

      {
        !running && !scanning && !items.length
          ? <EmptyState text='没有缺少 .lrc 的歌曲' />
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
                label={scanning ? '正在体检曲库…' : '开始补歌词'}
                icon='file-music-outline'
                disabled={scanning || !items.length}
                onPress={() => { void handleStart() }}
              />
              )
        }
      </ButtonRow>
    </Card>
  )
})
