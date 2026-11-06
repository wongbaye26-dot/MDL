import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { localLibraryRepository, type BenchmarkResult } from '@/core/localLibrary/repository'
import { runMigrationDryRun, type MigrationPreview } from '@/core/localLibrary/migrate'
import { getShadowStatus, syncShadowNow, type ShadowStatus } from '@/core/localLibrary/shadow'
import { getLocalMusicList } from '@/core/localMusic'
import { createLibraryBackup, getBackupInfo, runRollbackDrill, type BackupInfo, type RollbackDrillResult } from '@/core/localLibrary/backup'
import { backfillIdentities, type BackfillResult } from '@/core/localLibrary/backfill'
import { buildIdMapPreview, type IdMapPreview } from '@/core/localLibrary/identitySwitch'
import { ButtonRow, Card, InfoLine, SecondaryButton } from './parts'

const WARN_COLOR = '#E8A33D'

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
  const [shadow, setShadow] = useState<ShadowStatus>(() => getShadowStatus())
  const [backup, setBackup] = useState<BackupInfo | null>(null)
  const [drill, setDrill] = useState<RollbackDrillResult | null>(null)
  const [backfill, setBackfill] = useState<BackfillResult | null>(null)
  const [idMap, setIdMap] = useState<IdMapPreview | null>(null)

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

  const runShadow = useCallback(() => {
    if (running) return
    setRunning(true)
    setError('')
    void getLocalMusicList()
      .then(async list => {
        setShadow(await syncShadowNow(list))
        // A-2 自检序列：影子 → 回滚演练 → 指纹回填（仅开发入口）
        setDrill(await runRollbackDrill())
        setBackfill(await backfillIdentities(list))
        setIdMap(await buildIdMapPreview())
      })
      .catch((err: unknown) => { setError(err instanceof Error ? err.message : String(err)) })
      .finally(() => { setRunning(false) })
  }, [running])

  useEffect(() => { void getBackupInfo().then(setBackup) }, [])

  const autoRanRef = useRef(false)
  useEffect(() => {
    // A-2 自检：进入音乐工具时自动跑一次影子同步（仅开发入口，切读前移除）
    if (autoRanRef.current) return
    autoRanRef.current = true
    runShadow()
  }, [runShadow])

  const runBackup = useCallback(() => {
    if (running) return
    setRunning(true)
    setError('')
    void createLibraryBackup()
      .then(setBackup)
      .catch((err: unknown) => { setError(err instanceof Error ? err.message : String(err)) })
      .finally(() => { setRunning(false) })
  }, [running])

  const runDrill = useCallback(() => {
    if (running) return
    setRunning(true)
    setError('')
    setDrill(null)
    void runRollbackDrill()
      .then(setDrill)
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
          shadow.lastAt
            ? (
              <Text size={11} color={theme['c-450']} style={styles.lines}>
                {`\n影子表：写入 ${shadow.written} 首 / DB ${shadow.dbCount} 首 / 缺失 ${shadow.missing} / 多余 ${shadow.extra} / ${shadow.durationMs} ms${shadow.error ? ` / 失败：${shadow.error}` : ''}`}
              </Text>
              )
            : null
        }
        {
          backup?.exists
            ? (
              <Text size={11} color={theme['c-450']} style={styles.lines}>
                {`\n备份：${backup.tracks} 首 / ${backup.keys} keys / ${(backup.bytes / 1024).toFixed(0)} KB\n创建于 ${new Date(backup.createdAt).toLocaleString()} · checksum ${backup.checksum}`}
              </Text>
              )
            : null
        }
        {
          drill
            ? (
              <Text size={11} color={drill.ok ? theme['c-450'] : WARN_COLOR} style={styles.lines}>
                {`\n回滚演练：DB ${drill.beforeDb} → 清空 → ${drill.afterDb}\n旧 JSON ${drill.listCount} 首 · 缺失 ${drill.missing} / 多余 ${drill.extra} · ${drill.durationMs} ms${drill.error ? `\n失败：${drill.error}` : ''}`}
              </Text>
              )
            : null
        }
        {
          backfill
            ? (
              <Text size={11} color={theme['c-450']} style={styles.lines}>
                {`\n指纹回填：${backfill.fingerprint} 首 / 媒体回退 ${backfill.media} / 旧 id ${backfill.legacy} / 失败 ${backfill.failed} / ${backfill.durationMs} ms`}
              </Text>
              )
            : null
        }
        {
          idMap
            ? (
              <Text size={11} color={theme['c-450']} style={styles.lines}>
                {`\n身份映射：${idMap.mapped}/${idMap.tracks} 条 / 未回填 ${idMap.missing} / 碰撞 ${idMap.collisions} / DB id_map ${idMap.dbMapped} / ${idMap.durationMs} ms`}
              </Text>
              )
            : null
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
        <SecondaryButton label='影子同步' icon='database-sync-outline' disabled={running} onPress={runShadow} />
        <SecondaryButton label='清空测试库' icon='database-remove-outline' danger disabled={running} onPress={clearDb} />
      </ButtonRow>
      <ButtonRow>
        <SecondaryButton label='创建备份' icon='content-save-outline' disabled={running} onPress={runBackup} />
        <SecondaryButton label='回滚演练' icon='backup-restore' disabled={running} onPress={runDrill} />
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
