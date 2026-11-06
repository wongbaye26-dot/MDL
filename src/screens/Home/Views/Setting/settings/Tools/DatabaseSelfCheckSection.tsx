import { memo, useCallback, useState } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { localLibraryRepository, type BenchmarkResult } from '@/core/localLibrary/repository'
import { runMigrationDryRun, type MigrationPreview } from '@/core/localLibrary/migrate'
import { ButtonRow, Card, InfoLine, SecondaryButton } from './parts'

/**
 * A-2 存储自检（临时开发入口）。
 *
 * 运行 10k 首插入/计数/专辑查询/更新/删除基准，验证 SQLite 在真机上的
 * 吞吐与事务行为；A-2 切读前会移除/隐藏该入口。
 */
export default memo(() => {
  const theme = useTheme()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<BenchmarkResult | null>(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<MigrationPreview | null>(null)

  const run = useCallback(() => {
    if (running) return
    setRunning(true)
    setError('')
    setResult(null)
    void localLibraryRepository.runBenchmark(10000)
      .then(setResult)
      .catch((err: unknown) => { setError(err instanceof Error ? err.message : String(err)) })
      .finally(() => { setRunning(false) })
  }, [running])

  const runPreview = useCallback(() => {
    if (running) return
    setRunning(true)
    setError('')
    setPreview(null)
    void runMigrationDryRun()
      .then(setPreview)
      .catch((err: unknown) => { setError(err instanceof Error ? err.message : String(err)) })
      .finally(() => { setRunning(false) })
  }, [running])

  const clearDb = useCallback(() => {
    if (running) return
    setRunning(true)
    setError('')
    void localLibraryRepository.clearAll()
      .then(() => { setPreview(null); setResult(null) })
      .catch((err: unknown) => { setError(err instanceof Error ? err.message : String(err)) })
      .finally(() => { setRunning(false) })
  }, [running])

  return (
    <Card title='数据库自检' desc='A-2 存储 PoC：10k 首 SQLite 插入/查询/事务基准'>
      <InfoLine
        label='引擎'
        desc='react-native-sqlite-2 3.6.3 · 私有目录 · 默认 journal'
        value={running ? '运行中' : result ? '通过' : '待运行'}
        tone={error ? 'warning' : result ? 'primary' : undefined}
      />
      <View style={styles.box}>
        {
          error
            ? <Text size={11} color={theme['c-450']}>运行失败：{error}</Text>
            : result
              ? (
                <Text size={11} color={theme['c-450']} style={styles.lines}>
                  {`插入 10k：${result.insertMs} ms\n计数：${result.countMs} ms\n专辑聚合：${result.queryMs} ms\n批量更新：${result.updateMs} ms\n清空：${result.deleteMs} ms\n合计：${result.totalMs} ms`}
                </Text>
                )
              : <Text size={11} color={theme['c-450']}>点下方按钮运行；不会写入真实曲库（固定 bench_ 前缀）。</Text>
        }
        {
          preview
            ? (
              <Text size={11} color={theme['c-450']} style={styles.lines}>
                {`\n迁移预演：歌曲 ${preview.tracks} → DB ${preview.dbTracks}\n歌单 ${preview.playlists} → DB ${preview.dbPlaylists}\n歌单条目 ${preview.playlistTracks} → DB ${preview.dbPlaylistTracks}\n未迁移在线条目 ${preview.skippedOnline}\n耗时 ${preview.durationMs} ms · checksum ${preview.checksum}`}
              </Text>
              )
            : null
        }
      </View>
      <ButtonRow>
        <SecondaryButton label={running ? '运行中…' : '运行 10k 基准'} icon='database-sync-outline' disabled={running} onPress={run} />
      </ButtonRow>
      <ButtonRow>
        <SecondaryButton label='迁移预演' icon='database-import-outline' disabled={running} onPress={runPreview} />
        <SecondaryButton label='清空测试库' icon='database-remove-outline' danger disabled={running} onPress={clearDb} />
      </ButtonRow>
    </Card>
  )
})

const styles = createStyle({
  box: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 4,
    paddingBottom: 8,
  },
  lines: {
    lineHeight: 18,
  },
})
