import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { Group, ToggleRow, ActionRow, UiSectionTitle } from '../../components/ui'
import { toast, confirmDialog } from '@/utils/tools'
import { runPowerLossDrill } from '@/core/localLibrary/backup'
import { selfTestRecycle } from '@/core/localMusic/recycle'
import { previewIdMigration, applyIdMigration, rollbackIdMigration } from '@/core/localLibrary/idMigration'
import { getLocalMusicList } from '@/core/localMusic'
import { parseCue } from '@/core/localLibrary/cue'
import { buildCueVirtualTracks } from '@/core/localLibrary/cueTracks'
import { createList } from '@/core/list'
import { playList } from '@/core/player/player'
import Tools from '../Tools'

export default () => {
  const theme = useTheme()
  const [running, setRunning] = useState(false)
  const [drillText, setDrillText] = useState('')
  const [cueText, setCueText] = useState('')
  const [recycleText, setRecycleText] = useState('')
  const [idText, setIdText] = useState('')
  useEffect(() => {
    let alive = true
    void previewIdMigration().then(result => {
      if (!alive) return
      setIdText(`预演：曲库 ${result.tracks} 首（fp ${result.localFp}/legacy ${result.localLegacy}）；DB fp ${result.dbFp}/legacy ${result.dbLegacy}；列表引用 fp ${result.listFp}/legacy ${result.listLegacy}，可映射 ${result.mappedTotal}，冲突 ${result.conflictsTotal}；${result.durationMs}ms`)
    }).catch(() => {})
    return () => { alive = false }
  }, [])
  const runDrill = async() => {
    if (running) return
    setRunning(true)
    try {
      const result = await runPowerLossDrill()
      const text = result.ok
        ? `通过：DB ${result.beforeDb} → 中断 ${result.interruptedDb} → 恢复 ${result.recoveredDb}；旧 JSON ${result.listCount} 首，缺失 ${result.missing}/多余 ${result.extra}，${result.durationMs}ms`
        : `失败：${result.error ?? `缺失 ${result.missing}/多余 ${result.extra}`}`
      setDrillText(text)
      toast(`断电恢复${text}`)
    } catch (error) {
      toast(`断电恢复失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setRunning(false)
    }
  }
  const runCueSelfTest = async() => {
    if (running) return
    setRunning(true)
    try {
      const list = await getLocalMusicList()
      const audio = list.find(item => item.meta.filePath && (item.interval != null))
      if (!audio) { toast('曲库为空，无法生成 CUE 自测'); return }
      const audioPath = audio.meta.filePath
      const fileName = audioPath.split('/').pop() ?? ''
      const sheet = parseCue(`PERFORMER "${audio.singer || ''}"
TITLE "CUE 自测"
FILE "${fileName}" WAVE
  TRACK 01 AUDIO
    TITLE "分段 A"
    INDEX 01 00:08:00
  TRACK 02 AUDIO
    TITLE "分段 B"
    INDEX 01 00:16:00
`)
      const virtual = buildCueVirtualTracks(sheet, audioPath)
      const tracks = virtual.map(track => ({
        id: track.id,
        name: track.title,
        singer: track.performer,
        source: 'local' as const,
        interval: track.interval || null,
        meta: {
          filePath: audioPath,
          ext: audioPath.split('.').pop() ?? '',
          size: 0,
          mtime: 0,
          albumName: 'CUE 自测',
          songId: audioPath,
          cuePath: audioPath,
          cueTrack: track.trackNumber,
          cueStartMs: track.startMs,
          cueEndMs: track.endMs,
        },
      })) as LX.Music.MusicInfoLocal[]
      const listId = `cue_selftest_${Date.now()}`
      await createList({ id: listId, name: 'CUE 自测', list: tracks })
      setCueText('已生成 2 段：00:08 起播 / 00:16 段末切段；播放器应显示「分段 A」并从 8s 开始')
      toast('CUE 自测歌单已生成，开始播放分段 A')
      void playList(listId, 0)
    } catch (error) {
      toast(`CUE 自测失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setRunning(false)
    }
  }
  const runRecycleTest = async() => {
    if (running) return
    setRunning(true)
    try {
      const result = await selfTestRecycle()
      setRecycleText(result.ok ? `通过：${result.steps.join(' → ')}` : `失败：${result.steps.join(' → ')}`)
      toast(result.ok ? '回收站自检通过（含清空）' : '回收站自检失败')
    } finally {
      setRunning(false)
    }
  }
  const runIdPreview = async() => {
    if (running) return
    setRunning(true)
    try {
      const result = await previewIdMigration()
      setIdText(`预演：曲库 ${result.tracks} 首，映射 ${result.localMapped} 首；列表引用可映射 ${result.mappedTotal} 条，冲突 ${result.conflictsTotal}；${result.durationMs}ms`)
    } catch (error) { setIdText(`预演失败：${error instanceof Error ? error.message : String(error)}`) } finally { setRunning(false) }
  }
  const runIdApply = async() => {
    if (running) return
    const confirmed = await confirmDialog({ message: '将把曲库主键切到 fp id，并改写收藏/歌单/播放信息引用。已自动备份，可回滚。继续？', confirmButtonText: '开始迁移', danger: true })
    if (!confirmed) return
    setRunning(true)
    try {
      const result = await applyIdMigration()
      setIdText(result.ok
        ? `应用完成：备份 ${result.backupTracks} 首；id_map ${result.mapSize}；DB ${result.dbBefore}→${result.dbAfter}，更新 ${result.tracksUpdated} 行；曲库 ${result.localUpdated} 首；列表映射 ${result.lists.reduce((n, l) => n + l.mapped, 0)} 条，冲突 ${result.conflicts}；${result.durationMs}ms`
        : `应用失败：${result.error ?? '未知错误'}`)
    } catch (error) { setIdText(`应用失败：${error instanceof Error ? error.message : String(error)}`) } finally { setRunning(false) }
  }
  const runIdRollback = async() => {
    if (running) return
    setRunning(true)
    try {
      const result = await rollbackIdMigration()
      setIdText(result.ok
        ? `回滚完成：DB ${result.tracksUpdated} 行，曲库 ${result.localUpdated} 首；${result.durationMs}ms`
        : `回滚失败：${result.error ?? '未知错误'}`)
    } catch (error) { setIdText(`回滚失败：${error instanceof Error ? error.message : String(error)}`) } finally { setRunning(false) }
  }
  // 迁移/自检入口仅开发期使用，普通用户默认隐藏
  const SHOW_MIGRATION_TOOLS = false
  return (
  <View>
    <Group title='列表显示' icon='format-list-bulleted' color='#F97316'>
      <ToggleRow settingKey='list.isClickPlayList' title='点击歌曲直接播放' />
      <ToggleRow settingKey='list.isShowAlbumName' title='显示专辑名' />
      <ToggleRow settingKey='list.isShowInterval' title='显示歌曲时长' />
    </Group>
    {SHOW_MIGRATION_TOOLS ? <Group title='迁移自检' icon='database-check-outline' color='#64748B' desc='A-2 开发入口；只动 SQLite 影子表，不改旧 JSON'>
      <ActionRow title='tracks.id 迁移预演' desc='统计 fp 映射与收藏/歌单引用影响，不写数据' action={running ? '运行中…' : '预演'} onPress={() => { void runIdPreview() }} />
      <ActionRow title='应用 tracks.id 迁移' desc='备份 → DB 主键切换 → 曲库/收藏/歌单/@play_info 引用改写' action={running ? '运行中…' : '应用'} onPress={() => { void runIdApply() }} />
      <ActionRow title='回滚 tracks.id 迁移' desc='按 id_map 反向切回 legacy id' action={running ? '运行中…' : '回滚'} onPress={() => { void runIdRollback() }} />
      {idText ? <Text size={10.5} color={theme['c-450']} style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 12, lineHeight: 16 }}>{idText}</Text> : null}
      <ActionRow title='回收站自检（含清空）' desc='临时文件走移入→恢复→再移入→清空，不碰真实歌曲' action={running ? '运行中…' : '运行'} onPress={() => { void runRecycleTest() }} />
      {recycleText ? <Text size={10.5} color={theme['c-450']} style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 12, lineHeight: 16 }}>{recycleText}</Text> : null}
      <ActionRow title='CUE 分段自测' desc='用曲库第一首生成 00:08/00:16 两段并起播' action={running ? '运行中…' : '生成并播放'} onPress={() => { void runCueSelfTest() }} />
      {cueText ? <Text size={10.5} color={theme['c-450']} style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 12, lineHeight: 16 }}>{cueText}</Text> : null}
      <ActionRow title='断电恢复演练' desc='模拟 DB 只写一半断电，再从旧 JSON 重建并校验' action={running ? '运行中…' : '运行'} onPress={() => { void runDrill() }} />
      {drillText ? <Text size={10.5} color={theme['c-450']} style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 12, lineHeight: 16 }}>{drillText}</Text> : null}
    </Group> : null}
    <UiSectionTitle title='曲库工具' desc='体检、补封面、刮削标签、去重与重命名' />
    <Tools />
  </View>
  )
}
