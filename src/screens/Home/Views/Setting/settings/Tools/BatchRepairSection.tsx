import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import {
  buildBatchRepairReport,
  countBatchRepairTotal,
  runBatchRepair,
  type BatchRepairSummary,
} from './batchRepair'
import type { LibraryHealth } from './health'
import { acquireToolsBusy, releaseToolsBusy } from './taskLock'
import {
  ButtonRow,
  Card,
  EmptyState,
  InfoLine,
  PrimaryButton,
  ProgressLine,
  ReportButtons,
  SecondaryButton,
  SummaryChips,
} from './parts'

interface Props {
  health: LibraryHealth
  scanning: boolean
  onChanged: () => void
}

/**
 * 一键修复：把「缺封面 / 标签待补 / 缺歌词」三件事按顺序串行跑一遍。
 *
 * 和下面各分区按钮的区别：这是给「不想一个个点」的用户准备的兜底入口，
 * 每首只处理真正缺的东西，跑完给出汇总 + 失败清单（可复制 / 导出日志）。
 */
export default memo(({ health, scanning, onChanged }: Props) => {
  const theme = useTheme()
  const [running, setRunning] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' })
  const [summary, setSummary] = useState<BatchRepairSummary | null>(null)

  const aliveRef = useRef(true)
  const runningRef = useRef(false)
  const stopRef = useRef(false)

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const total = countBatchRepairTotal(health)

  const handleStart = useCallback(async() => {
    if (runningRef.current || !total) return
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
      const result = await runBatchRepair(health, {
        onProgress: setProgress,
        shouldStop: () => stopRef.current,
        isAlive: () => aliveRef.current,
      })
      if (!aliveRef.current) return
      setSummary(result)
      const fixed = result.coverLocal + result.coverNetwork + result.tagFile + result.lyricWritten
      toast(result.stopped
        ? `已停止：完成了 ${fixed} 首的修复`
        : `一键修复完成：处理 ${total} 首，失败/未找到 ${result.failures.length} 条`)
      onChanged()
    } finally {
      releaseToolsBusy()
      runningRef.current = false
      if (aliveRef.current) {
        setRunning(false)
        setStopping(false)
      }
    }
  }, [health, total, onChanged])

  const handlePress = useCallback(() => {
    if (runningRef.current || !total) return
    void confirmDialog({
      title: '一键修复曲库',
      message: `将按「补封面 → 刮削标签 → 补歌词」的顺序处理 ${total} 首歌曲。\n\n` +
        '过程可以随时停止，已完成的结果会保留；联网请求较多，建议在 Wi-Fi 下进行。',
      cancelButtonText: '取消',
      confirmButtonText: '开始',
    }).then(confirm => {
      if (confirm) void handleStart()
    })
  }, [total, handleStart])

  const handleStop = useCallback(() => {
    if (!runningRef.current || stopRef.current) return
    stopRef.current = true
    setStopping(true)
    toast('正在停止，已完成的修复会保留')
  }, [])

  const chips = summary
    ? [
        ...(summary.stopped ? [{ key: 'stopped', label: '已停止', value: '', tone: 'warning' as const }] : []),
        { key: 'cover', label: '封面', value: summary.coverLocal + summary.coverNetwork, tone: 'primary' as const },
        { key: 'tag', label: '标签', value: summary.tagFile, tone: 'primary' as const },
        { key: 'lyric', label: '歌词', value: summary.lyricWritten, tone: 'primary' as const },
        { key: 'failed', label: '失败/未找到', value: summary.failures.length, tone: summary.failures.length ? 'warning' as const : 'muted' as const },
      ]
    : []

  const reportLines = summary ? buildBatchRepairReport(summary) : []

  const desc = scanning
    ? '正在体检曲库…'
    : total
      ? `将处理 ${health.missingCovers.length + health.healableCovers.length} 首封面、${health.tagIncomplete.length} 首标签、${health.missingLyrics.length} 首歌词`
      : '曲库很干净，没有需要修复的内容'

  return (
    <Card title='一键修复' desc='按「补封面 → 刮削标签 → 补歌词」顺序串行处理，可随时停止'>
      <InfoLine label='待修复歌曲' desc={desc} value={scanning ? '—' : total} tone={total ? 'warning' : undefined} />

      {running ? <ProgressLine label={progress.label || '正在修复'} done={progress.done} total={progress.total} /> : null}

      {summary ? <SummaryChips chips={chips} /> : null}

      {
        summary?.failures.length
          ? (
            <View style={styles.failureBlock}>
              <Text size={11} color={theme['c-450']} style={styles.failureTitle}>
                失败 / 未找到清单（前 {Math.min(20, summary.failures.length)} 条，完整内容可复制或导出）
              </Text>
              <ScrollView style={styles.failureList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {
                  summary.failures.slice(0, 20).map((line, index) => (
                    <Text
                      key={`${index}_${line}`}
                      size={11}
                      color={theme['c-450']}
                      style={{
                        ...styles.failureLine,
                        borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                        borderTopColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                      }}
                    >
                      {line}
                    </Text>
                  ))
                }
              </ScrollView>
            </View>
            )
          : null
      }

      {summary ? <ReportButtons getTitle={() => '一键修复结果'} getLines={() => reportLines} /> : null}

      {
        !running && !scanning && !total
          ? <EmptyState text='没有需要修复的歌曲' />
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
                label={scanning ? '正在体检曲库…' : `一键修复 ${total} 首`}
                icon='auto-fix'
                disabled={scanning || !total}
                onPress={handlePress}
              />
              )
        }
      </ButtonRow>
    </Card>
  )
})

const styles = createStyle({
  failureBlock: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingBottom: 8,
  },
  failureTitle: {
    lineHeight: 15,
    marginBottom: 4,
  },
  failureList: {
    maxHeight: 160,
  },
  failureLine: {
    lineHeight: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
})
