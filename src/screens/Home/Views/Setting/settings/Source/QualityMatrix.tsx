import { memo } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { Group } from '../../components/ui'
import { useQualityList } from './state'
import { getTopQuality, getSourceDisplayName, qualityLabel, sortQualitys } from './helpers'

/** 当前脚本上报的音质矩阵：每个音源支持哪些音质、最高音质是什么 */
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const qualityList = useQualityList()
  const entries = Object.entries(qualityList)
    .filter((entry): entry is [LX.Source, LX.Quality[]] => Array.isArray(entry[1]) && entry[1].length > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <Group title={t('setting_source_quality')} icon='chart-bar' color='#3B82F6' desc={t('setting_source_quality_tip')}>
      <View style={styles.content}>
        {entries.length
          ? entries.map(([source, qualities]) => {
            const sorted = sortQualitys(qualities)
            const topQuality = getTopQuality(sorted)
            return (
              <View key={source} style={styles.row}>
                <View style={styles.head}>
                  <Text size={12.5} numberOfLines={1} style={styles.sourceName}>{getSourceDisplayName(source)}</Text>
                  {topQuality ? (
                    <View style={[styles.topTag, { backgroundColor: theme['c-primary-alpha-900'] }]}>
                      <Text size={9.5} color={theme['c-primary']}>{qualityLabel(topQuality)}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.chips}>
                  {sorted.map(quality => {
                    const top = quality === topQuality
                    return (
                      <View key={quality} style={[styles.chip, { backgroundColor: top ? theme['c-primary'] : theme['c-primary-alpha-900'] }]}>
                        <Text size={10.5} color={top ? '#FFFFFF' : theme['c-450']}>{qualityLabel(quality)}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            )
          })
          : <Text size={11.5} color={theme['c-450']} style={styles.empty}>{t('setting_source_quality_empty')}</Text>}
      </View>
    </Group>
  )
})

const styles = createStyle({
  content: { paddingLeft: 14, paddingRight: 14, paddingTop: 10, paddingBottom: 12 },
  row: { marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center' },
  sourceName: { fontWeight: '600' },
  topTag: { marginLeft: 8, height: 20, paddingLeft: 8, paddingRight: 8, borderRadius: 10, justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { height: 26, paddingLeft: 10, paddingRight: 10, borderRadius: 13, justifyContent: 'center' },
  empty: { padding: 4 },
})
