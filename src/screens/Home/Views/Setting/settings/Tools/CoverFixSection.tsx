import { memo, useCallback, useEffect, useRef, useState } from 'react'

import Section from '../../components/Section'
import { toast } from '@/utils/tools'
import { cleanSongName } from '@/utils/songName'
import { fixCovers, scanMissingCovers, type CoverFixSummary } from './coverFix'
import { ActionRow, CountRow, PreviewList, ProgressLine, SummaryBar, type PreviewRow } from './parts'
import { acquireToolsBusy, releaseToolsBusy } from './taskLock'

interface Props {
  /** 其它区块改过曲库后 +1，触发重新统计 */
  refreshToken: number
  /** 本区块改过曲库后通知父级；父级会 +1 refreshToken 让两个区块各自重扫 */
  onChanged: () => void
}

/** 设置 → 音乐工具 → 封面修复 */
export default memo(({ refreshToken, onChanged }: Props) => {
  const [missing, setMissing] = useState<LX.Music.MusicInfoLocal[]>([])
  const [total, setTotal] = useState(0)
  const [scanning, setScanning] = useState(true)
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 })
  const [fixing, setFixing] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [summary, setSummary] = useState<CoverFixSummary | null>(null)

  const aliveRef = useRef(true)
  const scanningRef = useRef(false)
  const fixingRef = useRef(false)

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const scan = useCallback(async() => {
    // 防重入：外部连续改曲库时只跑一轮，避免两轮扫描同时读文件
    if (scanningRef.current || fixingRef.current) return
    scanningRef.current = true
    setScanning(true)
    try {
      const result = await scanMissingCovers({
        onProgress: setScanProgress,
        isAlive: () => aliveRef.current,
      })
      if (!aliveRef.current || !result) return
      setTotal(result.total)
      setMissing(result.missing)
    } finally {
      scanningRef.current = false
      if (aliveRef.current) setScanning(false)
    }
  }, [])

  useEffect(() => {
    // 首次进入 / 别处改过曲库（例如刮削标签时顺手补了封面）都重新统计一次
    void scan()
  }, [scan, refreshToken])

  const handleFix = useCallback(async() => {
    if (fixingRef.current || !missing.length) return
    if (!acquireToolsBusy()) {
      toast('另一个批量任务正在运行，请稍候')
      return
    }
    fixingRef.current = true
    setFixing(true)
    setSummary(null)
    try {
      const result = await fixCovers(missing, {
        onProgress: setProgress,
        isAlive: () => aliveRef.current,
      })
      if (!aliveRef.current) return
      setSummary(result)
      const fixed = result.local + result.network + result.libraryOnly
      toast(`补封面完成：成功 ${fixed} 首${result.notFound ? `，未找到 ${result.notFound} 首` : ''}`)
      // 让父级 +1 refreshToken → 两个区块重新统计，缺封面数量必须下降
      onChanged()
    } finally {
      releaseToolsBusy()
      fixingRef.current = false
      if (aliveRef.current) setFixing(false)
    }
  }, [missing, onChanged])

  const rows: PreviewRow[] = missing.slice(0, 30).map(item => ({
    key: item.id,
    title: cleanSongName(item.name, item.singer),
    sub: item.singer || '未知歌手',
  }))
  const hasMissing = missing.length > 0
  const busy = scanning || fixing

  const summaryText = summary
    ? `本地封面 ${summary.local} 首 · 网络封面 ${summary.network} 首` +
      `${summary.libraryOnly ? ` · 仅曲库 ${summary.libraryOnly} 首` : ''}` +
      `${summary.notFound ? ` · 未找到 ${summary.notFound} 首` : ''}`
    : ''

  return (
    <>
      <Section title='封面修复' desc='优先用文件里的封面，没有才联网搜索'>
        <CountRow
          title='缺少封面的歌曲'
          desc={scanning
            ? scanProgress.total
              ? `正在检查曲库 ${scanProgress.done} / ${scanProgress.total}…`
              : '正在检查曲库…'
            : hasMissing
              ? `共 ${total} 首，其中 ${missing.length} 首需要补封面`
              : `共 ${total} 首，全部都有封面`}
          count={scanning ? '—' : missing.length}
          highlight={!scanning && hasMissing}
        />
        {
          fixing
            ? <ProgressLine label='正在修复' done={progress.done} total={progress.total} />
            : (
              <ActionRow
                label={scanning ? '正在检查曲库…' : hasMissing ? '开始补封面' : '没有需要修复的歌曲'}
                icon='auto-fix'
                disabled={!hasMissing || busy}
                onPress={() => { void handleFix() }}
                onRefresh={() => { void scan() }}
                refreshDisabled={busy}
              />
              )
        }
        {summary ? <SummaryBar text={summaryText} /> : null}
      </Section>

      {
        hasMissing && !fixing
          ? (
            <Section title='待修复列表' desc='最多显示 30 首'>
              <PreviewList rows={rows} />
            </Section>
            )
          : null
      }
    </>
  )
})
