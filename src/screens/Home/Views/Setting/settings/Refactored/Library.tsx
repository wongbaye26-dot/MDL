import { useState } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { Group, ToggleRow, ActionRow, UiSectionTitle } from '../../components/ui'
import { toast } from '@/utils/tools'
import { runPowerLossDrill } from '@/core/localLibrary/backup'
import Tools from '../Tools'

export default () => {
  const theme = useTheme()
  const [running, setRunning] = useState(false)
  const [drillText, setDrillText] = useState('')
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
  return (
  <View>
    <Group title='列表显示' icon='format-list-bulleted' color='#F97316'>
      <ToggleRow settingKey='list.isClickPlayList' title='点击歌曲直接播放' />
      <ToggleRow settingKey='list.isShowAlbumName' title='显示专辑名' />
      <ToggleRow settingKey='list.isShowInterval' title='显示歌曲时长' />
    </Group>
    <Group title='迁移自检' icon='database-check-outline' color='#64748B' desc='A-2 开发入口；只动 SQLite 影子表，不改旧 JSON'>
      <ActionRow title='断电恢复演练' desc='模拟 DB 只写一半断电，再从旧 JSON 重建并校验' action={running ? '运行中…' : '运行'} onPress={() => { void runDrill() }} />
      {drillText ? <Text size={10.5} color={theme['c-450']} style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 12, lineHeight: 16 }}>{drillText}</Text> : null}
    </Group>
    <UiSectionTitle title='曲库工具' desc='体检、补封面、刮削标签、去重与重命名' />
    <Tools />
  </View>
  )
}
