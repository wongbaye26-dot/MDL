import { memo, useCallback, useState } from 'react'
import { View, TouchableOpacity, ScrollView } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'
import { updateSetting } from '@/core/common'
import { setTheme, setShouldUseDarkColors, applyTheme } from '@/core/theme'
import { getTheme } from '@/theme/themes'
import themeState from '@/store/theme/state'

/** Material You 风格预设主题色 */
const PRESET_COLORS = [
  { id: 'emo', name: '深紫', color: '#6C5CE7', darkId: 'emo', lightId: 'emo_light' },
  { id: 'green', name: '翠绿', color: '#4DAF7C', darkId: 'emo', lightId: 'emo_light' },
  { id: 'blue', name: '湛蓝', color: '#3B82F6', darkId: 'black', lightId: 'blue' },
  { id: 'purple', name: '魅紫', color: '#A855F7', darkId: 'purple', lightId: 'purple' },
  { id: 'pink', name: '樱粉', color: '#EC4899', darkId: 'pink', lightId: 'pink' },
  { id: 'orange', name: '暖橙', color: '#F59E0B', darkId: 'orange', lightId: 'orange' },
  { id: 'red', name: '赤红', color: '#EF4444', darkId: 'red', lightId: 'red' },
  { id: 'grey', name: '极简灰', color: '#6B7280', darkId: 'grey', lightId: 'grey' },
] as const

type ThemeMode = 'auto' | 'light' | 'dark'

const ThemeModeSelector = memo(() => {
  const theme = useTheme()
  const isAutoTheme = useSettingValue('common.isAutoTheme')
  const currentThemeId = useSettingValue('theme.id')

  const mode: ThemeMode = isAutoTheme ? 'auto' : (themeState.theme.isDark ? 'dark' : 'light')

  const handleSelect = useCallback(async(newMode: ThemeMode) => {
    if (newMode === 'auto') {
      updateSetting({ 'common.isAutoTheme': true })
    } else {
      updateSetting({ 'common.isAutoTheme': false })
      const targetId = newMode === 'dark' ? currentThemeId : (currentThemeId === 'emo' ? 'emo_light' : currentThemeId)
      // 如果当前已是暗色主题但选了明亮，切到对应的亮色
      if (newMode === 'light' && themeState.theme.isDark) {
        const lightId = PRESET_COLORS.find(c => c.darkId === currentThemeId)?.lightId ?? 'emo_light'
        setTheme(lightId)
        setShouldUseDarkColors(false)
      } else if (newMode === 'dark' && !themeState.theme.isDark) {
        const darkId = PRESET_COLORS.find(c => c.lightId === currentThemeId)?.darkId ?? 'emo'
        setTheme(darkId)
        setShouldUseDarkColors(true)
      }
    }
    // 重新应用主题
    void getTheme().then(t => {
      if (t.id !== themeState.theme.id) applyTheme(t)
    })
  }, [currentThemeId])

  const modes: Array<{ mode: ThemeMode, label: string, icon: string }> = [
    { mode: 'light', label: '明亮', icon: 'white-balance-sunny' },
    { mode: 'dark', label: '暗黑', icon: 'weather-night' },
    { mode: 'auto', label: '跟随系统', icon: 'theme-light-dark' },
  ]

  return (
    <View style={styles.modeRow}>
      {modes.map(m => (
        <TouchableOpacity
          key={m.mode}
          style={{
            ...styles.modeBtn,
            backgroundColor: mode === m.mode ? theme['c-primary'] : theme['c-primary-alpha-900'],
            borderColor: mode === m.mode ? theme['c-primary'] : theme['c-primary-alpha-700'],
          }}
          activeOpacity={0.7}
          onPress={() => { void handleSelect(m.mode) }}
        >
          <Icon name={m.icon} size={15} color={mode === m.mode ? '#FFFFFF' : theme['c-450']} />
          <Text
            size={12}
            color={mode === m.mode ? '#FFFFFF' : theme['c-font']}
            style={styles.modeLabel}
          >{m.label}</Text>
        </TouchableOpacity>
      ))}
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
        borderColor: theme['c-primary'],
      }}>
        {active ? <Icon name='check' size={18} color='#FFFFFF' /> : null}
      </View>
      <Text size={10} color={theme['c-450']} style={styles.swatchLabel}>{name}</Text>
    </TouchableOpacity>
  )
})

const MaterialYouColors = memo(() => {
  const theme = useTheme()
  const currentThemeId = useSettingValue('theme.id')
  const isAutoTheme = useSettingValue('common.isAutoTheme')
  const darkId = useSettingValue('theme.darkId')
  const lightId = useSettingValue('theme.lightId')

  const activeId = isAutoTheme ? (themeState.theme.isDark ? darkId : lightId) : currentThemeId

  const handleSelectColor = useCallback((colorId: string, darkThemeId: string, lightThemeId: string) => {
    const targetId = themeState.theme.isDark ? darkThemeId : lightThemeId
    updateSetting({
      'theme.id': targetId,
      'theme.darkId': darkThemeId,
      'theme.lightId': lightThemeId,
    })
    void getTheme().then(t => {
      if (t.id !== themeState.theme.id) applyTheme(t)
    })
  }, [])

  return (
    <View>
      <Text size={11} color={theme['c-450']} style={styles.colorTitle}>Material You 主题色</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatchRow}>
        {PRESET_COLORS.map(c => (
          <ColorSwatch
            key={c.id}
            color={c.color}
            name={c.name}
            active={activeId === c.darkId || activeId === c.lightId || activeId === c.id}
            onPress={() => { handleSelectColor(c.id, c.darkId, c.lightId) }}
          />
        ))}
      </ScrollView>
    </View>
  )
})

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
    paddingLeft: 14,
    paddingRight: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  modeLabel: {
    marginLeft: 6,
    fontWeight: '500',
  },
  colorTitle: {
    paddingLeft: 14,
    paddingTop: 8,
    paddingBottom: 6,
  },
  swatchRow: {
    paddingLeft: 14,
    paddingRight: 8,
    paddingBottom: 14,
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
})
