import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'

import { Group } from '../../components/ui'
import Button from '../../components/Button'
import Text from '@/components/common/Text'
import Tag from '@/components/common/Tag'
import Input from '@/components/common/Input'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useUserApiList } from '@/store/userApi'
import {
  createSourceCheckTask,
  formatSourceCheckResult,
  DEFAULT_CHECK_KEYWORD,
  type SourceCheckProgress,
  type SourceCheckResult,
  type SourceCheckTask,
  type SourceCheckPhase,
} from '@/core/sourceCheck'
import { clipboardWriteText, createStyle, toast } from '@/utils/tools'
import { log } from '@/utils/log'
import { notifySourcePageState, sourcePageState, useQualityList, useSourcePageState } from './state'
import { formatSize, qualityLabel } from './helpers'

const getStatusColor = (status: SourceCheckResult['status'], fallback: string) => {
  switch (status) {
    case 'ok': return '#10B981'
    case 'failed': return '#EF4444'
    case 'checking': return '#F59E0B'
    default: return fallback
  }
}

const ResultItem = ({ result }: { result: SourceCheckResult }) => {
  const t = useI18n()
  const theme = useTheme()
  const statusColor = getStatusColor(result.status, theme['c-450'])
  const statusText = result.status === 'ok'
    ? t('setting_source_check_ok')
    : result.status === 'pending'
      ? t('setting_source_check_pending')
      : result.status === 'checking'
        ? t('setting_source_check_checking')
        : t('setting_source_check_failed')

  return (
    <View style={styles.resultItem}>
      <View style={styles.resultHead}>
        <View style={{ ...styles.dot, backgroundColor: statusColor }} />
        <View style={styles.resultNameWrap}>
          <Text size={12.5} numberOfLines={1} style={styles.resultName}>{result.sourceName}</Text>
        </View>
        <Text size={10} color={statusColor} style={styles.resultStatus}>{statusText}</Text>
        {result.bestQuality ? <Tag label={`${t('setting_source_check_best')} ${qualityLabel(result.bestQuality)}`} size='sm' tone='primary' style={styles.bestTag} /> : null}
        {result.latencyMs != null ? <Text size={9.5} color={theme['c-450']} style={styles.latency}>{result.latencyMs}ms</Text> : null}
      </View>
      {
        result.musicName
          ? <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.songLine}>{result.musicName} - {result.singer ?? ''}</Text>
          : null
      }
      {
        result.qualities.map(quality => (
          <View key={quality.quality} style={styles.qualityItem}>
            <Text size={10} style={styles.qualityName}>{qualityLabel(quality.quality)}</Text>
            <Text size={10} color={quality.ok ? '#10B981' : '#EF4444'}>
              {quality.ok ? t('setting_source_check_quality_ok') : t('setting_source_check_quality_fail')}
            </Text>
            {
              quality.bitrate
                ? <Text size={9.5} color={theme['c-450']} style={styles.qualityMeta}>约 {quality.bitrate}kbps</Text>
                : null
            }
            {
              quality.contentLength
                ? <Text size={9.5} color={theme['c-450']} style={styles.qualityMeta}>{formatSize(quality.contentLength)}</Text>
                : null
            }
            <Text size={9.5} color={theme['c-400']} style={styles.qualityMeta}>{quality.timeMs}ms</Text>
            {
              !quality.ok && quality.error
                ? <Text size={9.5} color='#EF4444' numberOfLines={1} style={styles.qualityError}>{quality.error}</Text>
                : null
            }
          </View>
        ))
      }
      {
        !result.qualities.length && result.error
          ? <Text size={10} color='#EF4444' style={styles.resultError}>{result.error}</Text>
          : null
      }
    </View>
  )
}

const PHASE_LABEL: Record<SourceCheckPhase, 'setting_source_check_phase_search' | 'setting_source_check_phase_url' | 'setting_source_check_phase_probe' | 'setting_source_check_phase_done'> = {
  search: 'setting_source_check_phase_search',
  'get-url': 'setting_source_check_phase_url',
  probe: 'setting_source_check_phase_probe',
  done: 'setting_source_check_phase_done',
}

