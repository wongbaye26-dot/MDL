import { useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react'
import { Modal, TouchableOpacity, View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'

import Text from '@/components/common/Text'
import Input, { type InputType } from '@/components/common/Input'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import { useSheetPalette } from '@/components/common/ActionSheet/palette'
import { contrastOn } from '@/theme/solid'
import { useI18n } from '@/lang'
import { type Source } from '@/store/songlist/state'

export interface ModalProps {
  onOpenId: (id: string) => void
}
export interface ModalType {
  show: (source: Source) => void
}

/**
 * 打开歌单弹窗。
 *
 * 和 ActionSheet / 自定义源弹窗同一套 Material You 卡片语言：
 * 黑 50% 遮罩 + 圆角 24、主题底色；图标头 + 说明、主题淡底输入框、
 * 次按钮（取消）+ 主色按钮（打开）。
 */
export default forwardRef<ModalType, ModalProps>(({ onOpenId }, ref) => {
  const palette = useSheetPalette()
  const t = useI18n()
  const inputRef = useRef<InputType>(null)
  const [visible, setVisible] = useState(false)
  const [text, setText] = useState('')
  const onPrimary = contrastOn(palette.primary)

  useImperativeHandle(ref, () => ({
    show() {
      setText('')
      setVisible(true)
      setTimeout(() => { inputRef.current?.focus() }, 260)
    },
  }))

  const handleClose = useCallback(() => {
    setVisible(false)
  }, [])

  const handleConfirm = useCallback(() => {
    let id = text.trim()
    if (!id.length) return
    if (id.length > 500) id = id.substring(0, 500)
    setVisible(false)
    onOpenId(id)
  }, [text, onOpenId])

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.mask}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 遮罩单独一层：卡片里的输入框/按钮不会被 responder 抢走 */}
        <TouchableOpacity
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: palette.scrim }}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.maskCenter} pointerEvents='box-none'>
          <View style={{ ...styles.card, backgroundColor: palette.bg }}>
            <View style={styles.head}>
              <View style={{ ...styles.iconWrap, backgroundColor: palette.card, borderColor: palette.border }}>
                <Icon name='link-variant' size={18} color={palette.primary} />
              </View>
              <View style={styles.headText}>
                <Text size={16} color={palette.text} style={styles.title}>打开歌单</Text>
                <Text size={11} color={palette.textSecondary} style={styles.subtitle}>粘贴歌单链接或 ID</Text>
              </View>
            </View>

            <Input
              ref={inputRef}
              placeholder={t('songlist_open_input_placeholder')}
              value={text}
              onChangeText={setText}
              style={{ ...styles.input, backgroundColor: palette.card, borderColor: palette.border }}
            />

            <Text size={11} color={palette.textSecondary} style={styles.tip}>{t('songlist_open_input_tip')}</Text>

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={{ ...styles.btn, backgroundColor: palette.card, borderColor: palette.border, borderWidth: 0.5 }}
                activeOpacity={0.7}
                onPress={handleClose}
              >
                <Text size={14} color={palette.text}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ ...styles.btn, backgroundColor: palette.primary, opacity: text.trim() ? 1 : 0.45 }}
                activeOpacity={0.8}
                disabled={!text.trim()}
                onPress={handleConfirm}
              >
                <Text size={14} color={onPrimary} style={styles.confirmText}>打开</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
})

const styles = createStyle({
  mask: {
    flex: 1,
  },
  maskCenter: {
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
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 22,
    paddingBottom: 18,
    elevation: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headText: {
    flexGrow: 1,
    flexShrink: 1,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 3,
  },
  input: {
    width: '100%',
    height: 46,
    borderRadius: 14,
    borderWidth: 0.5,
    paddingLeft: 14,
    paddingRight: 14,
  },
  tip: {
    marginTop: 12,
    lineHeight: 17,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  btn: {
    height: 40,
    minWidth: 84,
    paddingLeft: 20,
    paddingRight: 20,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  confirmText: {
    fontWeight: '600',
  },
})
