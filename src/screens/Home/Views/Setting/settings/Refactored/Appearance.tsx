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
import { Radius, Space, Type, getOnPrimary } from '@/theme/designTokens'

const MODES = [
  { value: 'light', label: '明亮' },
  { value: 'dark', label: '暗黑' },
  { value: 'auto', label: '跟随系统' },
] as const

const FONT_STEPS = [0.8, 0.9, 1, 1.1, 1.2, 1.3]

/** 主题与外观 */
export const ThemeSection = () => {
  const theme = useTheme()
  const t = useI18n()
  const isAutoTheme = useSettingValue('common.isAutoTheme')
  const useSeed = useSettingValue('theme.useSeed')
  const seedColor = useSettingValue('theme.seedColor')
  const darkId = useSettingValue('theme.darkId')
  const lightId = useSettingValue('theme.lightId')
  const fontSize = useFontSize()
  const mode = isAutoTheme ? 'auto' : (theme.isDark ? 'dark' : 'light')
  const onPrimary = getOnPrimary(theme)

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
      <Group title='主题与外观'>
        <View style={styles.modeBlock}>
          <Text size={Type.rowTitle.fontSize} style={styles.modeTitle}>主题模式</Text>
          <View style={[styles.segment, { backgroundColor: theme['c-primary-alpha-900'] }]}>
            {MODES.map(item => {
              const active = mode === item.value
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.segmentItem, active ? { backgroundColor: theme['c-primary'] } : null]}
                  activeOpacity={0.75}
                  onPress={() => { void selectMode(item.value) }}
                >
                  <Text size={Type.button.fontSize} color={active ? onPrimary : theme['c-450']}>{item.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
        <MaterialYouColors />
        <View style={styles.fontBlock}>
          <Text size={Type.rowTitle.fontSize} style={styles.modeTitle}>字体大小</Text>
          <View style={[styles.segment, { backgroundColor: theme['c-primary-alpha-900'] }]}>
            {FONT_STEPS.map(value => {
              const active = Math.abs(fontSize - value) < 0.01
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.segmentItem, active ? { backgroundColor: theme['c-primary'] } : null]}
                  onPress={() => { setFontSize(value) }}
                >
                  <Text size={Type.button.fontSize} color={active ? onPrimary : theme['c-450']}>{Math.round(value * 100)}%</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
        <ToggleRow settingKey='common.homePageScroll' title='页面左右滑动' desc='开启后在首页左右滑动切换页面' />
        <ToggleRow settingKey='common.reduceMotion' title='减少动态效果' desc='关闭大部分过渡与循环动画' />
        <ToggleRow settingKey='common.homeCardMotion' title='首页卡片动效' />
        <ToggleRow settingKey='common.coverRotation' title='专辑封面自转' />
        <ChoiceRow settingKey='common.langId' title='语言' options={langList.map(item => ({ value: item.locale, label: item.name }))} onChange={value => { setLanguage(value as Parameters<typeof setLanguage>[0]) }} />
        <ChoiceRow settingKey='common.sourceNameType' title='音源名称' options={[
          { value: 'real', label: t('setting_basic_sourcename_real') },
          { value: 'alias', label: t('setting_basic_sourcename_alias') },
        ]} />
        <ChoiceRow settingKey='common.navGlassStyle' title='胶囊/迷你播放器玻璃效果' options={[
          { value: 'liquid', label: '液态玻璃' },
          { value: 'frosted', label: '毛玻璃' },
          { value: 'none', label: '关闭' },
        ]} />
        <ChoiceRow settingKey='common.navProgressStyle' title='底部胶囊进度条' options={[
          { value: 'ring', label: '封面圆环' },
          { value: 'none', label: '关闭' },
        ]} />
        <ChoiceRow settingKey='common.shareType' title='分享方式' options={[
          { value: 'system', label: '系统分享' },
          { value: 'clipboard', label: '复制到剪贴板' },
        ]} />
      </Group>
    </View>
  )
}

/** 播放器与交互 */
export const PlayerInteractionSection = () => (
  <View>
    <Group title='播放器与交互'>
      <ToggleRow settingKey='common.navSwipeSwitch' title='底部导航滑动切歌' desc='在胶囊任务栏上左右滑动切换歌曲' />
      <ToggleRow settingKey='common.allowProgressBarSeek' title='底栏进度条可拖动' desc='关闭后只能从播放器页拖动进度' />
    </Group>
  </View>
)

export default () => (
  <View>
    <ThemeSection />
    <PlayerInteractionSection />
  </View>
)

const styles = createStyle({
  modeBlock: { paddingLeft: Space.lg, paddingRight: Space.lg, paddingTop: Space.md, paddingBottom: Space.md },
  modeTitle: { ...Type.rowTitle },
  segment: { flexDirection: 'row', borderRadius: Radius.md, padding: 2, marginTop: Space.sm },
  segmentItem: { flex: 1, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  fontBlock: { paddingLeft: Space.lg, paddingRight: Space.lg, paddingTop: Space.md, paddingBottom: Space.md },
})
