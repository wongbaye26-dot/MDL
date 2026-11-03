import { memo, useCallback, useEffect, useRef, useState } from 'react'

import Section from '../../components/Section'
import { toast } from '@/utils/tools'
import { cleanSongName } from '@/utils/songName'
import type { TagIncompleteItem } from '@/core/localMusic/scrape'
import { runTagScrape, scanTags, type TagScrapeSummary } from './tagScrape'
import { ActionRow, CountRow, PreviewList, ProgressLine, StopRow, SummaryBar, type PreviewRow } from './parts'
import { acquireToolsBusy, releaseToolsBusy } from './taskLock'

interface Props {
  /** 其它区块改过曲库后 +1，触发重新统计 */
  refreshToken: number
  /** 本区块改过曲库后通知父级；父级会 +1 refreshToken 让两个区块各自重扫 */
  onChanged: () => void
}

/** 设置 → 音乐工具 → 批量刮削标签 */
export default memo(({ refreshToken, onChanged }: Props) => {
  const [items, setItems] = useState<TagIncompleteItem[]>([])
  const [total, setTotal] = useState(0)
  const [scanning, setScanning] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [stopping, setStopping] = useState(false)
  const [summary, setSummary] = useState<TagScrapeSummary | null>(null)

  const aliveRef = useRef(true)
  const scanningRef = useRef(false)
  const runningRef = useRef(false)
  /** 用户点了停止：批量循环在每首歌开始前检查一次 */
  const stopRef = useRef(false)

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const scan = useCallback(async() => {
    if (scanningRef.current || runningRef.current) return
    scanningRef.current = true
    setScanning(true)
    try {
      const result = await scanTags(() => aliveRef.current)
      if (!aliveRef.current || !result) return
      setTotal(result.total)
      setItems(result.items)
    } finally {
      scanningRef.current = false
      if (aliveRef.current) setScanning(false)
    }
  }, [])

  useEffect(() => {
    void scan()
  }, [scan, refreshToken])

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
    try {
      const result = await runTagScrape(items, {
        onProgress: setProgress,
        shouldStop: () => stopRef.current,
        isAlive: () => aliveRef.current,
      })
      if (!aliveRef.current) return
      setSummary(result)
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

  const previewRows: PreviewRow[] = items.slice(0, 30).map(({ item, issues }) => ({
    key: item.id,
    title: cleanSongName(item.name, item.singer),
    sub: issues.join(' · '),
  }))
  const hasItems = items.length > 0
  const busy = scanning || running

  const summaryText = summary
    ? `${summary.stopped ? '已停止 · ' : ''}写入文件 ${summary.file} 首` +
      `${summary.libraryOnly ? ` · 仅曲库 ${summary.libraryOnly} 首` : ''}` +
      `${summary.notFound ? ` · 未找到 ${summary.notFound} 首` : ''}` +
      `${summary.cover ? ` · 顺带补封面 ${summary.cover} 首` : ''}`
    : ''

  return (
    <>
      <Section title='标签刮削' desc='联网补全歌名 / 歌手 / 专辑，尽量写进音频文件'>
        <CountRow
          title='标签可补全的歌曲'
          desc={scanning
            ? '正在检查曲库…'
            : hasItems
              ? `共 ${total} 首，其中 ${items.length} 首可以补全`
              : `共 ${total} 首，标签都完整`}
          count={scanning ? '—' : items.length}
          highlight={!scanning && hasItems}
        />
        {
          running
            ? (
              <>
                <ProgressLine label='正在刮削' done={progress.done} total={progress.total} />
                <StopRow onStop={handleStop} disabled={stopping} />
              </>
              )
            : (
              <ActionRow
                label={scanning ? '正在检查曲库…' : hasItems ? '开始刮削' : '没有需要刮削的歌曲'}
                icon='tag-multiple'
                disabled={!hasItems || busy}
                onPress={() => { void handleStart() }}
                onRefresh={() => { void scan() }}
                refreshDisabled={busy}
              />
              )
        }
        {summary ? <SummaryBar text={summaryText} /> : null}
      </Section>

      {
        hasItems && !running
          ? (
            <Section title='待刮削列表' desc='最多显示 30 首'>
              <PreviewList rows={previewRows} />
            </Section>
            )
          : null
      }
    </>
  )
})
