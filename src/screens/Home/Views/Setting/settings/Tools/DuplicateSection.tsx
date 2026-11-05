import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'

import { cleanSongName } from '@/utils/songName'
import { toast } from '@/utils/tools'
import {
  buildDuplicateReport,
  removeDuplicateEntries,
  type DuplicateCleanSummary,
} from './duplicates'
import type { LibraryHealth } from './health'
import { acquireToolsBusy, releaseToolsBusy } from './taskLock'
import {
  ButtonRow,
  Card,
  EmptyState,
  InfoLine,
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

/**
 * 重复歌曲：同歌名 + 同歌手（归一化后）的条目分组展示。
 *
 * 只从曲库移除多余记录，不删磁盘文件 —— 用户误判时重新扫描目录就能恢复。
 * 每组保留体积最大的一首（通常码率/完整度更好），其余多出来的才是「多余」。
 */
export default memo(({ health, scanning, onChanged }: Props) => {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [summary, setSummary] = useState<DuplicateCleanSummary | null>(null)

  const aliveRef = useRef(true)
  const runningRef = useRef(false)

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const groups = health.duplicates
  const extrasCount = health.duplicateExtras

  const doRemove = useCallback(async() => {
    if (runningRef.current || !groups.length) return
    if (!acquireToolsBusy()) {
      toast('另一个批量任务正在运行，请稍候')
      return
    }
    runningRef.current = true
    setRunning(true)
    setSummary(null)
    try {
      const result = await removeDuplicateEntries(groups, {
        onProgress: setProgress,
        isAlive: () => aliveRef.current,
      })
      if (!aliveRef.current) return
      setSummary(result)
      toast(`已从曲库移除 ${result.removed} 首重复条目${result.failed ? `，${result.failed} 首失败` : ''}（未删除任何文件）`)
      onChanged()
    } finally {
      releaseToolsBusy()
      runningRef.current = false
      if (aliveRef.current) setRunning(false)
    }
  }, [groups, onChanged])

  const handlePress = useCallback(() => {
    if (runningRef.current || !extrasCount) return
    Alert.alert(
      '清理重复歌曲',
      `曲库里有 ${groups.length} 组重复（共 ${extrasCount} 首多余）。\n\n` +
      '每组保留体积最大的一首，其余只从曲库移除记录，不会删除任何磁盘文件。',
      [
        { text: '取消', style: 'cancel' },
        { text: '清理', style: 'destructive', onPress: () => { void doRemove() } },
      ],
    )
  }, [groups.length, extrasCount, doRemove])

  const rows: PreviewRow[] = groups.slice(0, 30).map(group => {
    const keep = group.items[0]
    const rest = group.items.length - 1
    return {
      key: group.key,
      item: keep,
      title: cleanSongName(keep.name, keep.singer),
      sub: `${keep.singer || '未知歌手'} · 组内 ${group.items.length} 首，保留体积最大的这首`,
      tags: `重复 ${rest} 首`,
    }
  })

  const chips = summary
    ? [
        ...(summary.stopped ? [{ key: 'stopped', label: '已停止', value: '', tone: 'warning' as const }] : []),
        { key: 'removed', label: '已移除', value: summary.removed, tone: 'primary' as const },
        { key: 'failed', label: '失败', value: summary.failed, tone: summary.failed ? 'warning' as const : 'muted' as const },
      ]
    : []

  return (
    <Card title='重复歌曲' desc='同歌名 + 同歌手归一化后相同的条目；只移除曲库记录，不删文件'>
      <InfoLine
        label='重复条目'
        desc={scanning
          ? '正在体检曲库…'
          : groups.length
            ? `${groups.length} 组重复，共 ${extrasCount} 首多余；每组保留体积最大的一首`
            : '没有重复歌曲'}
        value={scanning ? '—' : extrasCount}
        tone={extrasCount ? 'warning' : undefined}
      />

      {running ? <ProgressLine label='正在清理重复条目' done={progress.done} total={progress.total} /> : null}

      {summary ? <SummaryChips chips={chips} /> : null}

      {!scanning && rows.length ? <PreviewList rows={rows} /> : null}

      {
        !running && !scanning && !groups.length
          ? <EmptyState text='没有重复歌曲' icon='content-duplicate' />
          : null
      }

      {summary ? <ReportButtons getTitle={() => '重复歌曲清理结果'} getLines={() => buildDuplicateReport(summary)} /> : null}

      {
        !running && extrasCount
          ? (
            <ButtonRow>
              <SecondaryButton
                label={`移除 ${extrasCount} 首重复记录`}
                icon='delete-sweep-outline'
                disabled={scanning}
                danger
                onPress={handlePress}
              />
            </ButtonRow>
            )
          : null
      }
    </Card>
  )
})
