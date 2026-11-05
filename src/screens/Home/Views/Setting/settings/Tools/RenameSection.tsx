import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Alert, TextInput, View } from 'react-native'

import Text from '@/components/common/Text'
import { getLocalMusicList } from '@/core/localMusic'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import type { LibraryHealth } from './health'
import {
  DEFAULT_RENAME_TEMPLATE,
  buildRenamePreview,
  buildRenameReport,
  renderRenameName,
  runRenameBatch,
  summarizeRenamePreview,
  type RenamePreviewItem,
  type RenameSummary,
} from './renameFiles'
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

const STATUS_TAG: Record<RenamePreviewItem['status'], string> = {
  ok: '将改名',
  unchanged: '名字相同',
  conflict: '冲突',
  saf: 'SAF 跳过',
  invalid: '无效',
}

/**
 * 批量重命名：按统一模板改名（默认 `{歌手} - {歌名}`）。
 *
 * 流程强制两步：先「生成预览」看旧名 → 新名与冲突情况，确认后再执行；
 * 执行时同步改名 .lrc、更新曲库记录、补扫媒体库，失败会列清单可复制。
 */
export default memo(({ health, scanning, onChanged }: Props) => {
  const theme = useTheme()
  const [items, setItems] = useState<LX.Music.MusicInfoLocal[]>([])
  const [template, setTemplate] = useState(DEFAULT_RENAME_TEMPLATE)
  const [preview, setPreview] = useState<RenamePreviewItem[] | null>(null)
  const [building, setBuilding] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [summary, setSummary] = useState<RenameSummary | null>(null)
  const [loadingList, setLoadingList] = useState(true)

  const aliveRef = useRef(true)
  const runningRef = useRef(false)

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  // 体检重扫后（health.total 变化）重新拉一次曲库列表，保证预览基于最新数据
  useEffect(() => {
    let alive = true
    setLoadingList(true)
    void getLocalMusicList().then(list => {
      if (!alive) return
      setItems(list)
      setPreview(null)
    }).finally(() => {
      if (alive) setLoadingList(false)
    })
    return () => { alive = false }
  }, [health.total])

  const stat = preview ? summarizeRenamePreview(preview) : null

  const handlePreview = useCallback(async() => {
    if (building || runningRef.current) return
    if (!items.length) return
    setBuilding(true)
    setSummary(null)
    try {
      const result = await buildRenamePreview(items, template)
      if (!aliveRef.current) return
      setPreview(result)
      const ok = result.filter(item => item.status === 'ok').length
      if (!ok) toast('没有可以改名的文件（名字相同 / 冲突 / SAF 目录）')
    } finally {
      if (aliveRef.current) setBuilding(false)
    }
  }, [items, template, building])

  const doRename = useCallback(async() => {
    if (!preview || runningRef.current) return
    if (!acquireToolsBusy()) {
      toast('另一个批量任务正在运行，请稍候')
      return
    }
    runningRef.current = true
    setRunning(true)
    setSummary(null)
    try {
      const result = await runRenameBatch(preview, {
        onProgress: setProgress,
        isAlive: () => aliveRef.current,
      })
      if (!aliveRef.current) return
      setSummary(result)
      toast(`重命名完成：成功 ${result.renamed} 首${result.failed ? `，失败 ${result.failed} 首` : ''}`)
      setPreview(null)
      // 路径变了，重新拉一次列表，避免下一次预览基于旧路径
      setItems(await getLocalMusicList())
      onChanged()
    } finally {
      releaseToolsBusy()
      runningRef.current = false
      if (aliveRef.current) setRunning(false)
    }
  }, [preview, onChanged])

  const okPreviewItem = preview?.find(item => item.status === 'ok')?.item

  const handleRun = useCallback(() => {
    if (!preview || !stat?.ok || !okPreviewItem) return
    Alert.alert(
      '批量重命名',
      `将重命名 ${stat.ok} 首歌曲，同时改名同名 .lrc 并更新曲库。\n\n` +
      `模板：${template}\n示例：${renderRenameName(okPreviewItem, template)}`,
      [
        { text: '取消', style: 'cancel' },
        { text: '开始改名', onPress: () => { void doRename() } },
      ],
    )
  }, [preview, stat, okPreviewItem, template, doRename])

  const rows: PreviewRow[] = (preview ?? [])
    .filter(item => item.status !== 'unchanged')
    .slice(0, 30)
    .map((item, index) => ({
      key: `${item.item.id}_${index}`,
      item: item.item,
      title: item.newName || '（渲染为空）',
      sub: `原名：${item.oldName || '未知'}${item.reason ? ` · ${item.reason}` : ''}`,
      tags: STATUS_TAG[item.status],
    }))

  const chips = stat
    ? [
        { key: 'ok', label: '可改名', value: stat.ok, tone: stat.ok ? 'primary' as const : 'muted' as const },
        { key: 'conflict', label: '冲突', value: stat.conflict, tone: stat.conflict ? 'warning' as const : 'muted' as const },
        { key: 'saf', label: 'SAF 跳过', value: stat.saf, tone: 'muted' as const },
        { key: 'invalid', label: '无效', value: stat.invalid, tone: stat.invalid ? 'warning' as const : 'muted' as const },
        { key: 'unchanged', label: '同名', value: stat.unchanged, tone: 'muted' as const },
      ]
    : []

  const summaryChips = summary
    ? [
        ...(summary.stopped ? [{ key: 'stopped', label: '已停止', value: '', tone: 'warning' as const }] : []),
        { key: 'renamed', label: '已改名', value: summary.renamed, tone: 'primary' as const },
        { key: 'failed', label: '失败', value: summary.failed, tone: summary.failed ? 'warning' as const : 'muted' as const },
        { key: 'skipped', label: '跳过', value: summary.skipped, tone: 'muted' as const },
      ]
    : []

  const exampleName = items.length ? renderRenameName(items[0], template) : ''

  return (
    <Card title='批量重命名' desc='按统一模板改名；先预览再执行，支持 {歌名} {歌手} {专辑}'>
      <InfoLine
        label='曲库歌曲'
        desc={loadingList
          ? '正在读取曲库…'
          : `模板示例：${exampleName || '（模板渲染为空）'}；支持占位符 {歌名} {歌手} {专辑}`}
        value={loadingList ? '—' : items.length}
      />

      <View style={styles.inputWrap}>
        <TextInput
          value={template}
          onChangeText={text => {
            setTemplate(text)
            setPreview(null)
            setSummary(null)
          }}
          placeholder={DEFAULT_RENAME_TEMPLATE}
          placeholderTextColor={theme['c-450']}
          style={{
            ...styles.input,
            color: theme['c-font'],
            backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)',
          }}
        />
        <Text size={10.5} color={theme['c-450']} style={styles.hint}>
          不改扩展名（由文件自身决定）；非法字符会被自动过滤，过长文件名会裁剪。
        </Text>
      </View>

      {
        building
          ? <ProgressLine label='正在检查目标文件名' done={0} total={items.length} />
          : null
      }
      {running ? <ProgressLine label='正在重命名' done={progress.done} total={progress.total} /> : null}

      {stat ? <SummaryChips chips={chips} /> : null}
      {summary ? <SummaryChips chips={summaryChips} /> : null}

      {!running && rows.length ? <PreviewList rows={rows} /> : null}

      {!running && stat && !stat.ok && preview
        ? <EmptyState text='没有可以改名的文件' icon='file-rename-outline' />
        : null}

      {summary ? <ReportButtons getTitle={() => '批量重命名结果'} getLines={() => buildRenameReport(summary)} /> : null}

      <ButtonRow>
        {
          running
            ? (
              <SecondaryButton
                label='正在改名…'
                icon='timer-sand'
                disabled
                onPress={() => {}}
              />
              )
            : (
              <>
                <PrimaryButton
                  label={building ? '正在生成预览…' : '生成预览'}
                  icon='file-search-outline'
                  disabled={building || loadingList || !items.length}
                  onPress={() => { void handlePreview() }}
                />
                {
                  stat?.ok
                    ? (
                      <SecondaryButton
                        label={`执行改名 ${stat.ok} 首`}
                        icon='file-rename-outline'
                        onPress={handleRun}
                      />
                      )
                    : null
                }
              </>
              )
        }
      </ButtonRow>
    </Card>
  )
})

const styles = createStyle({
  inputWrap: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingBottom: 10,
  },
  input: {
    height: 40,
    borderRadius: 10,
    borderWidth: 0.5,
    paddingLeft: 12,
    paddingRight: 12,
    fontSize: 13,
  },
  hint: {
    marginTop: 6,
    lineHeight: 15,
  },
})
