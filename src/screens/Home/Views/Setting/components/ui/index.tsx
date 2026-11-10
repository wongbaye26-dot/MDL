import { memo, useState, type ReactNode } from 'react'
import { Switch, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import ActionSheet from '@/components/common/ActionSheet'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'
import { useHorizontalMode } from '@/utils/hooks'
import {
  IconSize,
  LineHeight,
  Radius,
  Space,
  Type,
  getDanger,
  getOnPrimary,
  getSettingsDivider,
} from '@/theme/designTokens'

/**
 * 设置页统一列表组件（v2，扁平分组）。
 *
 * 规范见 design/DESIGN-SYSTEM.md：
 * - 分组 = 分组标题 + 行 + 0.5dp 分割线，不再是一张 24dp 大卡；
 * - 行内只有三种右侧形态：Switch / 值 + 箭头 / 文本按钮；
 * - 不出现彩色图标底、不使用 13.5/10.5 之类半档字号；
 * - 颜色全部走主题 token，页面不再写死 hex/rgba。
 */

/** 分组：标题在卡片外，行直接铺在页面背景上 */
export const Group = ({ title, desc, children, footer }: {
  title: string
  desc?: string
  /** 兼容旧调用；新设计不渲染分组图标 */
  icon?: string
  color?: string
  children: ReactNode
  footer?: ReactNode
}) => {
  const theme = useTheme()
  const compact = useHorizontalMode()
  const items = Array.isArray(children) ? children.filter(Boolean) : [children]
  return (
    <View style={[styles.group, compact ? styles.groupCompact : null]}>
      <Text size={Type.sectionLabel.fontSize} color={theme['c-450']} style={styles.groupTitle}>{title}</Text>
      {desc ? <Text size={Type.caption.fontSize} color={theme['c-350']} style={styles.groupDesc}>{desc}</Text> : null}
      <View>
        {items.map((item, index) => (
          <View key={index}>
            {index > 0 ? <View style={{ height: 0.5, marginLeft: 16, marginRight: 12, backgroundColor: getSettingsDivider(theme) }} /> : null}
            {item}
          </View>
        ))}
      </View>
      {footer}
    </View>
  )
}

const Row = ({ children, onPress, accessibilityRole, accessibilityState, accessibilityLabel }: {
  children: ReactNode
  onPress?: () => void
  accessibilityRole?: 'button' | 'switch'
  accessibilityState?: { checked?: boolean }
  accessibilityLabel?: string
}) => (
  <TouchableOpacity
    style={styles.row}
    activeOpacity={onPress ? 0.7 : 1}
    disabled={!onPress}
    onPress={onPress}
    accessibilityRole={accessibilityRole}
    accessibilityState={accessibilityState}
    accessibilityLabel={accessibilityLabel}
  >
    {children}
  </TouchableOpacity>
)

const RowText = ({ title, desc }: { title: string, desc?: string }) => {
  const theme = useTheme()
  return (
    <View style={styles.rowInfo}>
      <Text size={Type.rowTitle.fontSize} style={styles.rowTitle}>{title}</Text>
      {desc ? (
        <Text size={Type.rowDesc.fontSize} color={theme['c-450']} style={styles.rowDesc}>{desc}</Text>
      ) : null}
    </View>
  )
}

const SwitchControl = ({ value, onChange }: { value: boolean, onChange: (next: boolean) => void }) => {
  const theme = useTheme()
  return (
    <Switch
      value={value}
      trackColor={{ false: theme['c-primary-alpha-600'], true: theme['c-primary'] }}
      thumbColor={value ? '#FFFFFF' : theme['c-450']}
      ios_backgroundColor={theme['c-primary-alpha-600']}
      onValueChange={onChange}
    />
  )
}

export const ToggleRow = ({ settingKey, title, desc }: {
  settingKey: keyof LX.AppSetting
  title: string
  desc?: string
}) => {
  const value = !!useSettingValue(settingKey)
  const toggle = () => { // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    updateSetting({ [settingKey]: !value } as Partial<LX.AppSetting>)
  }
  return (
    <Row
      onPress={toggle}
      accessibilityRole='switch'
      accessibilityState={{ checked: value }}
      accessibilityLabel={title}
    >
      <RowText title={title} desc={desc} />
      <SwitchControl value={value} onChange={toggle} />
    </Row>
  )
}

export const CustomToggleRow = ({ title, desc, value, onChange }: {
  title: string
  desc?: string
  value: boolean
  onChange: (value: boolean) => void
}) => (
  <Row onPress={() => { onChange(!value) }} accessibilityRole='switch' accessibilityState={{ checked: value }} accessibilityLabel={title}>
    <RowText title={title} desc={desc} />
    <SwitchControl value={value} onChange={onChange} />
  </Row>
)

export interface ChoiceOption<T = string | number> {
  value: T
  label: string
}

/** 短选项用分段控件；长选项/多项走「值 + 箭头 → BottomSheet 单选」 */
export const ChoiceRow = <T extends string | number>({ settingKey, title, desc, options, onChange }: {
  settingKey: keyof LX.AppSetting
  title: string
  desc?: string
  options: Array<ChoiceOption<T>>
  onChange?: (value: T) => void
}) => {
  const theme = useTheme()
  const value = useSettingValue(settingKey) as T
  const [sheetVisible, setSheetVisible] = useState(false)
  const active = options.find(option => option.value === value)
  const useSegmented = options.length <= 3 && options.every(option => option.label.length <= 5)

  const select = (next: T) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    updateSetting({ [settingKey]: next } as Partial<LX.AppSetting>)
    onChange?.(next)
    setSheetVisible(false)
  }

  if (useSegmented) {
    return (
      <View style={styles.choiceRow}>
        <Text size={Type.rowTitle.fontSize} style={styles.rowTitle}>{title}</Text>
        {desc ? <Text size={Type.rowDesc.fontSize} color={theme['c-450']} style={styles.rowDesc}>{desc}</Text> : null}
        <View style={[styles.segment, { backgroundColor: theme['c-primary-alpha-900'] }]}>
          {options.map(option => {
            const selected = option.value === value
            return (
              <TouchableOpacity
                key={String(option.value)}
                style={[styles.segmentItem, selected ? { backgroundColor: theme['c-primary'] } : null]}
                activeOpacity={0.75}
                onPress={() => { select(option.value) }}
              >
                <Text size={Type.button.fontSize} color={selected ? getOnPrimary(theme) : theme['c-450']} style={styles.segmentText}>{option.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    )
  }

  return (
    <>
      <Row onPress={() => { setSheetVisible(true) }} accessibilityRole='button' accessibilityLabel={`${title}：${active?.label ?? ''}`}>
        <RowText title={title} desc={desc} />
        <Text size={Type.value.fontSize} color={theme['c-450']} numberOfLines={1} style={styles.value}>{active?.label ?? '—'}</Text>
        <Icon name='chevron-right' size={IconSize.sm} color={theme['c-350']} />
      </Row>
      <ActionSheet
        visible={sheetVisible}
        onClose={() => { setSheetVisible(false) }}
        header={{ title, subtitle: desc }}
        items={options.map(option => ({
          key: String(option.value),
          label: option.label,
          icon: option.value === value ? 'check' : 'circle-outline',
          active: option.value === value,
          onPress: () => { select(option.value) },
        }))}
      />
    </>
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
    <Row onPress={onPress} accessibilityRole='button' accessibilityLabel={title}>
      <RowText title={title} desc={desc} />
      {value ? <Text size={Type.value.fontSize} color={theme['c-450']} numberOfLines={1} style={styles.value}>{value}</Text> : null}
      {onPress ? <Icon name='chevron-right' size={IconSize.sm} color={theme['c-350']} /> : null}
    </Row>
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
  const actionColor = danger ? getDanger(theme) : theme['c-primary']
  return (
    <View style={styles.row}>
      <RowText title={title} desc={desc} />
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: danger ? theme['c-primary-alpha-900'] : theme['c-primary-alpha-900'] }]}
        activeOpacity={0.7}
        onPress={onPress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole='button'
        accessibilityLabel={`${title}：${action}`}
      >
        <Text size={Type.button.fontSize} color={actionColor}>{action}</Text>
      </TouchableOpacity>
    </View>
  )
}

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
      <RowText title={title} desc={desc} />
      <View style={styles.stepper}>
        <TouchableOpacity style={[styles.stepBtn, { backgroundColor: theme['c-primary-alpha-900'] }]} onPress={() => { setValue(value - step) }} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }} accessibilityLabel={`${title}减`}>
          <Icon name='minus' size={IconSize.sm} color={theme['c-primary']} />
        </TouchableOpacity>
        <Text size={Type.value.fontSize} style={styles.stepValue}>{format ? format(value) : `${value}${suffix}`}</Text>
        <TouchableOpacity style={[styles.stepBtn, { backgroundColor: theme['c-primary-alpha-900'] }]} onPress={() => { setValue(value + step) }} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }} accessibilityLabel={`${title}加`}>
          <Icon name='plus' size={IconSize.sm} color={theme['c-primary']} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

