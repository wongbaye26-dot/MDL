import { memo } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useStatus, useUserApiList } from '@/store/userApi'
import { createStyle } from '@/utils/tools'
import { Group } from '../../components/ui'
import { getSuccess, getWarning } from '@/theme/designTokens'
import musicSdk from '@/utils/musicSdk'
import { useQualityList, useSourcePageState } from './state'
import { getTopQuality, formatTime, qualityLabel } from './helpers'

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const qualityList = useQualityList()
  const apiStatus = useStatus()
  const userApiList = useUserApiList()
  const pageState = useSourcePageState()
  /*
   * 「可用音源」统计的是**已安装的源**：内置源 + 已导入的自定义脚本。
   *
   * 之前这里用 `Object.keys(qualityList).length`，那是当前脚本上报的「渠道数」
   * （kw/kg/tx/wy/mg），导入或删除脚本只会触发 list_changed，不会触发
   * apiSourceUpdated，所以数字一直不变，看起来像不是实时数据。
   */
  const builtinSourceCount = Object.keys(musicSdk.supportQuality ?? {}).length
  const installedSourceCount = builtinSourceCount + userApiList.length
  const sources = Object.keys(qualityList)
  const allQualitys: LX.Quality[] = []
  for (const source of sources) allQualitys.push(...(qualityList[source as LX.Source] ?? []))
  const topQuality = getTopQuality(allQualitys)
  const statusText = apiStatus.status
    ? t('setting_basic_source_status_success')
    : apiStatus.message === 'initing' ? t('setting_basic_source_status_initing') : t('setting_basic_source_status_failed')
  const cells = [
    { label: t('setting_source_summary_sources'), value: installedSourceCount ? String(installedSourceCount) : '-' },
    { label: t('setting_source_summary_top_quality'), value: topQuality ? qualityLabel(topQuality) : '-' },
    { label: t('setting_source_summary_last_check'), value: pageState.lastCheckAt ? formatTime(pageState.lastCheckAt) : t('setting_source_summary_never') },
    { label: t('setting_source_summary_status'), value: statusText, color: apiStatus.status ? getSuccess(theme) : getWarning(theme) },
  ]
  return (
    <Group title='音源概览' icon='chart-box-outline' desc={t('setting_source_summary_tip')}>
      <View style={styles.grid}>
        {cells.map(cell => (
          <View key={cell.label} style={styles.cell}>
            <Text size={12} color={theme['c-450']} numberOfLines={1}>{cell.label}</Text>
            <Text size={17} numberOfLines={1} style={styles.value} color={cell.color ?? theme['c-font']}>{cell.value}</Text>
          </View>
        ))}
      </View>
    </Group>
  )
})

const styles = createStyle({
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingLeft: 10, paddingRight: 10, paddingBottom: 10 },
  cell: { width: '50%', padding: 6 },
  value: { marginTop: 3, fontWeight: '700' },
})
