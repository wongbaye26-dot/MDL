import { memo, type ReactNode } from 'react'
import { Switch, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'
import { contrastOn } from '@/theme/solid'
import { getCardBackground, getCardBorder, getCardShadow, getDividerColor, getIconColor, getTileBackground } from '../surfaces'

/** 新设置页统一卡片分组：标题在卡片内、行间统一分隔线 */
export const Group = ({ title, desc, icon, color, children, footer }: {
  title: string
  desc?: string
  icon?: string
  color?: string
  children: ReactNode
  footer?: ReactNode
}) => {
  const theme = useTheme()
  const items = Array.isArray(children) ? children.filter(Boolean) : [children]
  return (
    <View style={styles.groupWrap}>
      <View style={{
        ...styles.group,
        backgroundColor: getCardBackground(theme),
        borderColor: getCardBorder(theme),
        ...getCardShadow(theme),
      }}>
        <View style={styles.groupHead}>
          {icon
            ? (
              <View style={[styles.groupIcon, { backgroundColor: getTileBackground(theme, color) }]}>
                <Icon name={icon} size={15} color={getIconColor(theme, color)} />
              </View>
              )
            : null}
          <View style={styles.groupHeadText}>
            <Text size={13.5} style={styles.groupTitle}>{title}</Text>
            {desc ? <Text size={10} color={theme['c-450']} style={styles.groupDesc}>{desc}</Text> : null}
          </View>
        </View>
        {
          items.map((item, index) => (
            <View key={index}>
              {index > 0 ? <View style={[styles.divider, { backgroundColor: getDividerColor(theme) }]} /> : null}
              {item}
            </View>
          ))
        }
        {footer}
      </View>
    </View>
  )
}

export const ToggleRow = ({ settingKey, title, desc }: {
  settingKey: keyof LX.AppSetting
  title: string
  desc?: string
}) => {
  const theme = useTheme()
  const value = !!useSettingValue(settingKey)
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.72}
      accessibilityRole='switch'
      accessibilityState={{ checked: value }}
      onPress={() => { // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        updateSetting({ [settingKey]: !value } as Partial<LX.AppSetting>)
      }}
    >
      <View style={styles.rowInfo}>
        <Text size={13.5}>{title}</Text>
        {desc ? <Text size={10.5} color={theme['c-450']} style={styles.desc}>{desc}</Text> : null}
      </View>
      <Switch
        value={value}
        trackColor={{ false: theme['c-primary-alpha-800'], true: theme['c-primary'] }}
        thumbColor={value ? '#FFFFFF' : theme['c-450']}
        onValueChange={() => {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          updateSetting({ [settingKey]: !value } as Partial<LX.AppSetting>)
        }}
      />
    </TouchableOpacity>
  )
}

export const CustomToggleRow = ({ title, desc, value, onChange }: {
  title: string
  desc?: string
  value: boolean
  onChange: (value: boolean) => void
}) => {
  const theme = useTheme()
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.72} accessibilityRole='switch' accessibilityState={{ checked: value }} onPress={() => { onChange(!value) }}>
      <View style={styles.rowInfo}>
        <Text size={13.5}>{title}</Text>
        {desc ? <Text size={10.5} color={theme['c-450']} style={styles.desc}>{desc}</Text> : null}
      </View>
      <Switch
        value={value}
        trackColor={{ false: theme['c-primary-alpha-800'], true: theme['c-primary'] }}
        thumbColor={value ? '#FFFFFF' : theme['c-450']}
        onValueChange={onChange}
      />
    </TouchableOpacity>
  )
}

export interface ChoiceOption<T = string | number> {
  value: T
  label: string
}

export const ChoiceRow = <T extends string | number>({ settingKey, title, desc, options, onChange }: {
  settingKey: keyof LX.AppSetting
  title: string
  desc?: string
  options: Array<ChoiceOption<T>>
  onChange?: (value: T) => void
}) => {
  const theme = useTheme()
  const value = useSettingValue(settingKey) as T
  return (
    <View style={styles.choiceRow}>
      <Text size={13.5}>{title}</Text>
      {desc ? <Text size={10.5} color={theme['c-450']} style={styles.desc}>{desc}</Text> : null}
      <View style={styles.chips}>
        {
          options.map(option => {
            const active = option.value === value
            const chipWidth = Math.min(210, Math.max(56, option.label.length * 14 + 24))
            return (
              <TouchableOpacity
                key={String(option.value)}
                style={[styles.chip, { width: chipWidth, backgroundColor: active ? theme['c-primary'] : theme['c-primary-alpha-900'] }]}
                activeOpacity={0.75}
                onPress={() => {
                  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                  updateSetting({ [settingKey]: option.value } as Partial<LX.AppSetting>)
                  onChange?.(option.value)
                }}
              >
                <Text size={11.5} color={active ? contrastOn(theme['c-primary']) : theme['c-450']} style={[styles.chipText, { width: chipWidth - 24, textAlign: 'center' }]}>{option.label}</Text>
              </TouchableOpacity>
            )
          })
        }
      </View>
    </View>
  )
}

