import { memo, useCallback, useEffect, useRef, useState } from 'react'

import { toast } from '@/utils/tools'
import { cleanSongName } from '@/utils/songName'
import type { LibraryHealth } from './health'
import { fixCovers, type CoverFixSummary } from './coverFix'
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
  SummaryChips,
  type PreviewRow,
} from './parts'

interface Props {
  health: LibraryHealth
  scanning: boolean
  onChanged: () => void
}

/** 设置 → 音乐工具 → 封面修复（统计来自父级曲库体检，这里只负责修） */
export default memo(({ health, scanning, onChanged }: Props) => {
  const [fixing, setFixing] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [summary, setSummary] = useState<CoverFixSummary | null>(null)

  const aliveRef = useRef(true)
  const fixingRef = useRef(false)
  const failuresRef = useRef<string[]>([])
  const [failures, setFailures] = useState<string[]>([])

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const healableCount = health.healableCovers.length
  const missingCount = health.missingCovers.length
  const fixableCount = healableCount + missingCount

  const handleFix = useCallback(async() => {
    if (fixingRef.current) return
    // 固定住这次要处理的快照：体检结果在任务期间不会再变
    const healable = health.healableCovers
    const missing = health.missingCovers
    if (!healable.length && !missing.length) return
    if (!acquireToolsBusy()) {
      toast('另一个批量任务正在运行，请稍候')
      return
    }
    fixingRef.current = true
    setFixing(true)
    setSummary(null)
    failuresRef.current = []
    setFailures([])
    try {
      const result = await fixCovers(healable, missing, {
        onProgress: setProgress,
        isAlive: () => aliveRef.current,
        onItemResult: (item, status) => {
          if (status !== 'notFound') return
          failuresRef.current.push(`${cleanSongName(item.name, item.singer)} - ${item.singer || '未知歌手'}`)
        },
      })
      if (!aliveRef.current) return
      setSummary(result)
      setFailures([...failuresRef.current])
      const fixed = result.local + result.network + result.libraryOnly
      toast(`补封面完成：成功 ${fixed} 首${result.notFound ? `，未找到 ${result.notFound} 首` : ''}`)
      onChanged()
    } finally {
      releaseToolsBusy()
      fixingRef.current = false
      if (aliveRef.current) setFixing(false)
    }
  }, [health.healableCovers, health.missingCovers, onChanged])

  const rows: PreviewRow[] = health.missingCovers.slice(0, 30).map(item => ({
    key: item.id,
    item,
    title: cleanSongName(item.name, item.singer),
    sub: item.singer || '未知歌手',
  }))

  const desc = scanning
    ? '正在体检曲库…'
    : missingCount
      ? (healableCount
          ? `其中 ${healableCount} 首文件里其实有封面（修复时写回曲库），${missingCount} 首需要联网找`
          : '先读文件内嵌封面，没有才联网搜索')
      : healableCount
        ? `缺封面 0 首；另有 ${healableCount} 首的本地封面可写回曲库`
        : '封面都齐了'

  return (
    <Card title='封面修复' desc='先读文件内嵌封面，没有才联网搜索；写完尽量写回音频文件'>
      <InfoLine
        label='缺少封面的歌曲'
        desc={desc}
        value={scanning ? '—' : missingCount}
        tone={missingCount ? 'warning' : undefined}
      />

      {fixing ? <ProgressLine label='正在修复' done={progress.done} total={progress.total} /> : null}

      {
        summary
          ? (
            <SummaryChips
              chips={[
                { key: 'local', label: '本地封面', value: summary.local, tone: 'primary' },
                { key: 'network', label: '网络封面', value: summary.network, tone: 'primary' },
                { key: 'library', label: '仅曲库', value: summary.libraryOnly },
                { key: 'notFound', label: '未找到', value: summary.notFound, tone: summary.notFound ? 'warning' : 'muted' },
              ]}
            />
            )
          : null
      }

      {summary ? <ReportButtons getTitle={() => '补封面结果'} getLines={() => [
        `成功 ${summary.local + summary.network + summary.libraryOnly} 首（本地 ${summary.local} / 网络 ${summary.network} / 仅曲库 ${summary.libraryOnly}），未找到 ${summary.notFound} 首`,
        ...(failures.length ? ['未找到清单：', ...failures] : []),
      ]} /> : null}

      {!scanning && rows.length ? <PreviewList rows={rows} /> : null}

      {
        !fixing && !scanning && !fixableCount
          ? <EmptyState text='没有缺封面的歌曲' />
          : null
      }

      {
        !fixing
          ? (
            <ButtonRow>
              <PrimaryButton
                label={scanning ? '正在体检曲库…' : '开始补封面'}
                icon='auto-fix'
                disabled={scanning || !fixableCount}
                onPress={() => { void handleFix() }}
              />
            </ButtonRow>
            )
          : null
      }
    </Card>
  )
})
