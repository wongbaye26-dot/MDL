import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useI18n } from '@/lang'
import { setFontSize } from '@/core/common'
import { useFontSize } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

const LIST = [
  { size: 0.8, name: 'setting_basic_font_size_80' },
  { size: 0.9, name: 'setting_basic_font_size_90' },
  { size: 1, name: 'setting_basic_font_size_100' },
  { size: 1.1, name: 'setting_basic_font_size_110' },
  { size: 1.2, name: 'setting_basic_font_size_120' },
  { size: 1.3, name: 'setting_basic_font_size_130' },
] as const

/**
 * 字体大小设置。
 *
 * 不重启生效：setFontSize 会同步更新 global.lx.fontSize 并广播 fontSizeUpdated，
 * Text 组件订阅该事件后重新计算字号；这里只负责选择面板和预览。
 */
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const size = useFontSize()

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={[styles.iconTile, { backgroundColor: theme['c-primary-alpha-800'] }]}>
          <Icon name='format-size' size={18} color={theme['c-primary']} />
        </View>
        <View style={styles.headText}>
          <Text size={13} color={theme['c-450']}>{t('setting_basic_font_size')}</Text>
          <Text size={10.5} color={theme['c-400']} style={styles.liveTip}>{t('setting_basic_font_size_live_tip')}</Text>
        </View>
        <View style={[styles.valuePill, { backgroundColor: theme['c-primary-alpha-800'] }]}>
          <Text size={12} color={theme['c-primary']} style={styles.value}>{Math.round(size * 100)}%</Text>
        </View>
      </View>

      <View style={[styles.preview, { backgroundColor: theme['c-primary-alpha-800'], borderColor: theme['c-primary-alpha-700'] }]}>
        <Text size={19} style={styles.previewTitle}>{t('setting_basic_font_size_preview')}</Text>
        <Text size={12} color={theme['c-450']} style={styles.previewDesc}>{t('setting_basic_font_size_example')}</Text>
      </View>

      <View style={styles.steps}>
        {
          LIST.map(item => {
            const active = size === item.size
            return (
              <TouchableOpacity
                key={item.size}
                style={[styles.step, { backgroundColor: active ? theme['c-primary'] : theme['c-primary-alpha-800'] }]}
                activeOpacity={0.7}
                accessibilityRole='button'
                accessibilityLabel={t(item.name)}
                accessibilityState={{ selected: active }}
                onPress={() => { setFontSize(item.size) }}
              >
                <Text size={11} color={active ? '#FFFFFF' : theme['c-450']} style={styles.stepText}>
                  {Math.round(item.size * 100)}
                </Text>
              </TouchableOpacity>
            )
          })
        }
      </View>
    </View>
  )
})

const styles = createStyle({
  wrap: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  headText: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  liveTip: {
    marginTop: 2,
  },
  valuePill: {
    minWidth: 48,
    height: 26,
    borderRadius: 13,
    paddingLeft: 9,
    paddingRight: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  value: {
    fontWeight: '700',
  },
  preview: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 0.5,
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  previewTitle: {
    fontWeight: '700',
  },
  previewDesc: {
    marginTop: 4,
  },
  steps: {
    flexDirection: 'row',
    marginTop: 12,
  },
  step: {
    flex: 1,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  stepText: {
    fontWeight: '600',
  },
})
