import { useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react'
import { Modal, TouchableOpacity, View, KeyboardAvoidingView, Platform } from 'react-native'
import Text from '@/components/common/Text'
import Input, { type InputType } from '@/components/common/Input'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { type Source } from '@/store/songlist/state'

export interface ModalProps {
  onOpenId: (id: string) => void
}
export interface ModalType {
  show: (source: Source) => void
}

export default forwardRef<ModalType, ModalProps>(({ onOpenId }, ref) => {
  const theme = useTheme()
  const t = useI18n()
  const inputRef = useRef<InputType>(null)
  const [visible, setVisible] = useState(false)
  const [text, setText] = useState('')

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
        <TouchableOpacity style={styles.maskTouch} activeOpacity={1} onPress={handleClose}>
          <View
            style={{ ...styles.card, backgroundColor: theme['c-content-background'] }}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.head}>
              <View style={{ ...styles.iconWrap, backgroundColor: theme['c-primary-alpha-800'] }}>
                <Icon name='link-variant' size={17} color={theme['c-primary-font']} />
              </View>
              <View style={styles.headText}>
                <Text size={16} style={styles.title}>打开歌单</Text>
                <Text size={11} color={theme['c-450']} style={styles.subtitle}>粘贴歌单链接或 ID</Text>
              </View>
            </View>

            <Input
              ref={inputRef}
              placeholder={t('songlist_open_input_placeholder')}
              value={text}
              onChangeText={setText}
              style={{ ...styles.input, backgroundColor: theme['c-primary-alpha-900'], borderColor: theme['c-primary-alpha-700'] }}
            />

            <Text size={11} color={theme['c-400']} style={styles.tip}>{t('songlist_open_input_tip')}</Text>

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={{ ...styles.btn, backgroundColor: theme['c-primary-alpha-800'] }}
                activeOpacity={0.7}
                onPress={handleClose}
              >
                <Text size={14} color={theme['c-font']}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ ...styles.btn, backgroundColor: theme['c-primary'], opacity: text.trim() ? 1 : 0.45 }}
                activeOpacity={0.8}
                disabled={!text.trim()}
                onPress={handleConfirm}
              >
                <Text size={14} color='#FFFFFF' style={styles.confirmText}>打开</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  )
})

const styles = createStyle({
  mask: {
    flex: 1,
  },
  maskTouch: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    width: 38,
    height: 38,
    borderRadius: 13,
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
