import { memo } from 'react'
import { View } from 'react-native'

import Section from '../../components/Section'
import Text from '@/components/common/Text'
import Tag from '@/components/common/Tag'
import Chip from '@/components/common/Chip'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
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
    <Section title={t('setting_source_quality')}>
      <View style={styles.content}>
        {
          entries.length
            ? entries.map(([source, qualities]) => {
              const sorted = sortQualitys(qualities)
              const topQuality = getTopQuality(sorted)
              return (
                <View key={source} style={styles.row}>
                  <View style={styles.head}>
                    <Text size={13} numberOfLines={1} style={styles.sourceName}>{getSourceDisplayName(source)}</Text>
                    {topQuality ? <Tag label={qualityLabel(topQuality)} size='sm' tone='primary' style={styles.topTag} /> : null}
                  </View>
                  <View style={styles.chips}>
                    {
                      sorted.map(quality => (
                        <View key={quality} style={styles.chip}>
                          <Chip size='sm' soft={quality !== topQuality} active={quality === topQuality} label={qualityLabel(quality)} />
                        </View>
                      ))
                    }
                  </View>
                </View>
              )
            })
            : (
              <Text size={11.5} color={theme['c-450']} style={styles.empty}>
                {t('setting_source_quality_empty')}
              </Text>
              )
        }
        <Text size={10.5} color={theme['c-400']} style={styles.tip}>{t('setting_source_quality_tip')}</Text>
      </View>
    </Section>
  )
})

const styles = createStyle({
  content: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  row: {
    marginBottom: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceName: {
    fontWeight: '600',
  },
  topTag: {
    marginLeft: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  chip: {
    marginBottom: 6,
  },
  empty: {
    lineHeight: 17,
  },
  tip: {
    lineHeight: 15,
    marginTop: 2,
  },
})