/** 兼容旧 Tools/Source 页面的小节标题；新页面优先用 Group */
export const UiSectionTitle = memo(({ title, desc }: { title: string, desc?: string }) => {
  const theme = useTheme()
  return (
    <View style={styles.secTitleWrap}>
      <Text size={Type.sectionLabel.fontSize} color={theme['c-450']} style={styles.groupTitle}>{title}</Text>
      {desc ? <Text size={Type.caption.fontSize} color={theme['c-350']} style={styles.groupDesc}>{desc}</Text> : null}
    </View>
  )
})

const styles = createStyle({
  group: {
    marginBottom: Space.xxl,
  },
  groupCompact: {
    marginBottom: Space.lg,
  },
  groupTitle: {
    ...Type.sectionLabel,
    paddingLeft: Space.lg,
    paddingRight: Space.lg,
    marginBottom: Space.sm,
  },
  groupDesc: {
    paddingLeft: Space.lg,
    paddingRight: Space.lg,
    marginTop: -Space.xs,
    marginBottom: Space.sm,
    lineHeight: LineHeight.caption,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingLeft: Space.lg,
    paddingRight: Space.lg,
    paddingTop: Space.md,
    paddingBottom: Space.md,
  },
  rowCompact: {
    minHeight: 48,
    paddingTop: Space.sm,
    paddingBottom: Space.sm,
  },
  rowInfo: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingRight: Space.sm,
  },
  rowTitle: {
    ...Type.rowTitle,
  },
  rowDesc: {
    ...Type.rowDesc,
    marginTop: 2,
    lineHeight: LineHeight.rowDesc,
  },
  value: {
    ...Type.value,
    flexShrink: 0,
    maxWidth: '46%',
    textAlign: 'right',
    marginRight: Space.xs,
  },
  choiceRow: {
    paddingLeft: Space.lg,
    paddingRight: Space.lg,
    paddingTop: Space.md,
    paddingBottom: Space.md,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: 2,
    marginTop: Space.sm,
  },
  segmentItem: {
    flex: 1,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    ...Type.button,
  },
  actionBtn: {
    minHeight: 32,
    paddingLeft: Space.md,
    paddingRight: Space.md,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    ...Type.value,
    minWidth: 62,
    textAlign: 'center',
  },
  secTitleWrap: {
    paddingLeft: Space.lg,
    paddingRight: Space.lg,
    marginTop: Space.lg,
    marginBottom: Space.sm,
  },
})
