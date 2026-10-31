import { memo, useMemo } from 'react'
import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Chip from '@/components/common/Chip'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { TRY_QUALITYS_LIST } from '@/core/music/utils'
import { QUALITY_LABEL, QUALITY_DESC } from '@/core/download/utils'

/**
 * 优先播放的音质。
 *
 * 原来是 CheckBox 方框 + 文字平铺，和设置页其它「胶囊选择」不搭；
 * 改成胶囊行：选中实心、未选半透明，下面补一句降级说明。
 */
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const playQuality = useSettingValue('player.playQuality')

  const playQualityList = useMemo(() => {
    return [...TRY_QUALITYS_LIST, '128k'].reverse() as LX.Quality[]
  }, [])

  const activeLabel = QUALITY_LABEL[playQuality] ?? playQuality
  const activeDesc = QUALITY_DESC[playQuality] ?? ''

  return (
    <SubTitle title={t('setting_play_play_quality')}>
      <View style={styles.list}>
        {
          playQualityList.map(q => (
            <View key={q} style={styles.chipWrap}>
              <Chip
                label={QUALITY_LABEL[q] ?? q}
                active={q === playQuality}
                onPress={() => { updateSetting({ 'player.playQuality': q }) }}
              />
            </View>
          ))
        }
      </View>
      <View style={{ ...styles.tip, backgroundColor: theme['c-primary-alpha-900'] }}>
        <Text size={11} color={theme['c-450']} style={styles.tipText}>
          {`当前优先 ${activeLabel}${activeDesc ? `（${activeDesc}）` : ''}，音源没有该档位时会自动降到可用音质`}
        </Text>
      </View>
    </SubTitle>
  )
})

const styles = createStyle({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  chipWrap: {
    marginBottom: 8,
  },
  tip: {
    marginTop: 2,
    borderRadius: 10,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  tipText: {
    lineHeight: 16,
  },
})
