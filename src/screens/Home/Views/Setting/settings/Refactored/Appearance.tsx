import { useCallback } from 'react'
import { Appearance, TouchableOpacity, View } from 'react-native'
import { Group, ToggleRow, ChoiceRow } from '../../components/ui'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting, setLanguage, setFontSize } from '@/core/common'
import { setShouldUseDarkColors, applyTheme } from '@/core/theme'
import { getTheme, generateThemeFromSeed } from '@/theme/themes'
import { getSystemAccentColor } from '@/utils/nativeModules/utils'
import { langList, useI18n } from '@/lang'
import { useFontSize } from '@/store/common/hook'
import { MaterialYouColors } from '../Basic/ThemeSettings'
import { createStyle } from '@/utils/tools'

const MODES = [
  { value: 'light', label: '明亮' },
  { value: 'dark', label: '暗黑' },
  { value: 'auto', label: '跟随系统' },
] as const

const FONT_STEPS = [0.8, 0.9, 1, 1.1, 1.2, 1.3]

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const isAutoTheme = useSettingValue('common.isAutoTheme')
  const useSeed = useSettingValue('theme.useSeed')
  const seedColor = useSettingValue('theme.seedColor')
  const darkId = useSettingValue('theme.darkId')
  const lightId = useSettingValue('theme.lightId')
  const fontSize = useFontSize()
  const mode = isAutoTheme ? 'auto' : (theme.isDark ? 'dark' : 'light')

  const selectMode = useCallback(async(value: 'light' | 'dark' | 'auto') => {
    const isDark = value === 'auto' ? Appearance.getColorScheme() === 'dark' : value === 'dark'
    updateSetting({ 'common.isAutoTheme': value === 'auto', 'theme.seedDark': isDark })
    setShouldUseDarkColors(isDark)
    if (useSeed) {
      const resolved = seedColor === 'system' ? ((await getSystemAccentColor()) ?? '#6C5CE7') : seedColor
      applyTheme(generateThemeFromSeed(resolved, isDark))
    } else {
      updateSetting({ 'theme.id': isDark ? (darkId || 'emo') : (lightId || 'emo_light') })
      void getTheme().then(theme => { applyTheme(theme) })
    }
  }, [useSeed, seedColor, darkId, lightId])

  return (
    <View>
      <Group title='主题模式' icon='palette-outline' color='#8B5CF6'>
        <View style={styles.modes}>
          {
            MODES.map(item => {
              const active = mode === item.value
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.mode, { backgroundColor: active ? theme['c-primary'] : theme['c-primary-alpha-900'] }]}
                  activeOpacity={0.75}
                  onPress={() => { void selectMode(item.value) }}
                >
                  <Text size={12} color={active ? theme['c-font'] : theme['c-450']}>{item.label}</Text>
                </TouchableOpacity>
              )
            })
          }
        </View>
      </Group>
      <Group title='主题色' icon='palette-swatch-outline' color='#EC4899' desc='Material You / 预设色板'>
        <MaterialYouColors />
      </Group>
      <Group title='界面' icon='cellphone' color='#3B82F6'>
        <ToggleRow settingKey='common.homePageScroll' title='首页上下滑动' />
        <ToggleRow settingKey='common.reduceMotion' title='减少动态效果' desc='关闭大部分过渡与循环动画' />
        <ToggleRow settingKey='common.homeCardMotion' title='首页卡片动效' />
        <ToggleRow settingKey='common.coverRotation' title='专辑封面自转' />
        <ChoiceRow settingKey='common.langId' title='语言' options={langList.map(item => ({ value: item.locale, label: item.name }))} onChange={value => { setLanguage(value as Parameters<typeof setLanguage>[0]) }} />
        <ChoiceRow settingKey='common.sourceNameType' title='音源名称' options={[
          { value: 'real', label: t('setting_basic_sourcename_real') },
          { value: 'alias', label: t('setting_basic_sourcename_alias') },
        ]} />
        <View style={styles.fontBlock}>
          <Text size={13.5}>字体大小</Text>
          <View style={styles.chips}>
            {
              FONT_STEPS.map(value => {
                const active = Math.abs(fontSize - value) < 0.01
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.chip, { backgroundColor: active ? theme['c-primary'] : theme['c-primary-alpha-900'] }]}
                    onPress={() => { setFontSize(value) }}
                  >
                    <Text size={11.5} color={active ? theme['c-font'] : theme['c-450']}>{Math.round(value * 100)}%</Text>
                  </TouchableOpacity>
                )
              })
            }
          </View>
        </View>
      </Group>
      <Group title='导航与动效' icon='gesture-swipe-horizontal' color='#10B981'>
        <ChoiceRow settingKey='common.navGlassStyle' title='悬浮栏玻璃效果' options={[
          { value: 'liquid', label: '液态玻璃' },
          { value: 'frosted', label: '毛玻璃' },
          { value: 'none', label: '关闭' },
        ]} />
        <ChoiceRow settingKey='common.navProgressStyle' title='底部胶囊进度条' options={[
          { value: 'ring', label: '封面圆环' },
          { value: 'none', label: '关闭' },
        ]} />
        <ToggleRow settingKey='common.navSwipeSwitch' title='底部导航滑动切歌' />
      </Group>
      <Group title='分享' icon='share-variant-outline' color='#F59E0B'>
        <ChoiceRow settingKey='common.shareType' title='分享方式' options={[
          { value: 'system', label: '系统分享' },
          { value: 'clipboard', label: '复制到剪贴板' },
        ]} />
      </Group>
    </View>
  )
}

const styles = createStyle({
  modes: { flexDirection: 'row', gap: 8, padding: 14 },
  mode: { flex: 1, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fontBlock: { padding: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 },
  chip: { height: 30, paddingLeft: 12, paddingRight: 12, borderRadius: 15, justifyContent: 'center' },
})
