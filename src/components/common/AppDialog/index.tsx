import { memo, useCallback, useEffect, useState } from 'react'
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'

import Text from '../Text'
import { Icon } from '../Icon'
import { useSheetPalette } from '../ActionSheet/palette'
import { contrastOn } from '@/theme/solid'
import { createStyle } from '@/utils/tools'
import {
  dismissAppDialog,
  registerAppDialogHost,
  selectAppDialogAction,
  subscribeAppDialog,
  type AppDialogAction,
  type AppDialogOptions,
} from './service'

const getActionStyle = (action: AppDialogAction, palette: ReturnType<typeof useSheetPalette>, onPrimary: string) => {
  switch (action.style) {
    case 'primary':
      return { backgroundColor: palette.primary, borderColor: palette.primary, textColor: onPrimary }
    case 'danger':
      return { backgroundColor: palette.danger, borderColor: palette.danger, textColor: '#FFFFFF' }
    case 'cancel':
    case 'default':
    default:
      return { backgroundColor: palette.card, borderColor: palette.border, textColor: palette.text }
  }
}

/**
 * 全局 Material You 弹窗宿主：挂在 Home 根节点，一个实例覆盖所有页面。
 *
 * 视觉与 App 内 ActionSheet / 自定义源弹窗保持一致：
 * 黑 50% 遮罩 + 圆角 24 主题底色卡片 + 主色实心确认按钮 / 淡底次级按钮。
 */
export default memo(() => {
  const palette = useSheetPalette()
  const [options, setOptions] = useState<AppDialogOptions | null>(null)
  const onPrimary = contrastOn(palette.primary)

  useEffect(() => {
    const unsubscribe = subscribeAppDialog(setOptions)
    const unregister = registerAppDialogHost()
    return () => {
      unsubscribe()
      unregister()
    }
  }, [])

  const handleDismiss = useCallback(() => {
    if (options?.bgClose === false) return
    dismissAppDialog()
  }, [options])

  if (!options) return null

  const actions = options.actions ?? []
  const isColumn = actions.length > 2

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType='fade'
      onRequestClose={handleDismiss}
    >
      <View style={styles.mask}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleDismiss}
        />
        <View style={styles.center} pointerEvents='box-none'>
          <View style={{ ...styles.card, backgroundColor: palette.bg, borderColor: palette.border }}>
            {
              options.title
                ? (
                  <View style={styles.head}>
                    <View style={{ ...styles.headIcon, backgroundColor: palette.card, borderColor: palette.border }}>
                      <Icon
                        name={actions.some(action => action.style === 'danger') ? 'alert-circle-outline' : 'help-circle-outline'}
                        size={20}
                        color={actions.some(action => action.style === 'danger') ? palette.danger : palette.primary}
                      />
                    </View>
                    <View style={styles.headInfo}>
                      <Text size={16} color={palette.text} numberOfLines={2} style={styles.title}>{options.title}</Text>
                    </View>
                  </View>
                  )
                : null
            }
            <ScrollView
              style={{ ...styles.scroll, marginTop: options.title ? 12 : 0 }}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text size={13} color={palette.textSecondary} style={styles.message}>{options.message}</Text>
            </ScrollView>
            <View style={{ ...styles.actions, ...(isColumn ? styles.actionsColumn : null) }}>
              {
                actions.map((action, index) => {
                  const style = getActionStyle(action, palette, onPrimary)
                  return (
                    <TouchableOpacity
                      key={`${action.text}_${index}`}
                      style={{
                        ...(isColumn ? styles.actionColumn : styles.actionRow),
                        backgroundColor: style.backgroundColor,
                        borderColor: style.borderColor,
                        ...(index > 0 ? (isColumn ? styles.actionColumnGap : styles.actionGap) : null),
                      }}
                      activeOpacity={0.8}
                      onPress={() => { selectAppDialogAction(index) }}
                    >
                      <Text size={14} color={style.textColor} numberOfLines={1} style={styles.actionText}>{action.text}</Text>
                    </TouchableOpacity>
                  )
                })
              }
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
})

const styles = createStyle({
  mask: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 0.5,
    paddingLeft: 18,
    paddingRight: 18,
    paddingTop: 16,
    paddingBottom: 14,
    elevation: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  headInfo: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 320,
  },
  scrollContent: {
    paddingBottom: 2,
  },
  message: {
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 16,
  },
  actionsColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  actionRow: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    height: 42,
    borderRadius: 21,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionGap: {
    marginLeft: 8,
  },
  actionColumn: {
    height: 42,
    borderRadius: 21,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionColumnGap: {
    marginTop: 8,
  },
  actionText: {
    fontWeight: '600',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
})
