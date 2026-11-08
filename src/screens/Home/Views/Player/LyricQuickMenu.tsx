import { memo, useState } from 'react'
import { Modal, Pressable, TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { toggleTranslation } from '@/core/lyric'
import { createStyle } from '@/utils/tools'
import { LYRIC_SIZE_LABELS } from '@/screens/Home/Views/Setting/settings/Player/LyricSize'

const ALIGN_LABELS = ['自动', '居中', '左对齐'] as const
const ALIGN_VALUES = ['auto', 'center', 'left'] as const

/**
 * 播放器歌词快捷菜单。
 *
 * 需求：点歌词设置只弹一个**竖向排列的悬浮图标菜单**，不再整页/整 sheet 展开；
 * 菜单只保留四项，点一项就切换一项：
 *  - 歌词字号（小/标准/大/超大，循环）
 *  - 歌词对齐（自动/居中/左对齐，循环）
 *  - 歌词翻译（只有当前歌词带扩展行时才显示）
 *  - 粤拼（自动粤拼开关）
 * 点菜单外任意位置关闭。
 */
export default memo(({
  visible,
  hasTranslation,
  landscape = false,
  language = '',
  onSelectLanguage,
  onClose,
}: {
  visible: boolean
  landscape?: boolean
  /** 当前歌词是否有翻译/注音等扩展行（没有就不显示「歌词翻译」） */
  hasTranslation: boolean
  /** 当前歌曲语种（'' = 自动判断） */
  language?: string
  onSelectLanguage?: (language: string) => void
  onClose: () => void
}) => {
  const [showLanguages, setShowLanguages] = useState(false)
  const languageOptions = [
    { label: '自动判断', short: '自', value: '' },
    { label: '粤语', short: '粤', value: '粤语' },
    { label: '普通话', short: '普', value: '普通话' },
    { label: '英文', short: 'EN', value: '英文' },
    { label: '日文', short: '日', value: '日文' },
    { label: '韩文', short: '韩', value: '韩文' },
  ]
  const theme = useTheme()
  const sizeIndex = useSettingValue('player.lyricSizeIndex')
  const align = useSettingValue('player.lyricAlign')
  const showTranslation = useSettingValue('player.isShowLyricTranslation')
  const autoJyutping = useSettingValue('player.isAutoJyutping')
  const wordByWord = useSettingValue('player.isWordByWordLyric')

  const sizeLabel = LYRIC_SIZE_LABELS[Math.max(0, Math.min(LYRIC_SIZE_LABELS.length - 1, sizeIndex))] ?? '标准'
  const alignIndex = Math.max(0, ALIGN_VALUES.indexOf(align as typeof ALIGN_VALUES[number]))
  const alignLabel = ALIGN_LABELS[alignIndex] ?? '自动'

  const rows = [
    {
      key: 'size',
      icon: 'format-size',
      label: '歌词字号',
      value: sizeLabel,
      active: false,
      onPress: () => { updateSetting({ 'player.lyricSizeIndex': (sizeIndex + 1) % LYRIC_SIZE_LABELS.length }) },
    },
    {
      key: 'align',
      icon: 'format-align-center',
      label: '歌词对齐',
      value: alignLabel,
      active: false,
      onPress: () => { updateSetting({ 'player.lyricAlign': ALIGN_VALUES[(alignIndex + 1) % ALIGN_VALUES.length] }) },
    },
    ...(hasTranslation
      ? [{
          key: 'translation',
          icon: 'translate',
          label: '歌词翻译',
          value: showTranslation ? '开' : '关',
          active: showTranslation,
          onPress: () => {
            const next = !showTranslation
            updateSetting({ 'player.isShowLyricTranslation': next })
            void toggleTranslation(next)
          },
        }]
      : []),
    {
      key: 'wordByWord',
      icon: 'format-text',
      label: '逐字显示',
      value: wordByWord ? '开' : '关',
      active: wordByWord,
      onPress: () => { updateSetting({ 'player.isWordByWordLyric': !wordByWord }) },
    },
    {
      key: 'jyutping',
      icon: 'alphabetical',
      label: '粤拼',
      value: autoJyutping ? '开' : '关',
      active: autoJyutping,
      onPress: () => { updateSetting({ 'player.isAutoJyutping': !autoJyutping }) },
    },
    {
      key: 'language',
      icon: 'earth',
      label: '歌曲语种',
      value: language || '自动',
      active: !!language,
      onPress: () => { setShowLanguages(true) },
    },
  ]
  const languageRows = languageOptions.map(option => ({
    key: `lang_${option.label}`,
    icon: 'translate',
    short: option.short,
    label: option.label,
    value: (language || '') === option.value ? '当前' : '',
    active: (language || '') === option.value,
    onPress: () => { onSelectLanguage?.(option.value); setShowLanguages(false) },
  }))

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType='fade' onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, landscape ? styles.backdropLand : null]} onPress={() => { setShowLanguages(false); onClose() }} accessibilityRole='button' accessibilityLabel='关闭歌词快捷菜单'>
        <View
          style={[
            styles.menu,
            landscape ? styles.menuLand : null,
            {
              backgroundColor: 'rgba(24,20,32,0.94)',
              borderColor: 'rgba(255,255,255,0.12)',
            },
          ]}
        >
          {/*
            仅图标显示：播放器/歌词页永远是深色底，菜单固定用深色玻璃，
            不再跟主题走（白色主题下不会出现一块白卡片）。
            每行只有 44×44 的图标键，靠图标 + 颜色区分状态，状态值通过无障碍标签播报。
          */}
          <View style={[styles.iconRow, landscape ? styles.iconRowLand : null]}>
            {
              (showLanguages ? languageRows : rows).map(row => (
                <TouchableOpacity
                  key={row.key}
                  style={[
                    styles.iconBtn,
                    { backgroundColor: row.active ? theme['c-primary'] : 'rgba(255,255,255,0.10)' },
                  ]}
                  activeOpacity={0.75}
                  accessibilityRole='button'
                  accessibilityLabel={`${row.label}${row.value ? ` ${row.value}` : ''}`}
                  onPress={row.onPress}
                >
                  {'short' in row && row.short
                    ? <Text size={14} color={row.active ? '#FFFFFF' : 'rgba(255,255,255,0.9)'}>{String(row.short)}</Text>
                    : <Icon name={row.icon} size={20} color={row.active ? '#FFFFFF' : 'rgba(255,255,255,0.9)'} />}
                </TouchableOpacity>
              ))
            }
          </View>
        </View>
      </Pressable>
    </Modal>
  )
})

const styles = createStyle({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingLeft: 16,
    paddingBottom: 170,
  },
  backdropLand: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingLeft: 0,
    paddingRight: 20,
    paddingBottom: 0,
    paddingTop: 96,
  },
  menuLand: {
    width: undefined,
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  menuLanguage: {
    // 语种列表不是 44×44 图标，固定宽度并让每行拉伸，避免竖屏下被 56 宽容器挤歪
    width: 208,
    alignItems: 'stretch',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 20,
  },
  iconRowLand: {
    flexDirection: 'row',
  },
  menu: {
    width: 56,
    borderRadius: 28,
    borderWidth: 0.5,
    paddingVertical: 6,
    elevation: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.32,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    alignItems: 'center',
  },
  iconRow: {
    flexDirection: 'column',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 3,
  },
})
