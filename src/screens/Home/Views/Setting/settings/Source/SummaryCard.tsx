import { memo } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useStatus } from '@/store/userApi'
import { createStyle } from '@/utils/tools'
import { useQualityList, useSourcePageState } from './state'
import { getTopQuality, formatTime, qualityLabel } from './helpers'

/**
 * 音源管理页顶部汇总卡：可用音源数 / 最高音质 / 上次检测时间 / 当前源状态。
 * 2×2 的统计格，数据分别来自当前脚本的音质矩阵、页面内的实测结果和初始化状态。
 */
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const qualityList = useQualityList()
  const apiStatus = useStatus()
  const pageState = useSourcePageState()

  const sources = Object.keys(qualityList)
  const allQualitys: LX.Quality[] = []
  for (const source of sources) allQualitys.push(...(qualityList[source as LX.Source] ?? []))
  const topQuality = getTopQuality(allQualitys)

  const statusText = apiStatus.status
    ? t('setting_basic_source_status_success')
    : apiStatus.message === 'initing'
      ? t('setting_basic_source_status_initing')
      : t('setting_basic_source_status_failed')
  const statusColor = apiStatus.status
    ? '#10B981'
    : apiStatus.message === 'initing' ? '#F59E0B' : '#EF4444'

  const cells: Array<{ label: string, value: string, color?: string }> = [
    { label: t('setting_source_summary_sources'), value: sources.length ? String(sources.length) : '-' },
    { label: t('setting_source_summary_top_quality'), value: topQuality ? qualityLabel(topQuality) : '-' },
    { label: t('setting_source_summary_last_check'), value: pageState.lastCheckAt ? formatTime(pageState.lastCheckAt) : t('setting_source_summary_never') },
    { label: t('setting_source_summary_status'), value: statusText, color: statusColor },
  ]

  return (
    <View style={{
      ...styles.card,
      backgroundColor: theme['c-primary-alpha-900'],
      borderColor: theme['c-primary-alpha-700'],
    }}>
      <View style={styles.grid}>
        {
          cells.map(cell => (
            <View key={cell.label} style={styles.cell}>
              <Text size={10} color={theme['c-450']} numberOfLines={1}>{cell.label}</Text>
              <Text size={15} numberOfLines={1} style={styles.value} color={cell.color ?? theme['c-font']}>{cell.value}</Text>
            </View>
          ))
        }
      </View>
      <Text size={10.5} color={theme['c-400']} style={styles.tip}>
        {t('setting_source_summary_tip')}
      </Text>
    </View>
  )
})

const styles = createStyle({
  card: {
    borderRadius: 20,
    borderWidth: 0.5,
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 14,
    paddingBottom: 10,
    marginTop: 6,
    marginBottom: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '50%',
    paddingTop: 4,
    paddingBottom: 6,
    paddingRight: 6,
  },
  value: {
    marginTop: 3,
    fontWeight: '700',
  },
  tip: {
    marginTop: 4,
    lineHeight: 15,
  },
})
