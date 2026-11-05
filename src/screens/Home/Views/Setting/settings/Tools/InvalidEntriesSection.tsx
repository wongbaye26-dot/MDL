import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'

import { toast } from '@/utils/tools'
import { cleanSongName } from '@/utils/songName'
import type { LibraryHealth } from './health'
import { removeInvalidEntries, type InvalidCleanSummary } from './invalid'
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

/** 设置 → 音乐工具 → 无效条目（文件已不存在，只从曲库移除记录，不删任何文件） */
export default memo(({ health, scanning, onChanged }: Props) => {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [summary, setSummary] = useState<InvalidCleanSummary | null>(null)

  const aliveRef = useRef(true)
  const runningRef = useRef(false)

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const items = health.invalid

  const doRemove = useCallback(async() => {
    // 固定住这次要移除的快照
    const targets = items
    if (runningRef.current || !targets.length) return
    if (!acquireToolsBusy()) {
      toast('另一个批量任务正在运行，请稍候')
      return
    }
    runningRef.current = true
    setRunning(true)
    setSummary(null)
    try {
      const result = await removeInvalidEntries(targets, {
        onProgress: setProgress,
        isAlive: () => aliveRef.current,
      })
      if (!aliveRef.current) return
      setSummary(result)
      toast(`已从曲库移除 ${result.removed} 首无效条目${result.failed ? `，${result.failed} 首失败` : ''}（未删除任何文件）`)
      onChanged()
    } finally {
      releaseToolsBusy()
      runningRef.current = false
      if (aliveRef.current) setRunning(false)
    }
  }, [items, onChanged])

  const handlePress = useCallback(() => {
    if (runningRef.current || !items.length) return
    Alert.alert(
      '从曲库移除无效条目',
      `曲库里有 ${items.length} 首歌的文件已经不存在了。\n\n只会删除曲库记录，不会删除任何磁盘文件。`,
      [
        { text: '取消', style: 'cancel' },
        { text: '移除', style: 'destructive', onPress: () => { void doRemove() } },
      ],
    )
  }, [items.length, doRemove])

  const rows: PreviewRow[] = items.slice(0, 30).map(item => ({
    key: item.id,
    item,
    title: cleanSongName(item.name, item.singer),
    sub: (item.meta.filePath ?? '').split('/').slice(-2).join('/') || '文件不存在',
  }))

  const chips = summary
    ? [
        { key: 'removed', label: '已移除', value: summary.removed, tone: 'primary' as const },
        { key: 'failed', label: '失败', value: summary.failed, tone: summary.failed ? 'warning' as const : 'muted' as const },
      ]
    : []

  return (
    <Card title='无效条目' desc='曲库里记录的文件已经不存在；移除不会删除磁盘文件'>
      <InfoLine
        label='文件已丢失的歌曲'
        desc={scanning
          ? '正在体检曲库…'
          : items.length
            ? '这些歌已经无法播放，移除后曲库更干净（文件本来就不在了）'
            : '没有无效条目'}
        value={scanning ? '—' : items.length}
        tone={items.length ? 'warning' : undefined}
      />

      {running ? <ProgressLine label='正在移除' done={progress.done} total={progress.total} /> : null}

      {summary ? <SummaryChips chips={chips} /> : null}
      {summary ? <ReportButtons getTitle={() => '无效条目清理结果'} getLines={() => [
        `已从曲库移除 ${summary.removed} 首无效条目（未删除任何文件），失败 ${summary.failed} 首`,
      ]} /> : null}

      {!scanning && rows.length ? <PreviewList rows={rows} /> : null}

      {
        !running && !scanning && !items.length
          ? <EmptyState text='没有无效条目' icon='file-check-outline' />
          : null
      }

      {
        !running && items.length
          ? (
            <ButtonRow>
              <SecondaryButton
                label={`从曲库移除 ${items.length} 首`}
                icon='delete-outline'
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
