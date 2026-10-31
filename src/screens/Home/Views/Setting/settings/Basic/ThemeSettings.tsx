import { memo, useCallback, useEffect, useState } from 'react'
import { View, TouchableOpacity, ScrollView } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'
import { updateSetting } from '@/core/common'
import { setShouldUseDarkColors, applyTheme, setSeedColor, disableSeedTheme } from '@/core/theme'
import { getTheme, SEED_COLORS, generateThemeFromSeed } from '@/theme/themes'
import { getSystemAccentColor } from '@/utils/nativeModules/utils'
import themeState from '@/store/theme/state'

type ThemeMode = 'auto' | 'light' | 'dark'

const MODES: Array<{ mode: ThemeMode, label: string, icon: string }> = [
  { mode: 'light', label: '明亮', icon: 'white-balance-sunny' },
  { mode: 'dark', label: '暗黑', icon: 'weather-night' },
  { mode: 'auto', label: '跟随系统', icon: 'theme-light-dark' },
]

const ThemeModeSelector = memo(() => {
  const theme = useTheme()
  const isAutoTheme = useSettingValue('common.isAutoTheme')
  const useSeed = useSettingValue('theme.useSeed')
  const seedColor = useSettingValue('theme.seedColor')
  const darkId = useSettingValue('theme.darkId')
  const lightId = useSettingValue('theme.lightId')
  const mode: ThemeMode = isAutoTheme ? 'auto' : (themeState.theme.isDark ? 'dark' : 'light')

  const handleSelect = useCallback((newMode: ThemeMode) => {
    const isDark = newMode === 'auto' ? themeState.shouldUseDarkColors : newMode === 'dark'
    const auto = newMode === 'auto'
    updateSetting({ 'common.isAutoTheme': auto, 'theme.seedDark': isDark })
    setShouldUseDarkColors(isDark)
    if (useSeed) {
      // 种子模式：按新的明暗直接重建配色
      applyTheme(generateThemeFromSeed(seedColor, isDark))
    } else {
      // 内置主题：切到对应明暗的主题 id
      updateSetting({ 'theme.id': isDark ? (darkId || 'emo') : (lightId || 'emo_light') })
      void getTheme().then(t => { applyTheme(t) })
    }
  }, [useSeed, seedColor, darkId, lightId])

  return (
    <View style={styles.modeRow}>
      {MODES.map(m => {
        const active = mode === m.mode
        return (
          <TouchableOpacity
            key={m.mode}
            style={{
              ...styles.modeBtn,
              backgroundColor: active ? theme['c-primary'] : theme['c-primary-alpha-900'],
              borderColor: active ? theme['c-primary'] : theme['c-primary-alpha-700'],
            }}
            activeOpacity={0.7}
            onPress={() => { handleSelect(m.mode) }}
          >
            <Icon name={m.icon} size={15} color={active ? '#FFFFFF' : theme['c-450']} />
            <Text
              size={12}
              color={active ? '#FFFFFF' : theme['c-font']}
              style={styles.modeLabel}
            >{m.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
})

const ColorSwatch = memo(({ color, name, active, onPress }: {
  color: string
  name: string
  active: boolean
  onPress: () => void
}) => {
  const theme = useTheme()
  return (
    <TouchableOpacity style={styles.swatchWrap} activeOpacity={0.7} onPress={onPress}>
      <View style={{
        ...styles.swatch,
        backgroundColor: color,
        borderWidth: active ? 3 : 0,
        borderColor: active ? theme['c-font'] : 'transparent',
      }}>
        {active ? <Icon name='check' size={18} color='#FFFFFF' /> : null}
      </View>
      <Text size={10} color={active ? theme['c-font'] : theme['c-450']} style={styles.swatchLabel}>{name}</Text>
    </TouchableOpacity>
  )
})

const MaterialYouColors = memo(() => {
  const theme = useTheme()
  const useSeed = useSettingValue('theme.useSeed')
  const seedColor = useSettingValue('theme.seedColor')
  const isAutoTheme = useSettingValue('common.isAutoTheme')
  const isDark = isAutoTheme ? themeState.shouldUseDarkColors : themeState.theme.isDark
  const [systemColor, setSystemColor] = useState<string | null>(null)

  useEffect(() => {
    void getSystemAccentColor().then(c => { setSystemColor(c) })
  }, [])

  const handleSelect = useCallback((hex: string) => {
    void setSeedColor(hex, isDark)
  }, [isDark])

  const handleReset = useCallback(() => {
    disableSeedTheme(isDark ? 'emo' : 'emo_light')
  }, [isDark])

  return (
    <View>
      <View style={styles.colorHead}>
        <Text size={11} color={theme['c-450']}>主题色</Text>
        {useSeed
          ? (
            <TouchableOpacity onPress={handleReset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text size={11} color={theme['c-primary-font']}>恢复默认</Text>
            </TouchableOpacity>
            )
          : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatchRow}>
        {/* 跟随系统主题色 */}
        <TouchableOpacity style={styles.swatchWrap} activeOpacity={0.7} onPress={() => { handleSelect('system') }}>
          <View style={{
            ...styles.swatch,
            backgroundColor: systemColor ?? '#888888',
            borderWidth: seedColor === 'system' ? 3 : 0,
            borderColor: seedColor === 'system' ? theme['c-font'] : 'transparent',
          }}>
            <Icon name='cellphone-link' size={18} color='#FFFFFF' />
          </View>
          <Text size={10} color={seedColor === 'system' ? theme['c-font'] : theme['c-450']} style={styles.swatchLabel}>系统</Text>
        </TouchableOpacity>
        {SEED_COLORS.map(c => (
          <ColorSwatch
            key={c.hex}
            color={c.hex}
            name={c.name}
            active={useSeed && seedColor.toLowerCase() === c.hex.toLowerCase()}
            onPress={() => { handleSelect(c.hex) }}
          />
        ))}
      </ScrollView>
      <Text size={10} color={theme['c-400']} style={styles.hint}>
        选「系统」会读取手机 Material You 主题色（Android 12+），其余为固定种子色；选中后自动派生整套配色
      </Text>
    </View>
  )
})

export { ThemeModeSelector, MaterialYouColors }

export default memo(() => {
  return (
    <>
      <ThemeModeSelector />
      <MaterialYouColors />
    </>
  )
})

const styles = createStyle({
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  modeLabel: {
    marginLeft: 6,
    fontWeight: '500',
  },
  colorHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 6,
    paddingBottom: 8,
  },
  swatchRow: {
    paddingLeft: 14,
    paddingRight: 8,
    paddingBottom: 6,
  },
  swatchWrap: {
    alignItems: 'center',
    marginRight: 14,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  swatchLabel: {
    marginTop: 5,
  },
  hint: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingBottom: 12,
    lineHeight: 15,
  },
})