export const ValueRow = ({ title, desc, value, onPress }: {
  title: string
  desc?: string
  value?: string
  onPress?: () => void
}) => {
  const theme = useTheme()
  return (
    <TouchableOpacity style={styles.row} activeOpacity={onPress ? 0.72 : 1} disabled={!onPress} onPress={onPress}>
      <View style={styles.rowInfo}>
        <Text size={13.5}>{title}</Text>
        {desc ? <Text size={10.5} color={theme['c-450']} style={styles.desc}>{desc}</Text> : null}
      </View>
      {value ? <Text size={11.5} color={theme['c-450']} numberOfLines={1} style={[styles.value, { width: Math.min(210, value.length * 7 + 18) }]}>{value}</Text> : null}
      {onPress ? <Icon name='chevron-right' size={16} color={theme['c-350']} /> : null}
    </TouchableOpacity>
  )
}

export const ActionRow = ({ title, desc, action, onPress, danger }: {
  title: string
  desc?: string
  action: string
  onPress: () => void
  danger?: boolean
}) => {
  const theme = useTheme()
  return (
    <View style={styles.row}>
      <View style={styles.rowInfo}>
        <Text size={13.5}>{title}</Text>
        {desc ? <Text size={10.5} color={theme['c-450']} style={styles.desc}>{desc}</Text> : null}
      </View>
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: danger ? theme['c-primary-alpha-900'] : theme['c-primary'] }]}
        activeOpacity={0.8}
        onPress={onPress}
      >
        <Text size={11.5} color={danger ? '#FF6B6B' : contrastOn(theme['c-primary'])}>{action}</Text>
      </TouchableOpacity>
    </View>
  )
}

/** 数字 +/- 行，写回字符串型数字设置 */
export const StepperRow = ({ settingKey, title, desc, min, max, step, suffix = '', format }: {
  settingKey: keyof LX.AppSetting
  title: string
  desc?: string
  min: number
  max: number
  step: number
  suffix?: string
  format?: (value: number) => string
}) => {
  const theme = useTheme()
  const raw = Number(useSettingValue(settingKey))
  const value = Number.isFinite(raw) ? raw : min
  const setValue = (next: number) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const patch = { [settingKey]: String(Math.min(max, Math.max(min, next))) } as Partial<LX.AppSetting>
    updateSetting(patch)
  }
  return (
    <View style={styles.row}>
      <View style={styles.rowInfo}>
        <Text size={13.5}>{title}</Text>
        {desc ? <Text size={10.5} color={theme['c-450']} style={styles.desc}>{desc}</Text> : null}
      </View>
      <View style={styles.stepper}>
        <TouchableOpacity style={[styles.stepBtn, { backgroundColor: theme['c-primary-alpha-900'] }]} onPress={() => { setValue(value - step) }}>
          <Icon name='minus' size={14} color={theme['c-primary']} />
        </TouchableOpacity>
        <Text size={12} style={styles.stepValue}>{format ? format(value) : `${value}${suffix}`}</Text>
        <TouchableOpacity style={[styles.stepBtn, { backgroundColor: theme['c-primary-alpha-900'] }]} onPress={() => { setValue(value + step) }}>
          <Icon name='plus' size={14} color={theme['c-primary']} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

export const UiSectionTitle = memo(({ title, desc }: { title: string, desc?: string }) => {
  const theme = useTheme()
  return (
    <View style={styles.secTitleWrap}>
      <Text size={11} color={theme['c-450']} style={styles.secTitle}>{title}</Text>
      {desc ? <Text size={10} color={theme['c-350']} style={styles.secDesc}>{desc}</Text> : null}
    </View>
  )
})

const styles = createStyle({
  groupWrap: { marginBottom: 14 },
  group: { borderRadius: 24, borderWidth: 0.5, overflow: 'hidden' },
  groupHead: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 16, paddingTop: 13, paddingBottom: 9 },
  groupIcon: { width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  groupHeadText: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  groupTitle: { fontWeight: '700', letterSpacing: 0.2 },
  groupDesc: { marginTop: 2 },
  divider: { height: 0.5, marginLeft: 16, marginRight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingLeft: 16, paddingRight: 14, paddingTop: 10, paddingBottom: 10 },
  rowInfo: { flexGrow: 1, flexShrink: 1, minWidth: 0, paddingRight: 10 },
  desc: { marginTop: 2, lineHeight: 14 },
  choiceRow: { paddingLeft: 16, paddingRight: 14, paddingTop: 12, paddingBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9, alignItems: 'flex-start' },
  chip: { flexShrink: 0, alignSelf: 'flex-start', minHeight: 30, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  chipText: { flexShrink: 0 },
  value: { flexShrink: 0, maxWidth: '58%', marginRight: 4, textAlign: 'right', lineHeight: 16, paddingRight: 12 },
  actionBtn: { height: 30, paddingLeft: 12, paddingRight: 12, borderRadius: 15, justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 62, textAlign: 'center', fontWeight: '600' },
  secTitleWrap: { paddingLeft: 4, paddingRight: 4, marginTop: 2, marginBottom: 7 },
  secTitle: { fontWeight: '600', letterSpacing: 0.3 },
  secDesc: { marginTop: 2 },
})