/**
 * 音源音乐质量（实测检测）：
 * 对当前脚本的每个音源实际搜索一首探测歌、请求播放地址并探测响应头，
 * 确认「音源质量」矩阵里标称的音质是不是真的能播。
 */
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const activeId = useSettingValue('common.apiSource')
  const userApiList = useUserApiList()
  const liveQualityList = useQualityList()
  const pageState = useSourcePageState()

  const [keyword, setKeyword] = useState(pageState.lastCheckKeyword || DEFAULT_CHECK_KEYWORD)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<SourceCheckProgress | null>(null)
  const [results, setResults] = useState<SourceCheckResult[]>(pageState.lastCheckResults)
  const taskRef = useRef<SourceCheckTask | null>(null)
  const cancelledRef = useRef(false)

  const activeApi = userApiList.find(api => api.id === activeId)
  // 当前启用脚本的实时矩阵优先，其余情况退回上次初始化缓存
  const qualitys = useMemo<LX.QualityList>(
    () => Object.keys(liveQualityList).length ? liveQualityList : (activeApi?.qualitys ?? {}),
    [liveQualityList, activeApi],
  )
  const sources = useMemo(
    () => Object.keys(qualitys).filter(source => (qualitys[source as LX.Source]?.length ?? 0) > 0),
    [qualitys],
  )

  useEffect(() => {
    return () => {
      cancelledRef.current = true
      taskRef.current?.cancel()
    }
  }, [])

  const finishCheck = useCallback((finalResults: SourceCheckResult[], checkKeyword: string) => {
    const now = Date.now()
    sourcePageState.lastCheckAt = now
    sourcePageState.lastCheckKeyword = checkKeyword
    sourcePageState.lastCheckResults = finalResults
    notifySourcePageState()
    setResults(finalResults)
    setRunning(false)
    setProgress(null)
    toast(t('setting_source_check_done_tip'))
  }, [t])

  const handleStart = useCallback(() => {
    if (running) return
    if (!sources.length) {
      toast(t('setting_source_check_empty'), 'long')
      return
    }
    cancelledRef.current = false
    setRunning(true)
    setResults([])
    setProgress({ total: sources.length, finished: 0, phase: 'search', current: [], keyword })
    const task = createSourceCheckTask({
      keyword,
      qualitys,
      sources,
      onProgress: (p, r) => {
        if (cancelledRef.current) return
        setProgress(p)
        setResults(r)
      },
    })
    taskRef.current = task
    task.promise.then(finalResults => {
      if (cancelledRef.current) return
      finishCheck(finalResults, keyword)
    }).catch((err: unknown) => {
      if (cancelledRef.current) return
      setRunning(false)
      setProgress(null)
      toast(err instanceof Error ? err.message : t('setting_source_check_failed'), 'long')
    }).finally(() => {
      taskRef.current = null
    })
  }, [running, sources, keyword, qualitys, t, finishCheck])

  const handleCancel = useCallback(() => {
    cancelledRef.current = true
    taskRef.current?.cancel()
    taskRef.current = null
    setRunning(false)
    setProgress(null)
    toast(t('setting_source_check_cancelled'))
  }, [t])

  const handleCopy = useCallback(() => {
    if (!results.length) return
    clipboardWriteText(formatSourceCheckResult(results, pageState.lastCheckKeyword || keyword))
    toast(t('setting_source_check_copied'))
  }, [results, keyword, pageState.lastCheckKeyword, t])

  const handleWriteLog = useCallback(() => {
    if (!results.length) return
    log.info(`[sourceCheck]\n${formatSourceCheckResult(results, pageState.lastCheckKeyword || keyword)}`)
    toast(t('setting_source_check_logged'))
  }, [results, keyword, pageState.lastCheckKeyword, t])

  const phaseLabel = progress ? t(PHASE_LABEL[progress.phase]) : ''
  const progressText = progress
    ? `${t('setting_source_check_running', { done: progress.finished, total: progress.total })} · ${phaseLabel}`
    : ''

  return (
    <Group title={t('setting_source_check')} icon='speedometer' color='#10B981'>
      <View style={styles.content}>
        <Text size={10.5} color={theme['c-450']} style={styles.tip}>{t('setting_source_check_tip')}</Text>
        <Text size={11} color={theme['c-450']} style={styles.inputLabel}>{t('setting_source_check_probe_song')}</Text>
        <Input
          value={keyword}
          placeholder={DEFAULT_CHECK_KEYWORD}
          onChangeText={setKeyword}
          editable={!running}
          size={12.5}
          style={{
            ...styles.input,
            backgroundColor: theme['c-primary-alpha-800'],
            borderColor: theme['c-primary-alpha-600'],
            color: theme['c-font'],
          }}
        />
        <View style={styles.btnRow}>
          {
            running
              ? <Button onPress={handleCancel}>{t('setting_source_check_cancel')}</Button>
              : <Button onPress={handleStart} disabled={!sources.length}>{t('setting_source_check_start')}</Button>
          }
          {
            results.length
              ? (
                <>
                  <Button onPress={handleCopy}>{t('setting_source_check_copy')}</Button>
                  <Button onPress={handleWriteLog}>{t('setting_source_check_log')}</Button>
                </>
                )
              : null
          }
        </View>
        {
          running
            ? (
              <Text size={10.5} color={theme['c-primary']} style={styles.progress}>{progressText}</Text>
              )
            : null
        }
        {
          !sources.length
            ? <Text size={10.5} color={theme['c-400']} style={styles.tip}>{t('setting_source_check_empty')}</Text>
            : null
        }
        {
          results.length
            ? (
              <View style={styles.results}>
                {results.map(result => <ResultItem key={result.source} result={result} />)}
              </View>
              )
            : (!running ? <Text size={10.5} color={theme['c-400']} style={styles.tip}>{t('setting_source_check_no_result')}</Text> : null)
        }
      </View>
    </Group>
  )
})

const styles = createStyle({
  content: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  tip: {
    lineHeight: 16,
    marginBottom: 8,
  },
  inputLabel: {
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    borderWidth: 0.5,
    height: 38,
    paddingLeft: 10,
    paddingRight: 10,
  },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  progress: {
    marginTop: 4,
    marginBottom: 2,
    fontWeight: '600',
  },
  results: {
    marginTop: 8,
  },
  resultItem: {
    marginTop: 8,
    paddingTop: 8,
    paddingLeft: 14,
    paddingRight: 14,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(128,128,128,0.18)',
  },
  resultHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  resultNameWrap: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  resultName: {
    fontWeight: '600',
  },
  resultStatus: {
    marginLeft: 6,
    flexShrink: 0,
  },
  bestTag: {
    marginLeft: 6,
  },
  latency: {
    marginLeft: 6,
    flexShrink: 0,
  },
  songLine: {
    marginTop: 3,
  },
  qualityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 3,
  },
  qualityName: {
    width: 66,
    fontWeight: '600',
  },
  qualityMeta: {
    marginLeft: 6,
  },
  qualityError: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 6,
  },
  resultError: {
    marginTop: 3,
  },
})
