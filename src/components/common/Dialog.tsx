import { useImperativeHandle, forwardRef, useMemo, useRef } from 'react'
import { View, TouchableOpacity } from 'react-native'

import Modal, { type ModalType } from './Modal'
import { Icon } from '@/components/common/Icon'
import { useKeyboard } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from './Text'

const HEADER_HEIGHT = 46
const styles = createStyle({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    maxWidth: '90%',
    minWidth: '62%',
    maxHeight: '78%',
    borderRadius: 20,
    elevation: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    overflow: 'hidden',
  },
  header: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: HEADER_HEIGHT,
    paddingLeft: 18,
    paddingRight: 8,
  },
  title: {
    flexGrow: 1,
    flexShrink: 1,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
})

export interface DialogProps {
  onHide?: () => void
  keyHide?: boolean
  bgHide?: boolean
  closeBtn?: boolean
  title?: string
  children: React.ReactNode | React.ReactNode[]
  height?: number | `${number}%`
}

export interface DialogType {
  setVisible: (visible: boolean) => void
}

export default forwardRef<DialogType, DialogProps>(({
  onHide,
  keyHide = true,
  bgHide = true,
  closeBtn = true,
  title = '',
  children,
  height,
}: DialogProps, ref) => {
  const theme = useTheme()
  const { keyboardShown, keyboardHeight } = useKeyboard()
  const modalRef = useRef<ModalType>(null)

  useImperativeHandle(ref, () => ({
    setVisible(visible: boolean) {
      modalRef.current?.setVisible(visible)
    },
  }))

  // 原来是 primary 色块标题条（整条背景色 + 10px 小叉），非常突兀；
  // 改成透明头部 + 圆形关闭按钮，所有用 Dialog 的弹层一起变干净
  const headerComponent = useMemo(() => {
    if (!title && !closeBtn) return null
    return (
      <View style={styles.header}>
        <Text style={styles.title} size={15} color={theme['c-font']} numberOfLines={1}>{title}</Text>
        {
          closeBtn
            ? (
              <TouchableOpacity
                style={{ ...styles.closeBtn, backgroundColor: theme['c-primary-alpha-900'] }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => modalRef.current?.setVisible(false)}
              >
                <Icon name="close" color={theme['c-500']} size={16} />
              </TouchableOpacity>
              )
            : null
        }
      </View>
    )
  }, [closeBtn, theme, title])

  return (
    <Modal onHide={onHide} keyHide={keyHide} bgHide={bgHide} bgColor="rgba(50,50,50,.3)" ref={modalRef}>
      <View style={{ ...styles.centeredView, paddingBottom: keyboardShown ? keyboardHeight : 0 }}>
        <View style={{ ...styles.modalView, height, backgroundColor: theme['c-content-background'] }} onStartShouldSetResponder={() => true}>
          {headerComponent}
          {children}
        </View>
      </View>
    </Modal>
  )
})
